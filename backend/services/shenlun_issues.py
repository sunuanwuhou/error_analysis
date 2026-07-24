from __future__ import annotations

import hashlib
import json
from typing import Any, Optional

_STANDARD_TAGS = (
    "要点遗漏",
    "表述空泛",
    "表述过虚",
    "归类有误",
    "照抄原文",
    "理解偏差",
)


def normalize_issue_tag(raw: str) -> str:
    t = (raw or "").strip()
    if not t:
        return "其他"
    for std in _STANDARD_TAGS:
        if std in t:
            return std
    return t if len(t) <= 24 else t[:24]


def question_preview(text: str, max_len: int = 80) -> str:
    s = " ".join((text or "").split())
    if not s:
        return "（无题干）"
    return s if len(s) <= max_len else f"{s[: max_len - 1]}…"


def _entry_id(attempt_id: str, scope: str, segment_index: Optional[int], tag: str) -> str:
    seg = "overall" if segment_index is None else str(segment_index)
    key = f"{attempt_id}:{scope}:{seg}:{tag}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:24]


def flatten_cc_result_to_entries(
    *,
    user_id: str,
    node_id: str,
    source_id: str,
    attempt_id: str,
    attempt_no: int,
    question_text: str,
    paper_year: str,
    paper_province: str,
    paper_suite_type: str,
    cc_result: dict[str, Any],
    detected_at: str,
    created_at: str,
) -> list[dict[str, Any]]:
    """Turn normalized cc_result_json into flat issue rows (one row per tag)."""
    preview = question_preview(question_text)
    py = (paper_year or "").strip()
    pp = (paper_province or "").strip()
    pst = (paper_suite_type or "").strip()
    entries: list[dict[str, Any]] = []
    seen: set[str] = set()

    def append_entry(
        scope: str,
        segment_index: Optional[int],
        tag: str,
        missed: list[str],
        wrong: list[str],
        comment: str,
    ) -> None:
        norm_tag = normalize_issue_tag(tag)
        eid = _entry_id(attempt_id, scope, segment_index, norm_tag)
        if eid in seen:
            return
        seen.add(eid)
        entries.append(
            {
                "id": eid,
                "user_id": user_id,
                "node_id": (node_id or "").strip(),
                "source_id": source_id,
                "attempt_id": attempt_id,
                "attempt_no": attempt_no,
                "scope": scope,
                "segment_index": segment_index,
                "issue_tag": norm_tag,
                "missed_points_json": json.dumps(missed[:12], ensure_ascii=False),
                "wrong_points_json": json.dumps(wrong[:12], ensure_ascii=False),
                "cc_comment": (comment or "").strip()[:500],
                "question_preview": preview,
                "paper_year": py,
                "paper_province": pp,
                "paper_suite_type": pst,
                "detected_at": detected_at,
                "status": "open",
                "created_at": created_at,
            }
        )

    segments = cc_result.get("segments") if isinstance(cc_result.get("segments"), list) else []
    for seg in segments:
        if not isinstance(seg, dict):
            continue
        try:
            seg_idx = int(seg.get("segment_index", 0))
        except (TypeError, ValueError):
            seg_idx = 0
        tags = seg.get("issue_tags") if isinstance(seg.get("issue_tags"), list) else []
        missed = [str(x) for x in (seg.get("missed_points") or []) if x]
        wrong = [str(x) for x in (seg.get("wrong_points") or []) if x]
        comment = str(seg.get("cc_comment") or "")
        if not tags and (missed or wrong):
            tags = ["要点遗漏"]
        for tag in tags:
            append_entry("segment", seg_idx, str(tag), missed, wrong, comment)

    overall_tags = (
        cc_result.get("overall_issue_tags")
        if isinstance(cc_result.get("overall_issue_tags"), list)
        else []
    )
    overall_comment = str(cc_result.get("overall_comment") or "")
    if not overall_tags and overall_comment.strip():
        overall_tags = ["其他"]
    for tag in overall_tags:
        append_entry("overall", None, str(tag), [], [], overall_comment)

    return entries


