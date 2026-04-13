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
from app.core import (
    build_codex_thread_summary,
    clean_multiline_text,
    ensure_codex_thread_owner,
    normalize_codex_title,
    parse_context_json,
    require_user,
)
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
    SuggestRestructurePayload,
    SyncPushPayload,
    SynthesizeNodePayload,
)
from app.security import clear_session, create_user_account, get_user_by_token, issue_session, utcnow, verify_password

router = APIRouter()


@router.get("/api/codex/threads")
def list_codex_threads(xingce_session: Optional[str] = Cookie(default=None)) -> dict[str, Any]:
    user = require_user(xingce_session)
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT id, user_id, title, archived, created_at, updated_at
            FROM codex_threads
            WHERE user_id = ? AND archived = 0
            ORDER BY updated_at DESC, created_at DESC
            """,
            (user["id"],),
        ).fetchall()
        threads = [build_codex_thread_summary(conn, row) for row in rows]
    return {"ok": True, "threads": threads}

@router.post("/api/codex/threads")
def create_codex_thread(
    payload: CodexThreadCreatePayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    now = utcnow().isoformat()
    thread_id = f"ctx_{secrets.token_hex(10)}"
    title = normalize_codex_title(payload.title)
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO codex_threads(id, user_id, title, archived, created_at, updated_at)
            VALUES (?, ?, ?, 0, ?, ?)
            """,
            (thread_id, user["id"], title, now, now),
        )
        conn.commit()
        row = ensure_codex_thread_owner(conn, thread_id, user["id"])
        thread = build_codex_thread_summary(conn, row)
    return {"ok": True, "thread": thread}

@router.get("/api/codex/threads/{thread_id}")
def get_codex_thread(thread_id: str, xingce_session: Optional[str] = Cookie(default=None)) -> dict[str, Any]:
    user = require_user(xingce_session)
    with get_conn() as conn:
        row = ensure_codex_thread_owner(conn, thread_id, user["id"])
        messages = conn.execute(
            """
            SELECT id, thread_id, user_id, role, content, context_json, status, error_text, created_at, replied_at
            FROM codex_messages
            WHERE thread_id = ?
            ORDER BY created_at ASC
            """,
            (thread_id,),
        ).fetchall()
        thread = build_codex_thread_summary(conn, row)
    return {
        "ok": True,
        "thread": thread,
        "messages": [
            {
                "id": item["id"],
                "threadId": item["thread_id"],
                "userId": item["user_id"],
                "role": item["role"],
                "content": item["content"],
                "context": parse_context_json(item["context_json"]),
                "status": item["status"],
                "errorText": item["error_text"],
                "createdAt": item["created_at"],
                "repliedAt": item["replied_at"],
            }
            for item in messages
        ],
    }

@router.post("/api/codex/threads/{thread_id}/messages")
def create_codex_message(
    thread_id: str,
    payload: CodexMessageCreatePayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    now = utcnow().isoformat()
    content = clean_multiline_text(payload.content, 8000)
    if not content:
        raise HTTPException(status_code=400, detail="message content is empty")
    context_payload = payload.context if isinstance(payload.context, dict) else {}
    message_id = f"cm_{secrets.token_hex(10)}"
    with get_conn() as conn:
        thread = ensure_codex_thread_owner(conn, thread_id, user["id"])
        existing_user_count = conn.execute(
            "SELECT COUNT(*) AS count FROM codex_messages WHERE thread_id = ? AND role = 'user'",
            (thread_id,),
        ).fetchone()["count"]
        conn.execute(
            """
            INSERT INTO codex_messages(
              id, thread_id, user_id, role, content, context_json, status, error_text, created_at, replied_at
            )
            VALUES (?, ?, ?, 'user', ?, ?, 'pending', '', ?, '')
            """,
            (message_id, thread_id, user["id"], content, json.dumps(context_payload, ensure_ascii=False), now),
        )
        updated_title = thread["title"]
        if existing_user_count == 0 and (thread["title"] == "Codex 收件箱" or not thread["title"].strip()):
            updated_title = normalize_codex_title(content[:40])
        conn.execute(
            "UPDATE codex_threads SET title = ?, updated_at = ? WHERE id = ?",
            (updated_title, now, thread_id),
        )
        conn.commit()
    return {
        "ok": True,
        "message": {
            "id": message_id,
            "threadId": thread_id,
            "userId": user["id"],
            "role": "user",
            "content": content,
            "context": context_payload,
            "status": "pending",
            "errorText": "",
            "createdAt": now,
            "repliedAt": "",
        },
    }
