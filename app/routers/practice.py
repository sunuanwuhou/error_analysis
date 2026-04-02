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


@router.get("/api/practice/daily")
def get_practice_daily(
    limit: int = 12,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    errors = get_backup_errors(user["id"])
    recent_logs = read_recent_practice_logs(user["id"], 14)
    # 过滤今日已练习的题目，避免重复刷
    today_str = utcnow().date().isoformat()
    practiced_today: set[str] = set()
    for log in recent_logs:
        if str(log.get("date", ""))[:10] == today_str:
            for eid in (log.get("errorIds") or []):
                practiced_today.add(str(eid))
    # 如果今日已练习的题超过一半队列，不过滤（避免题库太小时无题可练）
    filtered_errors = [e for e in errors if str(e.get("id", "")) not in practiced_today]
    if len(filtered_errors) < max(3, limit // 2):
        filtered_errors = errors  # 回退到全量
    queue = compute_daily_practice(filtered_errors, max(1, min(limit, 30)))
    return {"ok": True, "items": queue, "recentLogs": recent_logs, "practicedTodayCount": len(practiced_today)}