def delete_issue_entries_for_attempt(conn: Any, attempt_id: str) -> None:
    conn.execute(
        "DELETE FROM shenlun_issue_entries WHERE attempt_id = %s",
        (attempt_id,),
    )


def sync_issue_entries_for_attempt(
    conn: Any,
    *,
    attempt_row: dict[str, Any],
    source_row: dict[str, Any],
    cc_result: dict[str, Any],
) -> int:
    """Replace all issue rows for one attempt. Returns inserted count."""
    attempt_id = str(attempt_row["id"])
    delete_issue_entries_for_attempt(conn, attempt_id)

    detected_at = str(attempt_row.get("updated_at") or attempt_row.get("created_at") or "")
    created_at = detected_at
    entries = flatten_cc_result_to_entries(
        user_id=str(attempt_row["user_id"]),
        node_id=str(source_row.get("node_id") or ""),
        source_id=str(attempt_row["source_id"]),
        attempt_id=attempt_id,
        attempt_no=int(attempt_row.get("attempt_no") or 1),
        question_text=str(source_row.get("question_text_raw") or ""),
        paper_year=str(source_row.get("paper_year") or ""),
        paper_province=str(source_row.get("paper_province") or ""),
        paper_suite_type=str(source_row.get("paper_suite_type") or ""),
        cc_result=cc_result,
        detected_at=detected_at,
        created_at=created_at,
    )
    for row in entries:
        conn.execute(
            """
            INSERT INTO shenlun_issue_entries (
              id, user_id, node_id, source_id, attempt_id, attempt_no,
              scope, segment_index, issue_tag,
              missed_points_json, wrong_points_json, cc_comment,
              question_preview, paper_year, paper_province, paper_suite_type,
              detected_at, status, created_at
            ) VALUES (
              %s, %s, %s, %s, %s, %s,
              %s, %s, %s,
              %s, %s, %s,
              %s, %s, %s, %s,
              %s, %s, %s
            )
            """,
            (
                row["id"],
                row["user_id"],
                row["node_id"],
                row["source_id"],
                row["attempt_id"],
                row["attempt_no"],
                row["scope"],
                row["segment_index"],
                row["issue_tag"],
                row["missed_points_json"],
                row["wrong_points_json"],
                row["cc_comment"],
                row["question_preview"],
                row["paper_year"],
                row["paper_province"],
                row["paper_suite_type"],
                row["detected_at"],
                row["status"],
                row["created_at"],
            ),
        )
    return len(entries)


def row_to_issue_entry(row: dict[str, Any]) -> dict[str, Any]:
    missed: list[str] = []
    wrong: list[str] = []
    try:
        missed = json.loads(row.get("missed_points_json") or "[]")
    except Exception:
        missed = []
    try:
        wrong = json.loads(row.get("wrong_points_json") or "[]")
    except Exception:
        wrong = []
    if not isinstance(missed, list):
        missed = []
    if not isinstance(wrong, list):
        wrong = []
    seg_idx = row.get("segment_index")
    return {
        "id": row["id"],
        "node_id": str(row.get("node_id") or ""),
        "source_id": row["source_id"],
        "attempt_id": row["attempt_id"],
        "attempt_no": int(row.get("attempt_no") or 1),
        "scope": row["scope"],
        "segment_index": int(seg_idx) if seg_idx is not None else None,
        "issue_tag": row["issue_tag"],
        "missed_points": [str(x) for x in missed if x],
        "wrong_points": [str(x) for x in wrong if x],
        "cc_comment": str(row.get("cc_comment") or ""),
        "question_preview": str(row.get("question_preview") or ""),
        "paper_year": str(row.get("paper_year") or ""),
        "paper_province": str(row.get("paper_province") or ""),
        "paper_suite_type": str(row.get("paper_suite_type") or ""),
        "detected_at": row["detected_at"],
        "status": str(row.get("status") or "open"),
    }
