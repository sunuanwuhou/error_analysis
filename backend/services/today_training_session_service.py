from __future__ import annotations

import json
import secrets
from dataclasses import dataclass
from typing import Any

from backend.database import get_conn
from backend.security import utcnow
from backend.services.practice_query_service import read_attempt_behavior_map
from backend.services.snapshot_service import get_backup_errors
from backend.services.today_training_service import build_today_training_queue


@dataclass(frozen=True)
class TodaySessionConfig:
    default_limit: int = 30
    max_limit: int = 60


def _normalize_limit(limit: int | None, cfg: TodaySessionConfig) -> int:
    if limit is None:
        return cfg.default_limit
    return max(1, min(int(limit), cfg.max_limit))


def _normalize_id_list(values: list[Any], max_size: int = 5000) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for raw in values or []:
        value = str(raw or "").strip()
        if not value or value in seen:
            continue
        seen.add(value)
        result.append(value)
        if len(result) >= max_size:
            break
    return result


def _collect_attempt_filter_ids(errors: list[dict[str, Any]]) -> tuple[list[str], list[str]]:
    error_ids = _normalize_id_list([item.get("id") for item in errors])
    question_ids = _normalize_id_list([item.get("questionId") or item.get("id") for item in errors])
    return error_ids, question_ids


def _fetch_attempt_rows(user_id: str, error_ids: list[str], question_ids: list[str], limit: int = 2000) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with get_conn() as conn:
        if error_ids:
            sql = (
                "SELECT id, error_id, question_id, result, created_at, updated_at FROM practice_attempts "
                "WHERE user_id=? AND error_id IN (" + ",".join("?" for _ in error_ids) + ") "
                "ORDER BY updated_at DESC, created_at DESC, id DESC LIMIT ?"
            )
            fetched = conn.execute(sql, (user_id, *error_ids, max(1, min(limit, 6000)))).fetchall()
            rows.extend(dict(row) for row in fetched)
        if question_ids:
            sql = (
                "SELECT id, error_id, question_id, result, created_at, updated_at FROM practice_attempts "
                "WHERE user_id=? AND question_id IN (" + ",".join("?" for _ in question_ids) + ") "
                "ORDER BY updated_at DESC, created_at DESC, id DESC LIMIT ?"
            )
            fetched = conn.execute(sql, (user_id, *question_ids, max(1, min(limit, 6000)))).fetchall()
            rows.extend(dict(row) for row in fetched)
    dedup: dict[str, dict[str, Any]] = {}
    for row in rows:
        row_id = str(row.get("id") or "").strip()
        if not row_id:
            continue
        current = dedup.get(row_id)
        key = (str(row.get("updated_at") or ""), str(row.get("created_at") or ""), row_id)
        if not current:
            dedup[row_id] = row
            continue
        old_key = (str(current.get("updated_at") or ""), str(current.get("created_at") or ""), row_id)
        if key > old_key:
            dedup[row_id] = row
    return sorted(
        dedup.values(),
        key=lambda item: (str(item.get("updated_at") or ""), str(item.get("created_at") or ""), str(item.get("id") or "")),
        reverse=True,
    )[: max(1, min(limit, 6000))]


def _get_today_session_row(user_id: str, today: str) -> dict[str, Any] | None:
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT * FROM today_training_sessions
            WHERE user_id=? AND session_date=?
            LIMIT 1
            """,
            (user_id, today),
        ).fetchone()
    return dict(row) if row else None


def _load_session_items(session_id: str) -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT * FROM today_training_session_items
            WHERE session_id=?
            ORDER BY seq_no ASC
            """,
            (session_id,),
        ).fetchall()
    result: list[dict[str, Any]] = []
    for row in rows:
        item = dict(row)
        item["payload"] = json.loads(item.get("payload_json") or "{}")
        result.append(item)
    return result


def _serialize_session(row: dict[str, Any], items: list[dict[str, Any]]) -> dict[str, Any]:
    total = int(row.get("total_count") or 0)
    completed = int(row.get("completed_count") or 0)
    current_index = int(row.get("current_index") or 0)
    pending_item = next((item for item in items if str(item.get("status")) == "pending"), None)
    next_question = pending_item.get("payload") if pending_item else None
    return {
        "sessionId": row.get("id"),
        "date": row.get("session_date"),
        "status": row.get("status"),
        "totalCount": total,
        "completedCount": completed,
        "remainingCount": max(total - completed, 0),
        "currentIndex": current_index,
        "nextItemId": pending_item.get("id") if pending_item else "",
        "nextQuestion": next_question,
        # Keep response lightweight: client advances question-by-question.
        "queue": [],
        "queueSize": len(items),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }


