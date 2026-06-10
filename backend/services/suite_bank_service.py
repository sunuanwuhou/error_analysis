from __future__ import annotations

import hashlib
import json
import logging
import re
import unicodedata
import uuid
from collections import defaultdict
from typing import Any

from backend.database import get_conn
from backend.security import utcnow
from backend.services.suite_bank_drill import (
    BANK_DRILL_PAPER_ID,
    infer_exam_track,
    infer_exam_year,
    infer_major_module_for_question_row,
    infer_region,
    repair_question_meta_section_for_major_module,
)

_LOGGER = logging.getLogger(__name__)

SUITE_PRACTICE_SUBTYPE_PAPER = "paper_exam"
SUITE_PRACTICE_SUBTYPE_MODULE = "bank_module_drill"
SUITE_RECORD_STATUS_IN_PROGRESS = "in_progress"
SUITE_RECORD_STATUS_COMPLETED = "completed"


def normalize_suite_folder(folder: str) -> str:
    s = unicodedata.normalize("NFKC", (folder or "").replace("\u00a0", " "))
    return s.strip()


def normalize_suite_title(title: str) -> str:
    s = unicodedata.normalize("NFKC", (title or "").replace("\u00a0", " "))
    return " ".join(s.split()).strip()


def compute_suite_dedupe_key(folder: str, title: str) -> str:
    """Logical unique key: same folder + normalized title → one list row; re-import overwrites."""
    blob = f"{normalize_suite_folder(folder)}\x00{normalize_suite_title(title)}".encode("utf-8")
    return "sd_" + hashlib.sha256(blob).hexdigest()[:24]


def stable_paper_id_for_dedupe(dedupe_key: str) -> str:
    return "suite_" + hashlib.sha256(dedupe_key.encode("utf-8")).hexdigest()[:20]


def migrate_suite_papers_schema() -> None:
    """Add dedupe_key, merge duplicate folder+title rows (prefer word版本/, then more questions), unique index."""
    with get_conn() as conn:
        conn.execute("ALTER TABLE suite_papers ADD COLUMN IF NOT EXISTS dedupe_key TEXT")
        rows = conn.execute(
            """
            SELECT p.id, p.folder, p.title, p.source_rel_path, p.created_at,
                   (SELECT COUNT(*)::int FROM suite_questions q WHERE q.paper_id = p.id) AS qc
            FROM suite_papers p
            """
        ).fetchall()

        buckets: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for r in rows:
            d = dict(r)
            dk = compute_suite_dedupe_key(str(d.get("folder") or ""), str(d.get("title") or ""))
            d["_dk"] = dk
            buckets[dk].append(d)

        def sort_key(row: dict[str, Any]) -> tuple[int, int, str]:
            path = str(row.get("source_rel_path") or "")
            w = 1 if path.startswith("word版本/") else 0
            qc = int(row.get("qc") or 0)
            ts = str(row.get("created_at") or "")
            # Prefer official Word pipeline (word版本/). Among same source class, keep larger bundle.
            return (w, qc, ts)

        for dk, grp in buckets.items():
            if len(grp) <= 1:
                keeper = grp[0]
                conn.execute(
                    "UPDATE suite_papers SET dedupe_key = %s WHERE id = %s",
                    (dk, keeper["id"]),
                )
                continue
            grp_sorted = sorted(grp, key=sort_key, reverse=True)
            keeper = grp_sorted[0]
            for loser in grp_sorted[1:]:
                conn.execute("DELETE FROM suite_papers WHERE id = %s", (loser["id"],))
            conn.execute(
                "UPDATE suite_papers SET dedupe_key = %s WHERE id = %s",
                (dk, keeper["id"]),
            )

        for r in conn.execute("SELECT id, folder, title FROM suite_papers WHERE dedupe_key IS NULL").fetchall():
            row = dict(r)
            dk = compute_suite_dedupe_key(str(row.get("folder") or ""), str(row.get("title") or ""))
            conn.execute("UPDATE suite_papers SET dedupe_key = %s WHERE id = %s", (dk, row["id"]))

        try:
            conn.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS ux_suite_papers_dedupe_key ON suite_papers(dedupe_key)"
            )
        except Exception as ex:
            _LOGGER.warning("suite_bank: cannot create dedupe_key unique index: %s", ex)
        try:
            conn.execute("ALTER TABLE suite_papers ALTER COLUMN dedupe_key SET NOT NULL")
        except Exception as ex:
            _LOGGER.warning("suite_bank: cannot set dedupe_key NOT NULL: %s", ex)
        conn.commit()


