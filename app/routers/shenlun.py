from __future__ import annotations

import hashlib
import json
import re
import secrets
from typing import Any, Optional

from fastapi import APIRouter, Cookie, HTTPException
from pydantic import BaseModel

from app.core import extract_json_object, require_user
from app.database import get_conn
from app.security import utcnow

router = APIRouter(prefix="/api/shenlun", tags=["shenlun"])

# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class UpsertSourcePayload(BaseModel):
    question_text_raw: str
    material_text_raw: str


class CreateAttemptPayload(BaseModel):
    source_id: str


class SaveAttemptPayload(BaseModel):
    segments: list[dict[str, Any]]
    my_final_summary: str


class PasteCCResultPayload(BaseModel):
    cc_raw: str  # Raw text/JSON pasted back from the AI


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
        {"index": i, "source_text": chunk.strip(), "my_extraction": ""}
        for i, chunk in enumerate(raw)
        if chunk.strip()
    ]


def _row_to_source(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "question_text_raw": row["question_text_raw"],
        "material_text_raw": row["material_text_raw"],
        "status": row["status"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


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
            f"【材料段落 {idx}】",
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
        "请返回纯 JSON，不要任何代码块标记，格式如下：",
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


def _normalize_cc_result(raw: dict[str, Any], segments: list[dict[str, Any]]) -> dict[str, Any]:
    """Ensure CC result has valid structure even if model output is partial."""
    seg_count = len(segments)
    raw_segs = raw.get("segments") if isinstance(raw.get("segments"), list) else []

    normalized_segs = []
    for i in range(seg_count):
        match = next((s for s in raw_segs if isinstance(s, dict) and s.get("segment_index") == i), None)
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

    with get_conn() as conn:
        existing = conn.execute(
            "SELECT * FROM shenlun_sources WHERE user_id = %s AND source_key = %s",
            (user_id, key),
        ).fetchone()

        if existing:
            conn.execute(
                """
                UPDATE shenlun_sources
                SET question_text_raw = %s,
                    material_text_raw = %s,
                    updated_at = %s
                WHERE id = %s
                """,
                (payload.question_text_raw, payload.material_text_raw, now, existing["id"]),
            )
            row = conn.execute(
                "SELECT * FROM shenlun_sources WHERE id = %s", (existing["id"],)
            ).fetchone()
        else:
            new_id = secrets.token_hex(12)
            conn.execute(
                """
                INSERT INTO shenlun_sources
                  (id, user_id, source_key, question_text_raw, material_text_raw, status, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, 'raw_draft', %s, %s)
                """,
                (new_id, user_id, key, payload.question_text_raw, payload.material_text_raw, now, now),
            )
            row = conn.execute(
                "SELECT * FROM shenlun_sources WHERE id = %s", (new_id,)
            ).fetchone()

    return _row_to_source(row)


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
        for seg in stored_segments:
            if seg["index"] in extraction_map:
                seg["my_extraction"] = extraction_map[seg["index"]]

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
            "SELECT * FROM shenlun_attempts WHERE id = %s AND user_id = %s",
            (attempt_id, user_id),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="attempt not found")

    return _row_to_attempt(row)
