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
            "SELECT * FROM practice_attempts WHERE user_id=? ORDER BY datetime(created_at) DESC, id DESC LIMIT ?",
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
        " ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC, id DESC LIMIT ?"
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
        " ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC, id DESC LIMIT ?"
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
        " ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC, id DESC LIMIT ?"
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


_NOTE_FIRST_HINTS = (
    "不会",
    "没想到",
    "想不到",
    "题型",
    "识别",
    "概念",
    "公式",
    "方法",
    "语境",
    "理解偏差",
    "知识点",
)
_DIRECT_DO_HINTS = (
    "粗心",
    "看漏",
    "漏读",
    "审题",
    "顺序",
    "比较",
    "主语",
    "限定",
    "代入",
    "选项",
)
_SPEED_DRILL_HINTS = (
    "耗时",
    "拖慢",
    "犹豫",
    "时间",
    "来不及",
    "卡住",
    "速度",
    "超时",
)


def _lane_text_blob(error: dict[str, Any], behavior: dict[str, Any]) -> str:
    return " ".join(
        str(
            error.get(key)
            or behavior.get(key)
            or ""
        ).strip()
        for key in (
            "rootReason",
            "errorReason",
            "analysis",
            "tip",
            "nextAction",
            "problemType",
            "subtype",
            "subSubtype",
            "lastMistakeType",
            "lastTriggerPoint",
            "lastCorrectModel",
            "lastNextAction",
        )
    ).lower()


def _matches_any(text: str, keywords: tuple[str, ...]) -> bool:
    return any(keyword in text for keyword in keywords)