def _terms(q: str) -> list[str]:
    return [t for t in re.split(r"\s+", (q or "").strip()) if t]


def search_suite_questions(raw_query: str, *, limit: int = 80) -> list[dict[str, Any]]:
    terms = _terms(raw_query)
    if not terms:
        return []
    lim = max(1, min(int(limit), 200))

    where_parts: list[str] = []
    params: list[Any] = []
    for t in terms:
        pat = f"%{t}%"
        where_parts.append(
            "(q.stem ILIKE %s OR q.options ILIKE %s OR q.analysis ILIKE %s OR p.title ILIKE %s OR p.folder ILIKE %s)"
        )
        params.extend([pat, pat, pat, pat, pat])

    sql = f"""
      SELECT q.id AS id,
             q.paper_id AS paper_id,
             q.seq_no AS seq_no,
             q.question_no AS question_no,
             q.stem AS stem,
             q.options AS options,
             q.answer AS answer,
             p.title AS paper_title,
             p.folder AS paper_folder,
             p.source_rel_path AS source_rel_path
      FROM suite_questions q
      JOIN suite_papers p ON p.id = q.paper_id
      WHERE {" AND ".join(where_parts)}
      ORDER BY p.title, q.seq_no
      LIMIT {lim}
    """

    with get_conn() as conn:
        rows = conn.execute(sql, tuple(params)).fetchall()
    return [dict(r) for r in rows]


def search_suite_papers(raw_query: str, *, limit: int = 40) -> list[dict[str, Any]]:
    """Whole-paper hits: folder / title / path AND-match; distinct papers only."""
    terms = _terms(raw_query)
    if not terms:
        return []
    lim = max(1, min(int(limit), 100))

    where_parts: list[str] = []
    params: list[Any] = []
    for t in terms:
        pat = f"%{t}%"
        where_parts.append(
            "(p.title ILIKE %s OR p.folder ILIKE %s OR p.source_rel_path ILIKE %s)"
        )
        params.extend([pat, pat, pat])

    sql = f"""
      SELECT p.id AS id,
             p.title AS title,
             p.folder AS folder,
             p.source_rel_path AS source_rel_path,
             COUNT(q.id)::int AS question_count
      FROM suite_papers p
      LEFT JOIN suite_questions q ON q.paper_id = p.id
      WHERE {" AND ".join(where_parts)}
      GROUP BY p.id, p.title, p.folder, p.source_rel_path
      ORDER BY p.folder,
               p.title,
               CASE WHEN p.source_rel_path LIKE 'word版本%%' THEN 0 ELSE 1 END
      LIMIT {lim}
    """

    with get_conn() as conn:
        rows = conn.execute(sql, tuple(params)).fetchall()
    return [dict(r) for r in rows]


def list_papers() -> list[dict[str, Any]]:
    sql = """
      SELECT p.id, p.source_rel_path, p.title, p.folder, p.created_at,
             COUNT(q.id)::int AS question_count
      FROM suite_papers p
      LEFT JOIN suite_questions q ON q.paper_id = p.id
      GROUP BY p.id, p.source_rel_path, p.title, p.folder, p.created_at
      ORDER BY p.folder,
               p.title,
               CASE WHEN p.source_rel_path LIKE 'word版本%%' THEN 0 ELSE 1 END,
               COUNT(q.id) DESC,
               p.created_at DESC
    """
    with get_conn() as conn:
        rows = conn.execute(sql).fetchall()
    return [dict(r) for r in rows]


