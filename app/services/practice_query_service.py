from __future__ import annotations

import json
import sqlite3
from collections import Counter, defaultdict
from typing import Any, Optional

from app.core import compute_daily_practice, get_backup_errors, summarize_error
from app.database import get_conn
from app.security import utcnow
from app.services.practice_log_service import read_recent_practice_logs
from app.services.practice_stats_service import build_flow_workbench, build_practice_insights


def _normalize_id_list(values: Optional[list[Any]], *, max_size: int = 5000) -> list[str]:
    seen: set[str] = set()
    normalized: list[str] = []
    for raw in values or []:
        value = str(raw or "").strip()
        if not value or value in seen:
            continue
        seen.add(value)
        normalized.append(value)
        if len(normalized) >= max_size:
            break
    return normalized


def _collect_attempt_filter_ids(errors: list[dict[str, Any]]) -> tuple[list[str], list[str]]:
    error_ids: list[Any] = []
    question_ids: list[Any] = []
    for error in errors:
        error_ids.append(error.get("id"))
        question_ids.append(error.get("questionId") or error.get("id"))
    return _normalize_id_list(error_ids), _normalize_id_list(question_ids)


def _attempt_sort_key(row: sqlite3.Row) -> tuple[str, str, str]:
    return (
        str(row["updated_at"] or ""),
        str(row["created_at"] or ""),
        str(row["id"] or ""),
    )


def _fetch_attempt_rows_by_keys(
    user_id: str,
    *,
    error_ids: list[str],
    question_ids: list[str],
    limit: int,
    columns: Optional[tuple[str, ...]] = None,
) -> list[sqlite3.Row]:
    normalized_error_ids = _normalize_id_list(error_ids)
    normalized_question_ids = _normalize_id_list(question_ids)
    if not normalized_error_ids and not normalized_question_ids:
        return []

    rows: list[sqlite3.Row] = []
    normalized_limit = max(1, min(limit, 5000))
    select_clause = ", ".join(columns) if columns else "*"
    with get_conn() as conn:
        if normalized_error_ids:
            sql_error = (
                f"SELECT {select_clause} FROM practice_attempts "
                "WHERE user_id=? AND error_id IN (" + ",".join("?" for _ in normalized_error_ids) + ") "
                "ORDER BY updated_at DESC, created_at DESC, id DESC LIMIT ?"
            )
            rows.extend(conn.execute(sql_error, (user_id, *normalized_error_ids, normalized_limit)).fetchall())
        if normalized_question_ids:
            sql_question = (
                f"SELECT {select_clause} FROM practice_attempts "
                "WHERE user_id=? AND question_id IN (" + ",".join("?" for _ in normalized_question_ids) + ") "
                "ORDER BY updated_at DESC, created_at DESC, id DESC LIMIT ?"
            )
            rows.extend(conn.execute(sql_question, (user_id, *normalized_question_ids, normalized_limit)).fetchall())

    # When one row matches both filters, keep one copy.
    best_by_id: dict[str, sqlite3.Row] = {}
    for row in rows:
        row_id = str(row["id"] or "")
        if not row_id:
            continue
        existing = best_by_id.get(row_id)
        if not existing or _attempt_sort_key(row) > _attempt_sort_key(existing):
            best_by_id[row_id] = row

    ordered = sorted(best_by_id.values(), key=_attempt_sort_key, reverse=True)
    return ordered[:normalized_limit]


def read_practice_attempts(user_id: str, limit: int = 200) -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM practice_attempts WHERE user_id=? ORDER BY created_at DESC, id DESC LIMIT ?",
            (user_id, max(1, min(limit, 2000))),
        ).fetchall()
    items: list[dict[str, Any]] = []
    for row in rows:
        items.append(
            {
                "id": row["id"],
                "createdAt": row["created_at"],
                "updatedAt": row["updated_at"],
                "sessionMode": row["session_mode"],
                "source": row["source"],
                "questionId": row["question_id"],
                "errorId": row["error_id"],
                "type": row["type"],
                "subtype": row["subtype"],
                "subSubtype": row["sub_subtype"],
                "questionText": row["question_text"],
                "myAnswer": row["my_answer"],
                "correctAnswer": row["correct_answer"],
                "result": row["result"],
                "durationSec": row["duration_sec"],
                "statusTag": row["status_tag"],
                "confidence": row["confidence"],
                "solvingNote": row["solving_note"],
                "scratchData": json.loads(row["scratch_data_json"] or "{}"),
                "noteNodeId": row["note_node_id"],
                "meta": json.loads(row["meta_json"] or "{}"),
            }
        )
    return items


