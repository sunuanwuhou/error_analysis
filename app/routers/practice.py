from __future__ import annotations

import hashlib
import json
import os
import re
import secrets
import sqlite3
import urllib.error
import urllib.request
import uuid
from collections import Counter, defaultdict
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Cookie, File, HTTPException, Query, Request, Response, UploadFile
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse

from app.config import (
    HTML_PATH,
    IMAGES_DIR,
    LOGIN_HTML_PATH,
    RUNTIME_MODE,
    SELF_SERVICE_REGISTRATION_ENABLED,
    SESSION_COOKIE,
    SESSION_TTL_DAYS,
    SHENLUN_HTML_PATH,
)
from app.core import *
from app.database import get_conn
from app.runtime import build_runtime_label, infer_request_origin, read_tunnel_url, request_is_secure
from app.schemas import (
    AnalyzeEntryPayload,
    AuthPayload,
    BackupPayload,
    ChatPayload,
    CodexMessageCreatePayload,
    CodexThreadCreatePayload,
    DiscoverPatternsPayload,
    DistillPayload,
    EvaluateAnswerPayload,
    GenerateQuestionPayload,
    ModuleSummaryPayload,
    OriginStatusPayload,
    PracticeLogPayload,
    PracticeAttemptsBatchPayload,
    SuggestRestructurePayload,
    SyncPushPayload,
    SynthesizeNodePayload,
)
from app.security import clear_session, create_user_account, get_user_by_token, issue_session, utcnow, verify_password

router = APIRouter()


def _write_practice_attempts(user_id: str, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    saved: list[dict[str, Any]] = []
    sql = (
        "INSERT INTO practice_attempts ("
        "id, user_id, created_at, updated_at, session_mode, source, question_id, error_id, "
        "type, subtype, sub_subtype, question_text, my_answer, correct_answer, result, "
        "duration_sec, status_tag, confidence, solving_note, scratch_data_json, note_node_id, meta_json"
        ") VALUES ("
        ":id, :user_id, :created_at, :updated_at, :session_mode, :source, :question_id, :error_id, "
        ":type, :subtype, :sub_subtype, :question_text, :my_answer, :correct_answer, :result, "
        ":duration_sec, :status_tag, :confidence, :solving_note, :scratch_data_json, :note_node_id, :meta_json"
        ") ON CONFLICT(id) DO UPDATE SET "
        "updated_at=excluded.updated_at, session_mode=excluded.session_mode, source=excluded.source, "
        "question_id=excluded.question_id, error_id=excluded.error_id, type=excluded.type, subtype=excluded.subtype, "
        "sub_subtype=excluded.sub_subtype, question_text=excluded.question_text, my_answer=excluded.my_answer, "
        "correct_answer=excluded.correct_answer, result=excluded.result, duration_sec=excluded.duration_sec, "
        "status_tag=excluded.status_tag, confidence=excluded.confidence, solving_note=excluded.solving_note, "
        "scratch_data_json=excluded.scratch_data_json, note_node_id=excluded.note_node_id, meta_json=excluded.meta_json"
    )
    with get_conn() as conn:
        for raw in items:
            attempt_id = str(raw.get("id") or uuid.uuid4().hex)
            created_at = str(raw.get("createdAt") or utcnow().isoformat())
            updated_at = str(raw.get("updatedAt") or created_at)
            payload = {
                "id": attempt_id,
                "user_id": user_id,
                "created_at": created_at,
                "updated_at": updated_at,
                "session_mode": str(raw.get("sessionMode") or ""),
                "source": str(raw.get("source") or ""),
                "question_id": str(raw.get("questionId") or ""),
                "error_id": str(raw.get("errorId") or ""),
                "type": str(raw.get("type") or ""),
                "subtype": str(raw.get("subtype") or ""),
                "sub_subtype": str(raw.get("subSubtype") or ""),
                "question_text": str(raw.get("questionText") or ""),
                "my_answer": str(raw.get("myAnswer") or ""),
                "correct_answer": str(raw.get("correctAnswer") or ""),
                "result": str(raw.get("result") or ""),
                "duration_sec": int(raw.get("durationSec") or 0),
                "status_tag": str(raw.get("statusTag") or ""),
                "confidence": int(raw.get("confidence") or 0),
                "solving_note": str(raw.get("solvingNote") or ""),
                "scratch_data_json": json.dumps(raw.get("scratchData") or {}, ensure_ascii=False),
                "note_node_id": str(raw.get("noteNodeId") or ""),
                "meta_json": json.dumps(raw.get("meta") or {}, ensure_ascii=False),
            }
            conn.execute(sql, payload)
            saved.append({
                "id": attempt_id,
                "createdAt": created_at,
                "updatedAt": updated_at,
                "sessionMode": payload["session_mode"],
                "source": payload["source"],
                "questionId": payload["question_id"],
                "errorId": payload["error_id"],
                "type": payload["type"],
                "subtype": payload["subtype"],
                "subSubtype": payload["sub_subtype"],
                "questionText": payload["question_text"],
                "myAnswer": payload["my_answer"],
                "correctAnswer": payload["correct_answer"],
                "result": payload["result"],
                "durationSec": payload["duration_sec"],
                "statusTag": payload["status_tag"],
                "confidence": payload["confidence"],
                "solvingNote": payload["solving_note"],
                "scratchData": raw.get("scratchData") or {},
                "noteNodeId": payload["note_node_id"],
                "meta": raw.get("meta") or {},
            })
    return saved


def _read_practice_attempts(user_id: str, limit: int = 200) -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM practice_attempts WHERE user_id=? ORDER BY datetime(created_at) DESC, rowid DESC LIMIT ?",
            (user_id, max(1, min(limit, 2000))),
        ).fetchall()
    items: list[dict[str, Any]] = []
    for row in rows:
        items.append({
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
        })
    return items