def get_paper_questions(paper_id: str) -> dict[str, Any] | None:
    with get_conn() as conn:
        prow = conn.execute(
            "SELECT id, source_rel_path, title, folder, created_at, meta_json FROM suite_papers WHERE id = %s",
            (paper_id,),
        ).fetchone()
        if not prow:
            return None
        paper = dict(prow)
        qrows = conn.execute(
            """
            SELECT id, seq_no, question_no, stem, options, answer, analysis, type_label, img_data, meta_json, major_module
            FROM suite_questions
            WHERE paper_id = %s
            ORDER BY seq_no
            """,
            (paper_id,),
        ).fetchall()
    questions = []
    for r in qrows:
        rec = dict(r)
        if rec.get("meta_json"):
            try:
                rec["meta"] = json.loads(str(rec["meta_json"]))
            except json.JSONDecodeError:
                rec["meta"] = {}
        else:
            rec["meta"] = {}
        del rec["meta_json"]
        questions.append(rec)
    if paper.get("meta_json"):
        try:
            paper["meta"] = json.loads(str(paper["meta_json"]))
        except json.JSONDecodeError:
            paper["meta"] = {}
    else:
        paper["meta"] = {}
    del paper["meta_json"]
    paper["questions"] = questions
    paper["fetchedAt"] = utcnow().isoformat()
    return paper


def replace_paper_bundle(
    *,
    paper_id: str,
    dedupe_key: str,
    source_rel_path: str,
    title: str,
    folder: str,
    questions: list[dict[str, Any]],
    meta: dict[str, Any] | None = None,
) -> None:
    """Replace one logical paper: delete any row with same dedupe_key or source_rel_path, then insert."""
    now = utcnow().isoformat()
    meta_out = dict(meta or {})
    meta_out["dedupe_key"] = dedupe_key
    meta_json = json.dumps(meta_out, ensure_ascii=False)
    region = infer_region(folder, source_rel_path)
    exam_track = infer_exam_track(folder, source_rel_path, title)
    exam_year = infer_exam_year(title, source_rel_path, folder)

    with get_conn() as conn:
        conn.execute(
            "DELETE FROM suite_papers WHERE dedupe_key = %s OR source_rel_path = %s",
            (dedupe_key, source_rel_path),
        )
        conn.execute(
            """
            INSERT INTO suite_papers (
              id, source_rel_path, title, folder, created_at, meta_json, dedupe_key,
              region, exam_track, exam_year
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (paper_id, source_rel_path, title, folder, now, meta_json, dedupe_key, region, exam_track, exam_year),
        )
        for q in questions:
            meta_q = q.get("meta") if isinstance(q.get("meta"), dict) else {}
            major_mod = str(q.get("major_module") or "").strip()
            if not major_mod:
                major_mod = infer_major_module_for_question_row(
                    meta_q,
                    str(q.get("type_label") or ""),
                    str((meta_q.get("label") if isinstance(meta_q.get("label"), str) else "") or ""),
                )
            meta_ins = repair_question_meta_section_for_major_module(meta_q, major_mod)
            conn.execute(
                """
                INSERT INTO suite_questions (
                  id, paper_id, seq_no, question_no, stem, options, answer, analysis,
                  type_label, img_data, meta_json, major_module
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    q["id"],
                    paper_id,
                    int(q["seq_no"]),
                    str(q.get("question_no") or ""),
                    str(q.get("stem") or ""),
                    str(q.get("options") or ""),
                    str(q.get("answer") or ""),
                    str(q.get("analysis") or ""),
                    str(q.get("type_label") or ""),
                    str(q.get("img_data") or ""),
                    json.dumps(meta_ins, ensure_ascii=False),
                    major_mod,
                ),
            )


