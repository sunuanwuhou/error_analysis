from __future__ import annotations

import hashlib
import json
import re
import secrets
from typing import Any, Optional

from fastapi import APIRouter, Cookie, HTTPException, Query
from pydantic import BaseModel

from backend.core import extract_json_object, require_user
from backend.database import get_conn
from backend.security import utcnow

router = APIRouter(prefix="/api/shenlun", tags=["shenlun"])

# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class UpsertSourcePayload(BaseModel):
    question_text_raw: str
    material_text_raw: str
    node_id: Optional[str] = None
    paper_year: str = ""
    paper_province: str = ""
    paper_suite_type: str = ""


class PatchSourceNodePayload(BaseModel):
    node_id: str


class CreateAttemptPayload(BaseModel):
    source_id: str


class SaveAttemptPayload(BaseModel):
    segments: list[dict[str, Any]]
    my_final_summary: str


class PasteCCResultPayload(BaseModel):
    cc_raw: str  # Raw text/JSON pasted back from the AI


class HubNotePutPayload(BaseModel):
    """申论 Hub 知识点 Markdown 笔记（按 user + node 一行）。"""
    node_id: str = ""
    body_md: str = ""


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _source_key(question: str, material: str) -> str:
    """Stable dedup key: SHA-256 of normalized question+material."""
    text = "\n---\n".join([question.strip(), material.strip()])
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _split_segments(material: str) -> list[dict[str, Any]]:
    """Split material on blank lines, filter empties."""
    raw = re.split(r"\n{2,}", material.strip())
    return [
        {"index": i, "source_text": chunk.strip(), "my_extraction": "", "my_segment_summary": ""}
        for i, chunk in enumerate(raw)
        if chunk.strip()
    ]