def _create_today_session(user_id: str, today: str, limit: int, cfg: TodaySessionConfig) -> dict[str, Any]:
    errors = get_backup_errors(user_id)
    error_ids, question_ids = _collect_attempt_filter_ids(errors)
    behavior_map = read_attempt_behavior_map(
        user_id,
        error_ids=error_ids,
        question_ids=question_ids,
        limit=max(len(errors) * 6, 240),
    )
    attempt_rows = _fetch_attempt_rows(user_id, error_ids=error_ids, question_ids=question_ids, limit=max(len(errors) * 10, 300))
    queue = build_today_training_queue(
        errors,
        behavior_map,
        attempt_rows,
        _normalize_limit(limit, cfg),
        shuffle_seed=today,
    )
    now = utcnow().isoformat()
    session_id = secrets.token_hex(12)
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO today_training_sessions(
              id, user_id, session_date, status, total_count, completed_count, current_index,
              created_at, updated_at, paused_at, finished_at, meta_json
            ) VALUES(?, ?, ?, 'in_progress', ?, 0, 0, ?, ?, '', '', ?)
            ON CONFLICT(user_id, session_date) DO UPDATE SET
              status='in_progress',
              total_count=excluded.total_count,
              completed_count=0,
              current_index=0,
              updated_at=excluded.updated_at,
              paused_at='',
              finished_at='',
              meta_json=excluded.meta_json
            """,
            (session_id, user_id, today, len(queue), now, now, json.dumps({"limit": limit}, ensure_ascii=False)),
        )
        row = conn.execute(
            "SELECT * FROM today_training_sessions WHERE user_id=? AND session_date=? LIMIT 1",
            (user_id, today),
        ).fetchone()
        session_row = dict(row) if row else {}
        session_id = str(session_row.get("id") or session_id)
        conn.execute("DELETE FROM today_training_session_items WHERE session_id=?", (session_id,))
        for index, item in enumerate(queue, start=1):
            error_id = str(item.get("id") or "")
            question_id = str(item.get("questionId") or error_id)
            item_id = secrets.token_hex(10)
            conn.execute(
                """
                INSERT INTO today_training_session_items(
                  id, session_id, user_id, seq_no, error_id, question_id, status, queue_score,
                  payload_json, answered_at, created_at, updated_at
                ) VALUES(?, ?, ?, ?, ?, ?, 'pending', ?, ?, '', ?, ?)
                """,
                (
                    item_id,
                    session_id,
                    user_id,
                    index,
                    error_id,
                    question_id,
                    int(item.get("practiceScore") or 0),
                    json.dumps(item, ensure_ascii=False),
                    now,
                    now,
                ),
            )
    items = _load_session_items(session_id)
    return _serialize_session(session_row, items)


def _build_today_queue(user_id: str, limit: int, *, exclude_error_ids: set[str] | None = None) -> list[dict[str, Any]]:
    errors = get_backup_errors(user_id)
    error_ids, question_ids = _collect_attempt_filter_ids(errors)
    behavior_map = read_attempt_behavior_map(
        user_id,
        error_ids=error_ids,
        question_ids=question_ids,
        limit=max(len(errors) * 6, 240),
    )
    attempt_rows = _fetch_attempt_rows(user_id, error_ids=error_ids, question_ids=question_ids, limit=max(len(errors) * 10, 300))
    return build_today_training_queue(
        errors,
        behavior_map,
        attempt_rows,
        limit,
        exclude_error_ids=exclude_error_ids,
        shuffle_seed=utcnow().date().isoformat(),
    )


def _expand_today_session(user_id: str, row: dict[str, Any], target_limit: int) -> dict[str, Any]:
    session_id = str(row.get("id") or "")
    if not session_id:
        return row
    items = _load_session_items(session_id)
    existing_error_ids = {str(item.get("error_id") or "").strip() for item in items if str(item.get("error_id") or "").strip()}
    if len(items) >= target_limit:
        return row
    queue = _build_today_queue(user_id, target_limit, exclude_error_ids=existing_error_ids)
    extra_items = [item for item in queue if str(item.get("id") or "").strip() not in existing_error_ids]
    now = utcnow().isoformat()
    seq_no = len(items)
    with get_conn() as conn:
        for item in extra_items:
            if seq_no >= target_limit:
                break
            seq_no += 1
            error_id = str(item.get("id") or "")
            question_id = str(item.get("questionId") or error_id)
            item_id = secrets.token_hex(10)
            conn.execute(
                """
                INSERT INTO today_training_session_items(
                  id, session_id, user_id, seq_no, error_id, question_id, status, queue_score,
                  payload_json, answered_at, created_at, updated_at
                ) VALUES(?, ?, ?, ?, ?, ?, 'pending', ?, ?, '', ?, ?)
                """,
                (
                    item_id,
                    session_id,
                    user_id,
                    seq_no,
                    error_id,
                    question_id,
                    int(item.get("practiceScore") or 0),
                    json.dumps(item, ensure_ascii=False),
                    now,
                    now,
                ),
            )
        conn.execute(
            "UPDATE today_training_sessions SET total_count=?, updated_at=? WHERE id=? AND user_id=?",
            (seq_no, now, session_id, user_id),
        )
    updated = _get_today_session_row(user_id, utcnow().date().isoformat())
    return updated or row


def start_or_resume_today_session(user_id: str, limit: int | None = None) -> dict[str, Any]:
    cfg = TodaySessionConfig()
    today = utcnow().date().isoformat()
    target_limit = _normalize_limit(limit, cfg)
    row = _get_today_session_row(user_id, today)
    if not row:
        return _create_today_session(user_id, today, target_limit, cfg)
    items = _load_session_items(str(row.get("id") or ""))
    current_total = int(row.get("total_count") or 0)
    current_completed = int(row.get("completed_count") or 0)
    if str(row.get("status") or "") in {"in_progress", "paused"} and current_total < target_limit:
        if current_completed == 0 and not items:
            return _create_today_session(user_id, today, target_limit, cfg)
        row = _expand_today_session(user_id, row, target_limit)
        items = _load_session_items(str(row.get("id") or ""))
    elif str(row.get("status") or "") == "done":
        return _serialize_session(row, items)
    now = utcnow().isoformat()
    with get_conn() as conn:
        conn.execute(
            "UPDATE today_training_sessions SET status='in_progress', updated_at=?, paused_at='' WHERE id=? AND user_id=?",
            (now, row["id"], user_id),
        )
    row["status"] = "in_progress"
    row["updated_at"] = now
    row["paused_at"] = ""
    return _serialize_session(row, items)


def get_today_session(user_id: str) -> dict[str, Any]:
    today = utcnow().date().isoformat()
    row = _get_today_session_row(user_id, today)
    if not row:
        return {"ok": True, "exists": False, "session": None}
    items = _load_session_items(str(row.get("id") or ""))
    return {"ok": True, "exists": True, "session": _serialize_session(row, items)}


def pause_today_session(user_id: str, session_id: str) -> dict[str, Any]:
    now = utcnow().isoformat()
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM today_training_sessions WHERE id=? AND user_id=? LIMIT 1",
            (session_id, user_id),
        ).fetchone()
        if not row:
            return {"ok": False, "error": "session_not_found"}
        conn.execute(
            "UPDATE today_training_sessions SET status='paused', paused_at=?, updated_at=? WHERE id=? AND user_id=?",
            (now, now, session_id, user_id),
        )
    updated = _get_today_session_row(user_id, utcnow().date().isoformat())
    items = _load_session_items(session_id)
    if not updated:
        return {"ok": False, "error": "session_not_found"}
    return {"ok": True, "session": _serialize_session(updated, items)}


def submit_today_answer(user_id: str, session_id: str, item_id: str, is_correct: bool) -> dict[str, Any]:
    now = utcnow().isoformat()
    normalized_status = "correct" if is_correct else "wrong"
    with get_conn() as conn:
        session_row = conn.execute(
            "SELECT * FROM today_training_sessions WHERE id=? AND user_id=? LIMIT 1",
            (session_id, user_id),
        ).fetchone()
        if not session_row:
            return {"ok": False, "error": "session_not_found"}
        item_row = conn.execute(
            "SELECT * FROM today_training_session_items WHERE id=? AND session_id=? AND user_id=? LIMIT 1",
            (item_id, session_id, user_id),
        ).fetchone()
        if not item_row:
            return {"ok": False, "error": "item_not_found"}
        if str(item_row["status"]) == "pending":
            conn.execute(
                """
                UPDATE today_training_session_items
                SET status=?, answered_at=?, updated_at=?
                WHERE id=? AND session_id=? AND user_id=?
                """,
                (normalized_status, now, now, item_id, session_id, user_id),
            )
        counts = conn.execute(
            """
            SELECT
              COUNT(*) AS total_count,
              SUM(CASE WHEN status <> 'pending' THEN 1 ELSE 0 END) AS completed_count
            FROM today_training_session_items
            WHERE session_id=? AND user_id=?
            """,
            (session_id, user_id),
        ).fetchone()
        total_count = int((counts["total_count"] if counts else 0) or 0)
        completed_count = int((counts["completed_count"] if counts else 0) or 0)
        is_done = completed_count >= total_count and total_count > 0
        status = "done" if is_done else "in_progress"
        finished_at = now if is_done else ""
        conn.execute(
            """
            UPDATE today_training_sessions
            SET status=?, completed_count=?, current_index=?, finished_at=?, updated_at=?
            WHERE id=? AND user_id=?
            """,
            (status, completed_count, completed_count, finished_at, now, session_id, user_id),
        )
    session = _get_today_session_row(user_id, utcnow().date().isoformat())
    if not session:
        return {"ok": False, "error": "session_not_found"}
    items = _load_session_items(session_id)
    return {"ok": True, "session": _serialize_session(session, items)}