def migrate_suite_practice_records_schema() -> None:
    """套卷做题记录：子类型、云端会话 id、进行中状态（幂等）."""
    with get_conn() as conn:
        conn.execute(
            "ALTER TABLE suite_practice_records ADD COLUMN IF NOT EXISTS practice_subtype TEXT NOT NULL DEFAULT ''"
        )
        conn.execute(
            "ALTER TABLE suite_practice_records ADD COLUMN IF NOT EXISTS record_status TEXT NOT NULL DEFAULT ''"
        )
        conn.execute(
            "ALTER TABLE suite_practice_records ADD COLUMN IF NOT EXISTS client_session_id TEXT NOT NULL DEFAULT ''"
        )
        conn.execute(
            "ALTER TABLE suite_practice_records ADD COLUMN IF NOT EXISTS updated_at TEXT NOT NULL DEFAULT ''"
        )
        try:
            conn.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS idx_suite_practice_user_client_sess
                ON suite_practice_records(user_id, client_session_id)
                WHERE client_session_id <> ''
                """
            )
        except Exception as ex:
            _LOGGER.warning("suite practice client_session index: %s", ex)
        try:
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_suite_practice_user_subtype
                ON suite_practice_records(user_id, practice_subtype, updated_at DESC)
                """
            )
        except Exception as ex:
            _LOGGER.warning("suite practice subtype index: %s", ex)

        rows = conn.execute(
            "SELECT id, paper_id, payload_json, created_at, practice_subtype, record_status, updated_at FROM suite_practice_records"
        ).fetchall()
        for r in rows:
            d = dict(r)
            rid = str(d["id"])
            pid = str(d.get("paper_id") or "")
            subtype = str(d.get("practice_subtype") or "").strip()
            status = str(d.get("record_status") or "").strip()
            updated = str(d.get("updated_at") or "").strip()
            created = str(d.get("created_at") or "")
            if not subtype or not status or not updated:
                extra: dict[str, Any] = {}
                raw_p = d.get("payload_json")
                if raw_p:
                    try:
                        extra = json.loads(str(raw_p))
                    except json.JSONDecodeError:
                        extra = {}
                if not subtype:
                    subtype = str(extra.get("practice_subtype") or "").strip()
                    if not subtype:
                        subtype = (
                            SUITE_PRACTICE_SUBTYPE_MODULE
                            if pid == BANK_DRILL_PAPER_ID
                            else SUITE_PRACTICE_SUBTYPE_PAPER
                        )
                if not status:
                    status = str(extra.get("record_status") or "").strip() or SUITE_RECORD_STATUS_COMPLETED
                if not updated:
                    updated = str(extra.get("updated_at") or created or utcnow().isoformat())
                conn.execute(
                    """
                    UPDATE suite_practice_records
                    SET practice_subtype = %s, record_status = %s, updated_at = %s
                    WHERE id = %s
                    """,
                    (subtype, status, updated, rid),
                )
        conn.commit()


def normalize_practice_subtype(body: dict[str, Any]) -> str:
    raw = str(body.get("practice_subtype") or "").strip()
    if raw in (SUITE_PRACTICE_SUBTYPE_PAPER, SUITE_PRACTICE_SUBTYPE_MODULE):
        return raw
    pid = str(body.get("paper_id") or "").strip()
    if pid == BANK_DRILL_PAPER_ID:
        return SUITE_PRACTICE_SUBTYPE_MODULE
    return SUITE_PRACTICE_SUBTYPE_PAPER


def normalize_record_status(body: dict[str, Any]) -> str:
    raw = str(body.get("record_status") or "").strip()
    if raw == SUITE_RECORD_STATUS_IN_PROGRESS:
        return SUITE_RECORD_STATUS_IN_PROGRESS
    return SUITE_RECORD_STATUS_COMPLETED


def _practice_row_to_api(d: dict[str, Any]) -> dict[str, Any]:
    if d.get("payload_json"):
        try:
            d["payload"] = json.loads(str(d["payload_json"]))
        except json.JSONDecodeError:
            d["payload"] = {}
    else:
        d["payload"] = {}
    del d["payload_json"]
    subtype = str(d.get("practice_subtype") or "").strip()
    if not subtype:
        subtype = str(d.get("payload", {}).get("practice_subtype") or "").strip()
    if not subtype:
        subtype = (
            SUITE_PRACTICE_SUBTYPE_MODULE
            if str(d.get("paper_id") or "") == BANK_DRILL_PAPER_ID
            else SUITE_PRACTICE_SUBTYPE_PAPER
        )
    d["practice_subtype"] = subtype
    status = str(d.get("record_status") or "").strip()
    if not status:
        status = str(d.get("payload", {}).get("record_status") or SUITE_RECORD_STATUS_COMPLETED)
    d["record_status"] = status
    return d