def _build_attempt_summary_map(
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
        "SELECT * FROM practice_attempts WHERE " + " AND ".join(clauses) +
        " ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC, rowid DESC LIMIT ?"
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




def _build_attempt_summary_map(
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
        "SELECT * FROM practice_attempts WHERE " + " AND ".join(clauses) +
        " ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC, rowid DESC LIMIT ?"
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


def _read_attempt_behavior_map(
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
        "SELECT * FROM practice_attempts WHERE " + " AND ".join(clauses) +
        " ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC, rowid DESC LIMIT ?"
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


def _build_practice_insights(
    errors: list[dict[str, Any]],
    behavior_map: dict[str, dict[str, Any]],
    daily_limit: int = 12,
    review_limit: int = 6,
) -> dict[str, Any]:
    daily_queue = compute_daily_practice(errors, max(1, min(daily_limit, 30)), behavior_map)
    review_candidates: list[tuple[int, dict[str, Any]]] = []
    retrain_candidates: list[tuple[int, dict[str, Any]]] = []
    reason_counter: Counter[str] = Counter()
    type_counter: Counter[str] = Counter()

    for error in errors:
        error_id = str(error.get("id") or "").strip()
        behavior = behavior_map.get(error_id) or {}
        reason_text = str(error.get("rootReason") or error.get("errorReason") or behavior.get("lastMistakeType") or "").strip()
        if reason_text:
            reason_counter[reason_text] += 1
        type_text = str(error.get("type") or "").strip()
        if type_text:
            type_counter[type_text] += 1

        has_reason = any(str(error.get(key) or "").strip() for key in ("rootReason", "errorReason", "analysis", "nextAction"))
        has_canvas = bool(str(error.get("processCanvas") or error.get("processImage") or "").strip())
        review_done = has_reason or behavior.get("closureDone") or has_canvas
        attempt_count = int(behavior.get("recentAttemptCount") or 0)
        wrong_count = int(behavior.get("recentWrongCount") or 0)
        confidence = int(behavior.get("lastConfidence") or 0)
        last_result = str(behavior.get("lastResult") or "")
        score = int(next((item.get("practiceScore") for item in daily_queue if str(item.get("id")) == error_id), 0) or 0)

        if attempt_count and not review_done:
            review_candidates.append((score + 15 + wrong_count * 2, error))
        elif review_done and attempt_count and (last_result == "wrong" or confidence <= 2 or wrong_count >= 2):
            retrain_candidates.append((score + 12 + wrong_count * 2, error))
        elif review_done and not attempt_count:
            retrain_candidates.append((score + 8, error))

    review_candidates.sort(key=lambda item: (-item[0], str(item[1].get("updatedAt") or ""), str(item[1].get("id") or "")))
    retrain_candidates.sort(key=lambda item: (-item[0], str(item[1].get("updatedAt") or ""), str(item[1].get("id") or "")))

    def _pack_queue(items: list[tuple[int, dict[str, Any]]], reason_label: str) -> list[dict[str, Any]]:
        packed: list[dict[str, Any]] = []
        for score, error in items[:review_limit]:
            error_id = str(error.get("id") or "").strip()
            packed.append(
                summarize_error(error)
                | {
                    "queueScore": score,
                    "queueReason": reason_label,
                }
                | (behavior_map.get(error_id) or {})
            )
        return packed

    review_queue = _pack_queue(review_candidates, "先补复盘")
    retrain_queue = _pack_queue(retrain_candidates, "先做复训")

    advice: list[dict[str, Any]] = []
    behavior_total = len(behavior_map)
    if review_queue:
        advice.append({
            "key": "review_queue",
            "title": f"先补完 {min(len(review_queue), review_limit)} 道待复盘题",
            "description": "这些题已经练过，但错因/总结/画布等复盘痕迹还不完整。",
            "targetIds": [str(item.get("id") or "") for item in review_queue[:review_limit]],
        })
    if retrain_queue:
        advice.append({
            "key": "retrain_queue",
            "title": f"优先复训 {min(len(retrain_queue), review_limit)} 道已复盘但不稳定题",
            "description": "这些题已经有复盘痕迹，但最近仍做错、低把握或高耗时。",
            "targetIds": [str(item.get("id") or "") for item in retrain_queue[:review_limit]],
        })
    if daily_queue:
        weak_type = type_counter.most_common(1)[0][0] if type_counter else "当前弱项"
        advice.append({
            "key": "daily_queue",
            "title": f"今天先练 {weak_type} 相关高风险题",
            "description": "daily practice 已优先按反复错、低把握、高耗时重新排序。",
            "targetIds": [str(item.get("id") or "") for item in daily_queue[:review_limit]],
        })

    weakest_reasons = [
        {"name": name, "count": count}
        for name, count in reason_counter.most_common(5)
    ]
    weakest_types = [
        {"name": name, "count": count}
        for name, count in type_counter.most_common(5)
    ]

    mission = {
        "total": len(daily_queue),
        "reviewCount": len(review_queue),
        "retrainCount": len(retrain_queue),
        "suggestedDailyCount": min(max(8, len(review_queue) + len(retrain_queue)), max(len(daily_queue), 8)),
        "suggestedReviewCount": min(max(4, len(review_queue)), max(len(review_queue), 4)),
        "suggestedRetrainCount": min(max(4, len(retrain_queue)), max(len(retrain_queue), 4)),
    }

    behavior = {
        "recentTrackedCount": behavior_total,
        "lowConfidenceCount": sum(1 for item in behavior_map.values() if int(item.get("lastConfidence") or 0) and int(item.get("lastConfidence") or 0) <= 2),
        "recentWrongCount": sum(int(item.get("recentWrongCount") or 0) for item in behavior_map.values()),
    }
    return {
        "dailyQueue": daily_queue,
        "reviewQueue": review_queue,
        "retrainQueue": retrain_queue,
        "advice": advice[:3],
        "weakestReasons": weakest_reasons,
        "weakestTypes": weakest_types,
        "attemptSummaryCount": len(behavior_map),
        "mission": mission,
        "behavior": behavior,
    }


@router.post("/api/practice/log")
def create_practice_log(
    payload: PracticeLogPayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    entry = write_practice_log(user["id"], payload)
    return {"ok": True, "entry": entry, "recent": read_recent_practice_logs(user["id"], 14)}

@router.post("/api/practice/attempts/batch")
def save_practice_attempts(
    payload: PracticeAttemptsBatchPayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    saved = _write_practice_attempts(user["id"], [item.model_dump() for item in payload.items])
    return {"ok": True, "items": saved}


@router.get("/api/practice/attempts")
def list_practice_attempts(
    limit: int = 120,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    items = _read_practice_attempts(user["id"], limit)
    return {"ok": True, "items": items}


@router.get("/api/practice/attempts/summary")
def list_practice_attempt_summaries(
    error_ids: str = Query(default=""),
    question_ids: str = Query(default=""),
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    normalized_error_ids = [item.strip() for item in str(error_ids or "").split(",") if item.strip()]
    normalized_question_ids = [item.strip() for item in str(question_ids or "").split(",") if item.strip()]
    summary_map = _build_attempt_summary_map(
        user["id"],
        error_ids=normalized_error_ids,
        question_ids=normalized_question_ids,
        limit=max(len(normalized_error_ids) + len(normalized_question_ids), 50),
    )
    return {"ok": True, "items": summary_map}


@router.get("/api/practice/daily")
def get_practice_daily(
    limit: int = 12,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    errors = get_backup_errors(user["id"])
    recent_logs = read_recent_practice_logs(user["id"], 14)
    today_str = utcnow().date().isoformat()
    practiced_today: set[str] = set()
    for log in recent_logs:
        if str(log.get("date", ""))[:10] == today_str:
            for eid in (log.get("errorIds") or []):
                practiced_today.add(str(eid))
    filtered_errors = [e for e in errors if str(e.get("id", "")) not in practiced_today]
    if len(filtered_errors) < max(3, limit // 2):
        filtered_errors = errors
    behavior_map = _read_attempt_behavior_map(
        user["id"],
        error_ids=[str(e.get("id") or "") for e in filtered_errors],
        question_ids=[str(e.get("questionId") or e.get("id") or "") for e in filtered_errors],
        limit=max(len(filtered_errors) * 4, 200),
    )
    queue = compute_daily_practice(filtered_errors, max(1, min(limit, 30)), behavior_map)
    insights = _build_practice_insights(filtered_errors, behavior_map, daily_limit=max(1, min(limit, 30)), review_limit=min(max(limit // 2, 4), 8))
    return {
        "ok": True,
        "items": queue,
        "recentLogs": recent_logs,
        "practicedTodayCount": len(practiced_today),
        "advice": insights.get("advice") or [],
        "reviewQueue": insights.get("reviewQueue") or [],
        "retrainQueue": insights.get("retrainQueue") or [],
    }


@router.get("/api/practice/insights")
def get_practice_insights(
    limit: int = 6,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    errors = get_backup_errors(user["id"])
    behavior_map = _read_attempt_behavior_map(
        user["id"],
        error_ids=[str(e.get("id") or "") for e in errors],
        question_ids=[str(e.get("questionId") or e.get("id") or "") for e in errors],
        limit=max(len(errors) * 4, 200),
    )
    insights = _build_practice_insights(errors, behavior_map, daily_limit=max(1, min(limit, 12)), review_limit=max(1, min(limit, 12)))
    return {"ok": True, **insights}