def build_attempt_summary_map(
    user_id: str,
    error_ids: Optional[list[str]] = None,
    question_ids: Optional[list[str]] = None,
    limit: int = 500,
) -> dict[str, dict[str, Any]]:
    normalized_error_ids = _normalize_id_list(error_ids)
    normalized_question_ids = _normalize_id_list(question_ids)
    if not normalized_error_ids and not normalized_question_ids:
        return {}

    rows = _fetch_attempt_rows_by_keys(
        user_id,
        error_ids=normalized_error_ids,
        question_ids=normalized_question_ids,
        limit=max(1, min(limit, 3000)),
        columns=(
            "id",
            "created_at",
            "updated_at",
            "question_id",
            "error_id",
            "result",
            "duration_sec",
            "status_tag",
            "confidence",
            "solving_note",
            "note_node_id",
            "meta_json",
        ),
    )

    grouped_rows: dict[str, list[sqlite3.Row]] = defaultdict(list)
    for row in rows:
        error_id = str(row["error_id"] or "").strip()
        question_id = str(row["question_id"] or "").strip()
        key = error_id or question_id
        if not key:
            continue
        grouped_rows[key].append(row)

    summary_map: dict[str, dict[str, Any]] = {}
    for key, key_rows in grouped_rows.items():
        latest = key_rows[0]
        meta = json.loads(latest["meta_json"] or "{}")
        recent_rows = key_rows[:5]
        recent_wrong_count = sum(1 for row in recent_rows if str(row["result"] or "") == "wrong")
        summary_map[key] = {
            "attemptId": latest["id"],
            "errorId": str(latest["error_id"] or "").strip(),
            "questionId": str(latest["question_id"] or "").strip(),
            "lastResult": latest["result"],
            "lastTime": latest["updated_at"] or latest["created_at"],
            "lastConfidence": latest["confidence"],
            "lastDuration": latest["duration_sec"],
            "statusTag": latest["status_tag"],
            "solvingNote": latest["solving_note"],
            "noteNodeId": latest["note_node_id"],
            "recentAttemptCount": len(recent_rows),
            "recentWrongCount": recent_wrong_count,
            "lastMistakeType": str(meta.get("mistakeType") or ""),
            "lastTriggerPoint": str(meta.get("triggerPoint") or ""),
            "lastCorrectModel": str(meta.get("correctModel") or ""),
            "lastNextAction": str(meta.get("nextAction") or ""),
        }
    return summary_map


def read_attempt_behavior_map(
    user_id: str,
    error_ids: Optional[list[str]] = None,
    question_ids: Optional[list[str]] = None,
    limit: int = 1200,
) -> dict[str, dict[str, Any]]:
    normalized_error_ids = _normalize_id_list(error_ids)
    normalized_question_ids = _normalize_id_list(question_ids)
    if not normalized_error_ids and not normalized_question_ids:
        return {}

    rows = _fetch_attempt_rows_by_keys(
        user_id,
        error_ids=normalized_error_ids,
        question_ids=normalized_question_ids,
        limit=max(1, min(limit, 5000)),
        columns=(
            "id",
            "created_at",
            "updated_at",
            "question_id",
            "error_id",
            "result",
            "duration_sec",
            "status_tag",
            "confidence",
            "solving_note",
            "note_node_id",
            "meta_json",
        ),
    )

    grouped: dict[str, list[sqlite3.Row]] = defaultdict(list)
    for row in rows:
        error_id = str(row["error_id"] or "").strip()
        question_id = str(row["question_id"] or "").strip()
        key = error_id or question_id
        if not key:
            continue
        grouped[key].append(row)

    behavior_map: dict[str, dict[str, Any]] = {}
    for key, grouped_rows in grouped.items():
        latest = grouped_rows[0]
        recent_rows = grouped_rows[:5]
        latest_meta = json.loads(latest["meta_json"] or "{}")
        latest_confidence = int(latest["confidence"] or 0)
        latest_duration = int(latest["duration_sec"] or 0)
        latest_result = str(latest["result"] or "")
        durations = [int(row["duration_sec"] or 0) for row in recent_rows if int(row["duration_sec"] or 0) > 0]
        recent_wrong_count = sum(1 for row in recent_rows if str(row["result"] or "") == "wrong")
        recent_correct_count = sum(1 for row in recent_rows if str(row["result"] or "") == "correct")
        closure_done = all(str(latest_meta.get(field) or "").strip() for field in ("mistakeType", "triggerPoint", "correctModel", "nextAction"))
        solved_but_unstable = latest_result == "correct" and (latest_confidence and latest_confidence <= 2)
        behavior_map[key] = {
            "attemptId": latest["id"],
            "errorId": str(latest["error_id"] or "").strip(),
            "questionId": str(latest["question_id"] or "").strip(),
            "lastResult": latest_result,
            "lastTime": latest["updated_at"] or latest["created_at"],
            "lastConfidence": latest_confidence,
            "lastDuration": latest_duration,
            "avgDuration": round(sum(durations) / len(durations)) if durations else latest_duration,
            "recentAttemptCount": len(recent_rows),
            "recentWrongCount": recent_wrong_count,
            "recentCorrectCount": recent_correct_count,
            "statusTag": str(latest["status_tag"] or ""),
            "noteNodeId": str(latest["note_node_id"] or ""),
            "solvingNote": str(latest["solving_note"] or ""),
            "closureDone": closure_done,
            "solvedButUnstable": solved_but_unstable,
            "lastMistakeType": str(latest_meta.get("mistakeType") or ""),
            "lastTriggerPoint": str(latest_meta.get("triggerPoint") or ""),
            "lastCorrectModel": str(latest_meta.get("correctModel") or ""),
            "lastNextAction": str(latest_meta.get("nextAction") or ""),
        }
    return behavior_map