def _row_to_source(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "question_text_raw": row["question_text_raw"],
        "material_text_raw": row["material_text_raw"],
        "status": row["status"],
        "node_id": str(row.get("node_id") or ""),
        "paper_year": str(row.get("paper_year") or ""),
        "paper_province": str(row.get("paper_province") or ""),
        "paper_suite_type": str(row.get("paper_suite_type") or ""),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _row_to_source_summary(row: dict[str, Any]) -> dict[str, Any]:
    data = _row_to_source(row)
    data["attempt_count"] = int(row.get("attempt_count") or 0)
    data["cc_success_count"] = int(row.get("cc_success_count") or 0)
    data["latest_cc_status"] = row.get("latest_cc_status") or None
    return data


def _recompute_source_status_after_attempt_change(conn: Any, source_id: str) -> None:
    """Keep shenlun_sources.status in sync with remaining attempts (multi-round)."""
    now = utcnow().isoformat()
    cnt_row = conn.execute(
        "SELECT COUNT(*)::int AS c FROM shenlun_attempts WHERE source_id = %s",
        (source_id,),
    ).fetchone()
    n = int(cnt_row["c"] if cnt_row else 0)
    if n == 0:
        conn.execute(
            "UPDATE shenlun_sources SET status = 'raw_draft', updated_at = %s WHERE id = %s",
            (now, source_id),
        )
        return

    latest = conn.execute(
        """
        SELECT cc_status FROM shenlun_attempts
        WHERE source_id = %s
        ORDER BY updated_at DESC
        LIMIT 1
        """,
        (source_id,),
    ).fetchone()

    cc = str(latest["cc_status"]) if latest else "none"
    next_status = "cc_done" if cc == "success" else "formatted"

    conn.execute(
        "UPDATE shenlun_sources SET status = %s, updated_at = %s WHERE id = %s",
        (next_status, now, source_id),
    )


def _row_to_attempt(row: dict[str, Any]) -> dict[str, Any]:
    segments = json.loads(row["segments_json"] or "[]")
    cc_result = None
    if row["cc_result_json"]:
        try:
            cc_result = json.loads(row["cc_result_json"])
        except Exception:
            cc_result = None
    return {
        "id": row["id"],
        "source_id": row["source_id"],
        "attempt_no": row["attempt_no"],
        "segments": segments,
        "my_final_summary": row["my_final_summary"],
        "cc_status": row["cc_status"],
        "cc_result_json": cc_result,
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


# ---------------------------------------------------------------------------
# CC prompt builder — 归纳概括
# ---------------------------------------------------------------------------

_ISSUE_TAG_OPTIONS = "要点遗漏 / 表述空泛 / 表述过虚 / 归类有误 / 照抄原文 / 理解偏差"

def _build_cc_prompt(question: str, segments: list[dict[str, Any]], final_summary: str) -> str:
    """Generate the structured prompt that the user copies into their AI."""
    lines: list[str] = []

    lines += [
        "你是申论阅卷专家，专注于「归纳概括」题型的批改。",
        "请逐段评价用户的提炼质量，并给出参考答案。",
        "",
        "══════════════════════",
        f"【题目】{question.strip()}",
        "══════════════════════",
        "",
    ]

    for seg in segments:
        idx = seg["index"] + 1
        lines += [
            f"【段落 {idx}】",
            seg["source_text"].strip(),
            "",
            f"【用户提炼 {idx}】",
            (seg.get("my_extraction") or "（未填写）").strip(),
            "",
        ]

    lines += [
        "【用户最终总结】",
        (final_summary or "（未填写）").strip(),
        "",
        "══════════════════════",
        "请返回纯 JSON，不要任何代码块标记；所有字符串值内如需引号请用中文直角引号「」，不要使用英文双引号嵌套。格式如下：",
        "",
        '{',
        '  "segments": [',
        '    {',
        '      "segment_index": 0,',
        '      "reference_extraction": "参考提炼（要点换行分隔）",',
        '      "matched_points": ["命中的要点"],',
        '      "missed_points": ["遗漏的要点"],',
        '      "wrong_points": ["有误的表述"],',
        f'      "issue_tags": ["从以下选择：{_ISSUE_TAG_OPTIONS}"],',
        '      "cc_comment": "简短点评 1-2 句"',
        '    }',
        '  ],',
        '  "reference_final_summary": "参考总结答案",',
        '  "overall_comment": "整体点评（100 字内）",',
        '  "overall_issue_tags": ["同上选项"]',
        '}',
        "",
        f"共 {len(segments)} 个段落，segments 数组下标从 0 开始，与上面段落一一对应。",
        "只返回 JSON，不要任何其他文字。",
    ]

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# CC result normalizer
# ---------------------------------------------------------------------------

def _to_str_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(v) for v in value if v]


def _segment_index_int(seg: dict[str, Any]) -> Optional[int]:
    v = seg.get("segment_index")
    if v is None:
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _normalize_cc_result(raw: dict[str, Any], segments: list[dict[str, Any]]) -> dict[str, Any]:
    """Ensure CC result has valid structure even if model output is partial."""
    seg_count = len(segments)
    raw_segs = raw.get("segments") if isinstance(raw.get("segments"), list) else []

    normalized_segs = []
    for i in range(seg_count):
        match = next(
            (s for s in raw_segs if isinstance(s, dict) and _segment_index_int(s) == i),
            None,
        )
        if match is None and i < len(raw_segs) and isinstance(raw_segs[i], dict):
            match = raw_segs[i]
        if match is None:
            match = {}
        normalized_segs.append({
            "segment_index": i,
            "source_segment_text": segments[i]["source_text"],
            "my_extraction": segments[i].get("my_extraction", ""),
            "reference_extraction": str(match.get("reference_extraction") or ""),
            "matched_points": _to_str_list(match.get("matched_points")),
            "missed_points": _to_str_list(match.get("missed_points")),
            "wrong_points": _to_str_list(match.get("wrong_points")),
            "issue_tags": _to_str_list(match.get("issue_tags")),
            "cc_comment": str(match.get("cc_comment") or ""),
        })

    return {
        "segments": normalized_segs,
        "reference_final_summary": str(raw.get("reference_final_summary") or ""),
        "overall_comment": str(raw.get("overall_comment") or ""),
        "overall_issue_tags": _to_str_list(raw.get("overall_issue_tags")),
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/hub-notes")
def get_hub_note(
    node_id: str = Query("", description="与题目列表相同：空串表示未分类"),
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    user_id: str = user["id"]
    nid = (node_id or "").strip()

    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT node_id, body_md, updated_at FROM shenlun_hub_notes
            WHERE user_id = %s AND node_id = %s
            """,
            (user_id, nid),
        ).fetchone()

    if not row:
        return {"node_id": nid, "body_md": "", "updated_at": ""}
    return {
        "node_id": str(row["node_id"]),
        "body_md": str(row["body_md"] or ""),
        "updated_at": str(row["updated_at"] or ""),
    }


@router.put("/hub-notes")
def put_hub_note(
    payload: HubNotePutPayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    user_id: str = user["id"]
    nid = (payload.node_id or "").strip()
    body = payload.body_md if isinstance(payload.body_md, str) else ""
    now = utcnow().isoformat()

    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO shenlun_hub_notes (user_id, node_id, body_md, updated_at)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (user_id, node_id) DO UPDATE SET
              body_md = EXCLUDED.body_md,
              updated_at = EXCLUDED.updated_at
            """,
            (user_id, nid, body, now),
        )
        row = conn.execute(
            """
            SELECT node_id, body_md, updated_at FROM shenlun_hub_notes
            WHERE user_id = %s AND node_id = %s
            """,
            (user_id, nid),
        ).fetchone()

    return {
        "node_id": str(row["node_id"]),
        "body_md": str(row["body_md"] or ""),
        "updated_at": str(row["updated_at"] or ""),
    }


@router.post("/sources")
def upsert_source(
    payload: UpsertSourcePayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    user_id: str = user["id"]

    if not payload.question_text_raw.strip() and not payload.material_text_raw.strip():
        raise HTTPException(status_code=422, detail="question or material required")

    key = _source_key(payload.question_text_raw, payload.material_text_raw)
    now = utcnow().isoformat()
    py = (payload.paper_year or "").strip()
    pp = (payload.paper_province or "").strip()
    pst = (payload.paper_suite_type or "").strip()

    with get_conn() as conn:
        existing = conn.execute(
            "SELECT * FROM shenlun_sources WHERE user_id = %s AND source_key = %s",
            (user_id, key),
        ).fetchone()

        if existing:
            if payload.node_id is not None:
                conn.execute(
                    """
                    UPDATE shenlun_sources
                    SET question_text_raw = %s,
                        material_text_raw = %s,
                        node_id = %s,
                        paper_year = %s,
                        paper_province = %s,
                        paper_suite_type = %s,
                        updated_at = %s
                    WHERE id = %s
                    """,
                    (
                        payload.question_text_raw,
                        payload.material_text_raw,
                        (payload.node_id or "").strip(),
                        py,
                        pp,
                        pst,
                        now,
                        existing["id"],
                    ),
                )
            else:
                conn.execute(
                    """
                    UPDATE shenlun_sources
                    SET question_text_raw = %s,
                        material_text_raw = %s,
                        paper_year = %s,
                        paper_province = %s,
                        paper_suite_type = %s,
                        updated_at = %s
                    WHERE id = %s
                    """,
                    (
                        payload.question_text_raw,
                        payload.material_text_raw,
                        py,
                        pp,
                        pst,
                        now,
                        existing["id"],
                    ),
                )
            row = conn.execute(
                "SELECT * FROM shenlun_sources WHERE id = %s", (existing["id"],)
            ).fetchone()
        else:
            new_id = secrets.token_hex(12)
            node_val = (payload.node_id or "").strip()
            conn.execute(
                """
                INSERT INTO shenlun_sources
                  (id, user_id, source_key, question_text_raw, material_text_raw,
                   status, node_id, paper_year, paper_province, paper_suite_type,
                   created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, 'raw_draft', %s, %s, %s, %s, %s, %s)
                """,
                (
                    new_id,
                    user_id,
                    key,
                    payload.question_text_raw,
                    payload.material_text_raw,
                    node_val,
                    py,
                    pp,
                    pst,
                    now,
                    now,
                ),
            )
            row = conn.execute(
                "SELECT * FROM shenlun_sources WHERE id = %s", (new_id,)
            ).fetchone()

    return _row_to_source(dict(row))


@router.get("/sources")
def list_sources(
    node_id: str = Query("", description="申论知识树节点 id；空字符串表示未分类"),
    q: str = Query("", description="题干或套卷信息关键词搜索"),
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    user_id: str = user["id"]

    needle = q.strip()
    where_extra = ""
    params_list: list[Any] = [user_id, node_id]
    if needle:
        pat = f"%{needle}%"
        where_extra = """ AND (
          s.question_text_raw ILIKE %s OR s.material_text_raw ILIKE %s
          OR s.paper_year ILIKE %s OR s.paper_province ILIKE %s OR s.paper_suite_type ILIKE %s
        )"""
        params_list.extend([pat, pat, pat, pat, pat])

    sql = f"""
            SELECT s.*,
              (SELECT COUNT(*)::int FROM shenlun_attempts a WHERE a.source_id = s.id)
                AS attempt_count,
              (SELECT COUNT(*)::int FROM shenlun_attempts a
                 WHERE a.source_id = s.id AND a.cc_status = 'success')
                AS cc_success_count,
              (SELECT a.cc_status FROM shenlun_attempts a
                 WHERE a.source_id = s.id ORDER BY a.updated_at DESC LIMIT 1)
                AS latest_cc_status
            FROM shenlun_sources s
            WHERE s.user_id = %s AND s.node_id = %s
            {where_extra}
            ORDER BY s.updated_at DESC
            """

    with get_conn() as conn:
        rows = conn.execute(sql, tuple(params_list)).fetchall()

    return {"items": [_row_to_source_summary(dict(r)) for r in rows]}


@router.get("/sources/{source_id}")
def get_source_detail(
    source_id: str,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    user_id: str = user["id"]

    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM shenlun_sources WHERE id = %s AND user_id = %s",
            (source_id, user_id),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="source not found")

        latest = conn.execute(
            """
            SELECT * FROM shenlun_attempts
            WHERE source_id = %s AND user_id = %s
            ORDER BY updated_at DESC
            LIMIT 1
            """,
            (source_id, user_id),
        ).fetchone()

    return {
        "source": _row_to_source(dict(row)),
        "latest_attempt": _row_to_attempt(dict(latest)) if latest else None,
    }


@router.get("/sources/{source_id}/attempts")
def list_attempts_for_source(
    source_id: str,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    """Lightweight history for workbench: rounds, status, timestamps."""
    user = require_user(xingce_session)
    user_id: str = user["id"]

    with get_conn() as conn:
        owned = conn.execute(
            "SELECT id FROM shenlun_sources WHERE id = %s AND user_id = %s",
            (source_id, user_id),
        ).fetchone()
        if not owned:
            raise HTTPException(status_code=404, detail="source not found")

        rows = conn.execute(
            """
            SELECT id, attempt_no, cc_status, created_at, updated_at
            FROM shenlun_attempts
            WHERE source_id = %s AND user_id = %s
            ORDER BY updated_at DESC
            """,
            (source_id, user_id),
        ).fetchall()

    items = [dict(r) for r in rows]
    return {"items": items}


@router.delete("/sources/{source_id}")
def delete_source(
    source_id: str,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    user_id: str = user["id"]

    with get_conn() as conn:
        res = conn.execute(
            "DELETE FROM shenlun_sources WHERE id = %s AND user_id = %s RETURNING id",
            (source_id, user_id),
        ).fetchone()
        if not res:
            raise HTTPException(status_code=404, detail="source not found")

    return {"ok": True, "id": source_id}


@router.patch("/sources/{source_id}")
def patch_source_node(
    source_id: str,
    payload: PatchSourceNodePayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    user_id: str = user["id"]
    now = utcnow().isoformat()

    with get_conn() as conn:
        existing = conn.execute(
            "SELECT id FROM shenlun_sources WHERE id = %s AND user_id = %s",
            (source_id, user_id),
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="source not found")

        conn.execute(
            """
            UPDATE shenlun_sources
            SET node_id = %s, updated_at = %s
            WHERE id = %s
            """,
            ((payload.node_id or "").strip(), now, source_id),
        )
        row = conn.execute(
            "SELECT * FROM shenlun_sources WHERE id = %s", (source_id,)
        ).fetchone()

    return _row_to_source(dict(row))


@router.post("/attempts")
def create_attempt(
    payload: CreateAttemptPayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    user_id: str = user["id"]

    with get_conn() as conn:
        source = conn.execute(
            "SELECT * FROM shenlun_sources WHERE id = %s AND user_id = %s",
            (payload.source_id, user_id),
        ).fetchone()
        if not source:
            raise HTTPException(status_code=404, detail="source not found")

        reopen = conn.execute(
            """
            SELECT * FROM shenlun_attempts
            WHERE source_id = %s AND user_id = %s AND cc_status <> %s
            ORDER BY updated_at DESC
            LIMIT 1
            """,
            (payload.source_id, user_id, "success"),
        ).fetchone()
        if reopen:
            return _row_to_attempt(dict(reopen))

        segments = _split_segments(source["material_text_raw"])

        count = conn.execute(
            "SELECT COUNT(*) AS cnt FROM shenlun_attempts WHERE source_id = %s",
            (payload.source_id,),
        ).fetchone()["cnt"]
        attempt_no = count + 1

        now = utcnow().isoformat()
        new_id = secrets.token_hex(12)
        conn.execute(
            """
            INSERT INTO shenlun_attempts
              (id, source_id, user_id, attempt_no, segments_json, my_final_summary,
               cc_status, cc_result_json, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, '', 'none', '', %s, %s)
            """,
            (new_id, payload.source_id, user_id, attempt_no,
             json.dumps(segments, ensure_ascii=False), now, now),
        )
        conn.execute(
            "UPDATE shenlun_sources SET status = 'formatted', updated_at = %s WHERE id = %s",
            (now, payload.source_id),
        )
        row = conn.execute(
            "SELECT * FROM shenlun_attempts WHERE id = %s", (new_id,)
        ).fetchone()

    return _row_to_attempt(row)


@router.patch("/attempts/{attempt_id}")
def save_attempt(
    attempt_id: str,
    payload: SaveAttemptPayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    user_id: str = user["id"]

    with get_conn() as conn:
        existing = conn.execute(
            "SELECT * FROM shenlun_attempts WHERE id = %s AND user_id = %s",
            (attempt_id, user_id),
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="attempt not found")
        if existing["cc_status"] == "success":
            raise HTTPException(status_code=409, detail="attempt already completed")

        stored_segments: list[dict[str, Any]] = json.loads(existing["segments_json"] or "[]")
        extraction_map = {
            s["index"]: s.get("my_extraction", "")
            for s in payload.segments
            if isinstance(s, dict)
        }
        summary_map = {
            s["index"]: s.get("my_segment_summary", "")
            for s in payload.segments
            if isinstance(s, dict)
        }
        for seg in stored_segments:
            if seg["index"] in extraction_map:
                seg["my_extraction"] = extraction_map[seg["index"]]
            if seg["index"] in summary_map:
                seg["my_segment_summary"] = summary_map[seg["index"]]

        now = utcnow().isoformat()
        conn.execute(
            """
            UPDATE shenlun_attempts
            SET segments_json = %s,
                my_final_summary = %s,
                updated_at = %s
            WHERE id = %s
            """,
            (json.dumps(stored_segments, ensure_ascii=False), payload.my_final_summary, now, attempt_id),
        )
        row = conn.execute(
            "SELECT * FROM shenlun_attempts WHERE id = %s", (attempt_id,)
        ).fetchone()

    return _row_to_attempt(row)


@router.delete("/attempts/{attempt_id}")
def delete_attempt(
    attempt_id: str,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    """Remove one practice round; recomputes shenlun_sources.status for list/workbench."""
    user = require_user(xingce_session)
    user_id: str = user["id"]

    with get_conn() as conn:
        row = conn.execute(
            "SELECT source_id FROM shenlun_attempts WHERE id = %s AND user_id = %s",
            (attempt_id, user_id),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="attempt not found")
        source_id = str(row["source_id"])

        conn.execute(
            "DELETE FROM shenlun_attempts WHERE id = %s AND user_id = %s",
            (attempt_id, user_id),
        )
        _recompute_source_status_after_attempt_change(conn, source_id)

    return {"ok": True, "id": attempt_id, "source_id": source_id}


@router.get("/attempts/{attempt_id}/cc-prompt")
def get_cc_prompt(
    attempt_id: str,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    """Return the structured prompt text that the user copies into their AI."""
    user = require_user(xingce_session)
    user_id: str = user["id"]

    with get_conn() as conn:
        attempt = conn.execute(
            "SELECT a.*, s.question_text_raw FROM shenlun_attempts a "
            "JOIN shenlun_sources s ON s.id = a.source_id "
            "WHERE a.id = %s AND a.user_id = %s",
            (attempt_id, user_id),
        ).fetchone()
        if not attempt:
            raise HTTPException(status_code=404, detail="attempt not found")

    segments: list[dict[str, Any]] = json.loads(attempt["segments_json"] or "[]")
    prompt = _build_cc_prompt(
        question=attempt["question_text_raw"],
        segments=segments,
        final_summary=attempt["my_final_summary"],
    )
    return {"attempt_id": attempt_id, "prompt": prompt}


@router.post("/attempts/{attempt_id}/paste-cc-result")
def paste_cc_result(
    attempt_id: str,
    payload: PasteCCResultPayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    """Accept the JSON text that the user pasted back from their AI."""
    user = require_user(xingce_session)
    user_id: str = user["id"]

    with get_conn() as conn:
        attempt = conn.execute(
            "SELECT a.*, s.question_text_raw FROM shenlun_attempts a "
            "JOIN shenlun_sources s ON s.id = a.source_id "
            "WHERE a.id = %s AND a.user_id = %s",
            (attempt_id, user_id),
        ).fetchone()
        if not attempt:
            raise HTTPException(status_code=404, detail="attempt not found")

        segments: list[dict[str, Any]] = json.loads(attempt["segments_json"] or "[]")

    # Parse and normalize the pasted JSON
    try:
        raw = extract_json_object(payload.cc_raw)
        result = _normalize_cc_result(raw, segments)
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"无法解析 AI 返回的 JSON，请确认粘贴内容正确。错误：{exc}",
        ) from exc

    now = utcnow().isoformat()
    with get_conn() as conn:
        conn.execute(
            """
            UPDATE shenlun_attempts
            SET cc_status = 'success',
                cc_result_json = %s,
                updated_at = %s
            WHERE id = %s
            """,
            (json.dumps(result, ensure_ascii=False), now, attempt_id),
        )
        conn.execute(
            "UPDATE shenlun_sources SET status = 'cc_done', updated_at = %s WHERE id = %s",
            (now, attempt["source_id"]),
        )
        row = conn.execute(
            "SELECT * FROM shenlun_attempts WHERE id = %s", (attempt_id,)
        ).fetchone()

    return _row_to_attempt(row)


@router.get("/attempts/{attempt_id}")
def get_attempt(
    attempt_id: str,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    user_id: str = user["id"]

    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT a.*, s.node_id AS source_node_id
            FROM shenlun_attempts a
            INNER JOIN shenlun_sources s ON s.id = a.source_id AND s.user_id = %s
            WHERE a.id = %s AND a.user_id = %s
            """,
            (user_id, attempt_id, user_id),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="attempt not found")

    row_d = dict(row)
    out = _row_to_attempt(row_d)
    out["source_node_id"] = str(row_d.get("source_node_id") or "")
    return out