def upsert_suite_practice_record(user_id: str, *, body: dict[str, Any]) -> str:
    """按 client_session_id 幂等写入；进行中/已完成均可，用于定时云端同步."""
    now = utcnow().isoformat()
    client_sid = str(body.get("client_session_id") or "").strip()
    subtype = normalize_practice_subtype(body)
    status = normalize_record_status(body)
    items = body.get("items") or []
    payload_out = dict(body)
    payload_out["items"] = items
    payload_out["practice_subtype"] = subtype
    payload_out["record_status"] = status
    payload_out["updated_at"] = now
    payload_json = json.dumps(payload_out, ensure_ascii=False)

    with get_conn() as conn:
        existing_id: str | None = None
        if client_sid:
            row = conn.execute(
                """
                SELECT id FROM suite_practice_records
                WHERE user_id = %s AND client_session_id = %s
                LIMIT 1
                """,
                (user_id, client_sid),
            ).fetchone()
            if row:
                existing_id = str(dict(row)["id"])

        vals = (
            str(body.get("paper_id") or ""),
            str(body.get("paper_title") or ""),
            str(body.get("paper_folder") or ""),
            str(body.get("mode") or "exam"),
            int(body.get("duration_sec") or 0),
            int(body.get("correct_count") or 0),
            int(body.get("wrong_count") or 0),
            int(body.get("unanswered_count") or 0),
            int(body.get("submitted_count") or 0),
            payload_json,
            subtype,
            status,
            client_sid,
            now,
        )

        if existing_id:
            conn.execute(
                """
                UPDATE suite_practice_records SET
                  paper_id = %s, paper_title = %s, paper_folder = %s, mode = %s,
                  duration_sec = %s, correct_count = %s, wrong_count = %s,
                  unanswered_count = %s, submitted_count = %s, payload_json = %s,
                  practice_subtype = %s, record_status = %s, client_session_id = %s, updated_at = %s
                WHERE id = %s AND user_id = %s
                """,
                (*vals, existing_id, user_id),
            )
            conn.commit()
            return existing_id

        rid = "spr_" + uuid.uuid4().hex[:26]
        conn.execute(
            """
            INSERT INTO suite_practice_records (
              id, user_id, paper_id, paper_title, paper_folder, mode,
              created_at, duration_sec, correct_count, wrong_count, unanswered_count,
              submitted_count, payload_json, practice_subtype, record_status,
              client_session_id, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                rid,
                user_id,
                vals[0],
                vals[1],
                vals[2],
                vals[3],
                now,
                vals[4],
                vals[5],
                vals[6],
                vals[7],
                vals[8],
                vals[9],
                vals[10],
                vals[11],
                client_sid,
                now,
            ),
        )
        conn.commit()
        return rid


def append_suite_practice_record(user_id: str, *, body: dict[str, Any]) -> str:
    """交卷存档：有 client_session_id 则更新同一会话，否则新建."""
    body = dict(body)
    if not str(body.get("record_status") or "").strip():
        body["record_status"] = SUITE_RECORD_STATUS_COMPLETED
    client_sid = str(body.get("client_session_id") or "").strip()
    if client_sid:
        return upsert_suite_practice_record(user_id, body=body)
    return upsert_suite_practice_record(user_id, body=body)


def list_suite_practice_records(
    user_id: str,
    *,
    limit: int = 40,
    paper_id: str | None = None,
    practice_subtype: str | None = None,
) -> list[dict[str, Any]]:
    lim = max(1, min(int(limit), 200))
    subtype = str(practice_subtype or "").strip()
    with get_conn() as conn:
        clauses = ["user_id = %s"]
        params: list[Any] = [user_id]
        if paper_id and str(paper_id).strip():
            clauses.append("paper_id = %s")
            params.append(str(paper_id).strip())
        if subtype in (SUITE_PRACTICE_SUBTYPE_PAPER, SUITE_PRACTICE_SUBTYPE_MODULE):
            clauses.append("practice_subtype = %s")
            params.append(subtype)
        where = " AND ".join(clauses)
        params.append(lim)
        rows = conn.execute(
            f"""
            SELECT id, paper_id, paper_title, paper_folder, mode, created_at,
                   duration_sec, correct_count, wrong_count, unanswered_count,
                   submitted_count, payload_json, practice_subtype, record_status,
                   client_session_id, updated_at
            FROM suite_practice_records
            WHERE {where}
            ORDER BY COALESCE(NULLIF(updated_at, ''), created_at) DESC
            LIMIT %s
            """,
            tuple(params),
        ).fetchall()
    return [_practice_row_to_api(dict(r)) for r in rows]