def build_practice_daily_response(user_id: str, limit: int = 12) -> dict[str, Any]:
    errors = get_backup_errors(user_id)
    recent_logs = read_recent_practice_logs(user_id, 14)
    today_str = utcnow().date().isoformat()
    practiced_today: set[str] = set()
    for log in recent_logs:
        if str(log.get("date", ""))[:10] == today_str:
            for eid in (log.get("errorIds") or []):
                practiced_today.add(str(eid))
    filtered_errors = [e for e in errors if str(e.get("id", "")) not in practiced_today]
    if len(filtered_errors) < max(3, limit // 2):
        filtered_errors = errors

    error_ids, question_ids = _collect_attempt_filter_ids(filtered_errors)
    behavior_map = read_attempt_behavior_map(
        user_id,
        error_ids=error_ids,
        question_ids=question_ids,
        limit=max(len(filtered_errors) * 4, 200),
    )
    queue = compute_daily_practice(filtered_errors, max(1, min(limit, 30)), behavior_map)
    insights = build_practice_insights(filtered_errors, behavior_map, daily_limit=max(1, min(limit, 30)), review_limit=min(max(limit // 2, 4), 8))
    flow = build_flow_workbench(filtered_errors, behavior_map, limit=min(max(limit // 2, 4), 8))
    return {
        "ok": True,
        "items": queue,
        "recentLogs": recent_logs,
        "practicedTodayCount": len(practiced_today),
        "advice": insights.get("advice") or [],
        "reviewQueue": insights.get("reviewQueue") or [],
        "retrainQueue": insights.get("retrainQueue") or [],
        "noteFirstQueue": flow.get("noteFirstQueue") or [],
        "directDoQueue": flow.get("directDoQueue") or [],
        "speedDrillQueue": flow.get("speedDrillQueue") or [],
    }


def build_practice_workbench_response(user_id: str, limit: int = 6) -> dict[str, Any]:
    errors = get_backup_errors(user_id)
    normalized_limit = max(1, min(limit, 12))
    error_ids, question_ids = _collect_attempt_filter_ids(errors)
    behavior_map = read_attempt_behavior_map(
        user_id,
        error_ids=error_ids,
        question_ids=question_ids,
        limit=max(len(errors) * 4, 200),
    )
    insights = build_practice_insights(
        errors,
        behavior_map,
        daily_limit=max(normalized_limit * 2, 12),
        review_limit=normalized_limit,
    )
    flow = build_flow_workbench(errors, behavior_map, limit=normalized_limit)

    review_queue = list(insights.get("reviewQueue") or [])
    retrain_queue = list(insights.get("retrainQueue") or [])
    daily_queue = list(insights.get("dailyQueue") or [])
    note_first_queue = list(flow.get("noteFirstQueue") or [])
    direct_do_queue = list(flow.get("directDoQueue") or [])
    speed_drill_queue = list(flow.get("speedDrillQueue") or [])

    stable_candidates: list[dict[str, Any]] = []
    weakness_groups: dict[str, dict[str, Any]] = {}
    review_ids = {str(item.get("id") or "") for item in review_queue}
    retrain_ids = {str(item.get("id") or "") for item in retrain_queue}

    for error in errors:
        error_id = str(error.get("id") or "").strip()
        if not error_id:
            continue
        behavior = behavior_map.get(error_id) or {}
        review_done = bool(behavior.get("closureDone")) or any(str(error.get(key) or "").strip() for key in ("rootReason", "errorReason", "analysis", "nextAction", "tip"))
        recent_attempt_count = int(behavior.get("recentAttemptCount") or 0)
        recent_wrong_count = int(behavior.get("recentWrongCount") or 0)
        recent_correct_count = int(behavior.get("recentCorrectCount") or 0)
        confidence = int(behavior.get("lastConfidence") or 0)
        last_result = str(behavior.get("lastResult") or "")

        if error_id not in review_ids and error_id not in retrain_ids and review_done and recent_attempt_count > 0:
            if recent_correct_count >= 1 and recent_wrong_count <= 1 and (last_result == "correct" or confidence >= 3):
                stable_candidates.append(summarize_error(error) | behavior)

        weakness_name = str(error.get("rootReason") or behavior.get("lastMistakeType") or error.get("errorReason") or "").strip()
        if weakness_name:
            group = weakness_groups.setdefault(
                weakness_name,
                {
                    "name": weakness_name,
                    "count": 0,
                    "ids": [],
                    "items": [],
                    "types": Counter(),
                },
            )
            group["count"] += 1
            group["ids"].append(error_id)
            if len(group["items"]) < normalized_limit:
                group["items"].append(summarize_error(error) | behavior)
            type_name = str(error.get("type") or "").strip()
            if type_name:
                group["types"][type_name] += 1

    stable_queue = stable_candidates[:normalized_limit]
    weakness_list: list[dict[str, Any]] = []
    for entry in weakness_groups.values():
        types_counter = entry.pop("types")
        top_type = types_counter.most_common(1)[0][0] if types_counter else "未分类"
        weakness_list.append({**entry, "topType": top_type})
    weakness_list.sort(key=lambda item: (-int(item.get("count") or 0), str(item.get("name") or "")))

    total = len(errors)
    overview = {
        "totalErrors": total,
        "noteFirstCount": len(note_first_queue),
        "directDoCount": len(direct_do_queue),
        "speedDrillCount": len(speed_drill_queue),
        "reviewCount": len(review_queue),
        "retrainCount": len(retrain_queue),
        "stabilizingCount": len(stable_queue),
        "stableCount": max(total - len(review_queue) - len(retrain_queue) - len(stable_queue), 0),
        "attemptTrackedCount": len(behavior_map),
    }

    return {
        "ok": True,
        "overview": overview,
        "advice": insights.get("advice") or [],
        "mission": insights.get("mission") or {},
        "behavior": insights.get("behavior") or {},
        "weakestTypes": insights.get("weakestTypes") or [],
        "weakestReasons": insights.get("weakestReasons") or [],
        "noteFirstQueue": note_first_queue,
        "directDoQueue": direct_do_queue,
        "speedDrillQueue": speed_drill_queue,
        "workflowAdvice": flow.get("advice") or [],
        "dailyQueue": daily_queue[: normalized_limit * 2],
        "reviewQueue": review_queue[:normalized_limit],
        "retrainQueue": retrain_queue[:normalized_limit],
        "stabilizingQueue": stable_queue,
        "stableQueue": [],
        "weaknessGroups": weakness_list[:normalized_limit],
    }


def build_practice_insights_response(user_id: str, limit: int = 6) -> dict[str, Any]:
    errors = get_backup_errors(user_id)
    error_ids, question_ids = _collect_attempt_filter_ids(errors)
    behavior_map = read_attempt_behavior_map(
        user_id,
        error_ids=error_ids,
        question_ids=question_ids,
        limit=max(len(errors) * 4, 200),
    )
    insights = build_practice_insights(errors, behavior_map, daily_limit=max(1, min(limit, 12)), review_limit=max(1, min(limit, 12)))
    return {"ok": True, **insights}