def _build_flow_workbench(
    errors: list[dict[str, Any]],
    behavior_map: dict[str, dict[str, Any]],
    limit: int = 6,
) -> dict[str, Any]:
    normalized_limit = max(1, min(limit, 12))
    ranked_daily = compute_daily_practice(errors, max(normalized_limit * 3, 18), behavior_map)
    summary_by_id = {str(item.get("id") or ""): item for item in ranked_daily}

    note_first_candidates: list[tuple[int, dict[str, Any]]] = []
    direct_do_candidates: list[tuple[int, dict[str, Any]]] = []
    speed_drill_candidates: list[tuple[int, dict[str, Any]]] = []
    weakness_counter: Counter[str] = Counter()
    type_counter: Counter[str] = Counter()

    for error in errors:
        error_id = str(error.get("id") or "").strip()
        if not error_id:
            continue
        status = str(error.get("status") or "").strip().lower()
        mastery_level = str(error.get("masteryLevel") or "").strip().lower()
        if status == "mastered" or mastery_level == "mastered":
            continue

        behavior = behavior_map.get(error_id) or {}
        ranked_item = summary_by_id.get(error_id) or summarize_error(error)
        base_score = int(ranked_item.get("practiceScore") or 0)
        blob = _lane_text_blob(error, behavior)
        problem_type = str(error.get("problemType") or "").strip().lower()
        target_duration = max(int(error.get("targetDurationSec") or 0), 1)
        actual_duration = max(
            int(error.get("actualDurationSec") or 0),
            int(behavior.get("lastDuration") or 0),
            int(behavior.get("avgDuration") or 0),
        )
        confidence = int(error.get("confidence") or behavior.get("lastConfidence") or 0)
        wrong_count = int(behavior.get("recentWrongCount") or 0)
        last_result = str(behavior.get("lastResult") or "")
        note_node_id = str(error.get("noteNodeId") or behavior.get("noteNodeId") or "").strip()
        note_ready = bool(note_node_id or str(error.get("tip") or "").strip() or str(error.get("analysis") or "").strip())

        weakness_name = str(error.get("rootReason") or error.get("errorReason") or behavior.get("lastMistakeType") or "").strip()
        if weakness_name:
            weakness_counter[weakness_name] += 1
        type_name = str(error.get("type") or "").strip()
        if type_name:
            type_counter[type_name] += 1

        is_speed_drill = (
            (actual_duration and actual_duration > target_duration and target_duration > 0)
            or (target_duration and actual_duration >= int(target_duration * 1.5))
            or _matches_any(blob, _SPEED_DRILL_HINTS)
        )
        is_note_first = (
            problem_type == "cognition"
            or _matches_any(blob, _NOTE_FIRST_HINTS)
            or (confidence and confidence <= 2 and note_ready and not is_speed_drill)
        )
        is_direct_do = (
            problem_type == "execution"
            or _matches_any(blob, _DIRECT_DO_HINTS)
            or last_result == "wrong"
            or wrong_count >= 1
        )

        lane_reason = "优先处理"
        item = ranked_item | {
            "taskMode": "daily",
            "taskLane": "direct_do",
            "taskReason": lane_reason,
            "noteReady": note_ready,
            "noteNodeId": note_node_id,
            "recentWrongCount": wrong_count,
            "lastConfidence": int(behavior.get("lastConfidence") or 0),
            "lastDuration": int(behavior.get("lastDuration") or 0),
            "avgDuration": int(behavior.get("avgDuration") or 0),
            "lastResult": last_result,
        }

        if is_speed_drill:
            lane_reason = "超时或明显拖慢，先限时复训"
            item = item | {"taskMode": "speed", "taskLane": "speed_drill", "taskReason": lane_reason}
            speed_drill_candidates.append((base_score + 18 + min(actual_duration // max(target_duration, 1), 12), item))
            continue

        if is_note_first and note_ready:
            lane_reason = "方法未稳，先看笔记再做题"
            item = item | {"taskMode": "note", "taskLane": "note_first", "taskReason": lane_reason}
            note_first_candidates.append((base_score + 14 + max(0, 3 - confidence), item))
            continue

        if is_direct_do or not note_ready:
            lane_reason = "有基础但容易做错，先直接开做"
            item = item | {"taskMode": "direct", "taskLane": "direct_do", "taskReason": lane_reason}
            direct_do_candidates.append((base_score + 10 + wrong_count * 2, item))
            continue

        lane_reason = "先看短提示后进入练习"
        item = item | {"taskMode": "direct", "taskLane": "direct_do", "taskReason": lane_reason}
        direct_do_candidates.append((base_score + 8, item))

    def _top(items: list[tuple[int, dict[str, Any]]]) -> list[dict[str, Any]]:
        items.sort(key=lambda pair: (-pair[0], str(pair[1].get("updatedAt") or ""), str(pair[1].get("id") or "")))
        return [item | {"queueScore": score} for score, item in items[:normalized_limit]]

    note_first_queue = _top(note_first_candidates)
    direct_do_queue = _top(direct_do_candidates)
    speed_drill_queue = _top(speed_drill_candidates)

    advice: list[dict[str, Any]] = []
    if note_first_queue:
        advice.append({
            "key": "note_first",
            "title": f"先补 {len(note_first_queue)} 道方法型题",
            "description": "这批题更像不会做或方法未稳，先看笔记摘要再进入题目。",
            "targetIds": [str(item.get("id") or "") for item in note_first_queue],
        })
    if direct_do_queue:
        advice.append({
            "key": "direct_do",
            "title": f"直接验证 {len(direct_do_queue)} 道易错题",
            "description": "这批题更像会做但容易失误，先看一句提醒再开做。",
            "targetIds": [str(item.get("id") or "") for item in direct_do_queue],
        })
    if speed_drill_queue:
        advice.append({
            "key": "speed_drill",
            "title": f"限时压缩 {len(speed_drill_queue)} 道慢题",
            "description": "这批题的主要问题是耗时，先做题再看摘要，重点压时间。",
            "targetIds": [str(item.get("id") or "") for item in speed_drill_queue],
        })

    return {
        "overview": {
            "totalErrors": len(errors),
            "noteFirstCount": len(note_first_queue),
            "directDoCount": len(direct_do_queue),
            "speedDrillCount": len(speed_drill_queue),
            "attemptTrackedCount": len(behavior_map),
        },
        "noteFirstQueue": note_first_queue,
        "directDoQueue": direct_do_queue,
        "speedDrillQueue": speed_drill_queue,
        "weakestReasons": [{"name": name, "count": count} for name, count in weakness_counter.most_common(5)],
        "weakestTypes": [{"name": name, "count": count} for name, count in type_counter.most_common(5)],
        "advice": advice,
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
    flow = _build_flow_workbench(filtered_errors, behavior_map, limit=min(max(limit // 2, 4), 8))
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


@router.get("/api/practice/workbench")
def get_practice_workbench(
    limit: int = 6,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    errors = get_backup_errors(user["id"])
    normalized_limit = max(1, min(limit, 12))
    behavior_map = _read_attempt_behavior_map(
        user["id"],
        error_ids=[str(e.get("id") or "") for e in errors],
        question_ids=[str(e.get("questionId") or e.get("id") or "") for e in errors],
        limit=max(len(errors) * 4, 200),
    )
    insights = _build_practice_insights(
        errors,
        behavior_map,
        daily_limit=max(normalized_limit * 2, 12),
        review_limit=normalized_limit,
    )
    flow = _build_flow_workbench(errors, behavior_map, limit=normalized_limit)

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
        review_done = bool(behavior.get("closureDone")) or any(
            str(error.get(key) or "").strip()
            for key in ("rootReason", "errorReason", "analysis", "nextAction", "tip")
        )
        recent_attempt_count = int(behavior.get("recentAttemptCount") or 0)
        recent_wrong_count = int(behavior.get("recentWrongCount") or 0)
        recent_correct_count = int(behavior.get("recentCorrectCount") or 0)
        confidence = int(behavior.get("lastConfidence") or 0)
        last_result = str(behavior.get("lastResult") or "")

        if error_id not in review_ids and error_id not in retrain_ids and review_done and recent_attempt_count > 0:
            if recent_correct_count >= 1 and recent_wrong_count <= 1 and (last_result == "correct" or confidence >= 3):
                stable_candidates.append(summarize_error(error) | behavior)

        weakness_name = str(
            error.get("rootReason")
            or behavior.get("lastMistakeType")
            or error.get("errorReason")
            or ""
        ).strip()
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
