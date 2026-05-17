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

_LOGGER = logging.getLogger(__name__)


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
            SELECT id, seq_no, question_no, stem, options, answer, analysis, type_label, img_data, meta_json
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

    with get_conn() as conn:
        conn.execute(
            "DELETE FROM suite_papers WHERE dedupe_key = %s OR source_rel_path = %s",
            (dedupe_key, source_rel_path),
        )
        conn.execute(
            """
            INSERT INTO suite_papers (id, source_rel_path, title, folder, created_at, meta_json, dedupe_key)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (paper_id, source_rel_path, title, folder, now, meta_json, dedupe_key),
        )
        for q in questions:
            conn.execute(
                """
                INSERT INTO suite_questions (
                  id, paper_id, seq_no, question_no, stem, options, answer, analysis,
                  type_label, img_data, meta_json
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                    json.dumps(q.get("meta") or {}, ensure_ascii=False),
                ),
            )


def append_suite_practice_record(user_id: str, *, body: dict[str, Any]) -> str:
    """Persist one 做题 session summary (exam mode). payload_json mirrors body including items[]."""
    rid = "spr_" + uuid.uuid4().hex[:26]
    now = utcnow().isoformat()
    items = body.get("items") or []
    payload_out = dict(body)
    payload_out["items"] = items
    payload_json = json.dumps(payload_out, ensure_ascii=False)
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO suite_practice_records (
              id, user_id, paper_id, paper_title, paper_folder, mode,
              created_at, duration_sec, correct_count, wrong_count, unanswered_count,
              submitted_count, payload_json
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                rid,
                user_id,
                str(body.get("paper_id") or ""),
                str(body.get("paper_title") or ""),
                str(body.get("paper_folder") or ""),
                str(body.get("mode") or "exam"),
                now,
                int(body.get("duration_sec") or 0),
                int(body.get("correct_count") or 0),
                int(body.get("wrong_count") or 0),
                int(body.get("unanswered_count") or 0),
                int(body.get("submitted_count") or 0),
                payload_json,
            ),
        )
    return rid


def list_suite_practice_records(
    user_id: str,
    *,
    limit: int = 40,
    paper_id: str | None = None,
) -> list[dict[str, Any]]:
    lim = max(1, min(int(limit), 200))
    with get_conn() as conn:
        if paper_id and str(paper_id).strip():
            rows = conn.execute(
                """
                SELECT id, paper_id, paper_title, paper_folder, mode, created_at,
                       duration_sec, correct_count, wrong_count, unanswered_count,
                       submitted_count, payload_json
                FROM suite_practice_records
                WHERE user_id = %s AND paper_id = %s
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (user_id, str(paper_id).strip(), lim),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT id, paper_id, paper_title, paper_folder, mode, created_at,
                       duration_sec, correct_count, wrong_count, unanswered_count,
                       submitted_count, payload_json
                FROM suite_practice_records
                WHERE user_id = %s
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (user_id, lim),
            ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        if d.get("payload_json"):
            try:
                extra = json.loads(str(d["payload_json"]))
                d["payload"] = extra
            except json.JSONDecodeError:
                d["payload"] = {}
        else:
            d["payload"] = {}
        del d["payload_json"]
        out.append(d)
    return out
