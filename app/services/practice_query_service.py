from __future__ import annotations

import json
import sqlite3
from collections import Counter, defaultdict
from typing import Any, Optional

from app.core import compute_daily_practice, get_backup_errors, read_recent_practice_logs, summarize_error
from app.database import get_conn
from app.security import utcnow
from app.services.practice_stats_service import build_flow_workbench, build_practice_insights


def read_practice_attempts(user_id: str, limit: int = 200) -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM practice_attempts WHERE user_id=? ORDER BY datetime(created_at) DESC, id DESC LIMIT ?",
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
    normalized_error_ids = [str(item).strip() for item in (error_ids or []) if str(item).strip()]
    normalized_question_ids = [str(item).strip() for item in (question_ids or []) if str(item).strip()]
    if not normalized_error_ids and not normalized_question_ids:
        return {}

    clauses: list[str] = ["user_id=?"]
    params: list[Any] = [user_id]
    filters: list[str] = []
    if normalized_error_ids:
        filters.append("error_id IN (" + ",".join("?" for _ in normalized_error_ids) + ")")
        params.extend(normalized_error_ids)
    if normalized_question_ids:
        filters.append("question_id IN (" + ",".join("?" for _ in normalized_question_ids) + ")")
        params.extend(normalized_question_ids)
    if filters:
        clauses.append("(" + " OR ".join(filters) + ")")

    sql = (
        "SELECT * FROM practice_attempts WHERE "
        + " AND ".join(clauses)
        + " ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC, id DESC LIMIT ?"
    )
    params.append(max(1, min(limit, 3000)))
    with get_conn() as conn:
        rows = conn.execute(sql, tuple(params)).fetchall()

    summary_map: dict[str, dict[str, Any]] = {}
    for row in rows:
        error_id = str(row["error_id"] or "").strip()
        question_id = str(row["question_id"] or "").strip()
        key = error_id or question_id
        if not key or key in summary_map:
            continue
        meta = json.loads(row["meta_json"] or "{}")
        summary_map[key] = {
            "attemptId": row["id"],
            "errorId": error_id,
            "questionId": question_id,
            "lastResult": row["result"],
            "lastTime": row["updated_at"] or row["created_at"],
            "lastConfidence": row["confidence"],
            "lastDuration": row["duration_sec"],
            "statusTag": row["status_tag"],
            "solvingNote": row["solving_note"],
            "noteNodeId": row["note_node_id"],
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
    normalized_error_ids = [str(item).strip() for item in (error_ids or []) if str(item).strip()]
    normalized_question_ids = [str(item).strip() for item in (question_ids or []) if str(item).strip()]
    if not normalized_error_ids and not normalized_question_ids:
        return {}

    clauses: list[str] = ["user_id=?"]
    params: list[Any] = [user_id]
    filters: list[str] = []
    if normalized_error_ids:
        filters.append("error_id IN (" + ",".join("?" for _ in normalized_error_ids) + ")")
        params.extend(normalized_error_ids)
    if normalized_question_ids:
        filters.append("question_id IN (" + ",".join("?" for _ in normalized_question_ids) + ")")
        params.extend(normalized_question_ids)
    if filters:
        clauses.append("(" + " OR ".join(filters) + ")")

    sql = (
        "SELECT * FROM practice_attempts WHERE "
        + " AND ".join(clauses)
        + " ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC, id DESC LIMIT ?"
    )
    params.append(max(1, min(limit, 5000)))
    with get_conn() as conn:
        rows = conn.execute(sql, tuple(params)).fetchall()

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

    behavior_map = read_attempt_behavior_map(
        user_id,
        error_ids=[str(e.get("id") or "") for e in filtered_errors],
        question_ids=[str(e.get("questionId") or e.get("id") or "") for e in filtered_errors],
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
    behavior_map = read_attempt_behavior_map(
        user_id,
        error_ids=[str(e.get("id") or "") for e in errors],
        question_ids=[str(e.get("questionId") or e.get("id") or "") for e in errors],
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
    behavior_map = read_attempt_behavior_map(
        user_id,
        error_ids=[str(e.get("id") or "") for e in errors],
        question_ids=[str(e.get("questionId") or e.get("id") or "") for e in errors],
        limit=max(len(errors) * 4, 200),
    )
    insights = build_practice_insights(errors, behavior_map, daily_limit=max(1, min(limit, 12)), review_limit=max(1, min(limit, 12)))
    return {"ok": True, **insights}
