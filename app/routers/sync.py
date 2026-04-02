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
    SuggestRestructurePayload,
    SyncPushPayload,
    SynthesizeNodePayload,
)
from app.security import clear_session, create_user_account, get_user_by_token, issue_session, utcnow, verify_password

router = APIRouter()


@router.get("/api/sync")
def sync_pull(
    since: str = "",
    cursorAt: str = "",
    cursorId: str = "",
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    with get_conn() as conn:
        snapshot_updated_at = get_workspace_snapshot_updated_at(user["id"], conn)
        if not since:
            ops = list_current_sync_ops(user["id"], conn)
            return {
                "ops": ops,
                "serverTime": utcnow().isoformat(),
                "snapshotUpdatedAt": snapshot_updated_at,
                "origins": list_origin_statuses(user["id"]),
                "hasMore": False,
            }
        if cursorAt:
            rows = conn.execute(
                """
                SELECT id, op_type, entity_id, payload, created_at
                FROM operations
                WHERE user_id = ?
                  AND (
                    created_at > ?
                    OR (created_at = ? AND id > ?)
                  )
                ORDER BY created_at ASC, id ASC
                LIMIT 500
                """,
                (user["id"], cursorAt, cursorAt, cursorId or ""),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT id, op_type, entity_id, payload, created_at
                FROM operations
                WHERE user_id = ? AND created_at > ?
                ORDER BY created_at ASC, id ASC
                LIMIT 500
                """,
                (user["id"], since or ""),
            ).fetchall()
    next_cursor_at = rows[-1]["created_at"] if rows else ""
    next_cursor_id = rows[-1]["id"] if rows else ""
    return {
        "ops": [dict(row) for row in rows],
        "serverTime": utcnow().isoformat(),
        "snapshotUpdatedAt": snapshot_updated_at,
        "origins": list_origin_statuses(user["id"]),
        "hasMore": len(rows) == 500,
        "nextCursorAt": next_cursor_at,
        "nextCursorId": next_cursor_id,
    }

@router.post("/api/sync")
def sync_push(
    body: SyncPushPayload,
    request: Request,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    current_origin = infer_request_origin(request)
    with get_conn() as conn:
        for op in body.ops:
            op_payload = op.get("payload") or {}
            conn.execute(
                """
                INSERT OR IGNORE INTO operations(id, user_id, op_type, entity_id, payload, created_at)
                VALUES(?, ?, ?, ?, ?, ?)
                """,
                (
                    op["id"],
                    user["id"],
                    op["op_type"],
                    str(op["entity_id"]),
                    json.dumps(op_payload, ensure_ascii=False),
                    op["created_at"],
                ),
            )
            apply_sync_op_to_state_entity(
                user["id"],
                {
                    "op_type": op.get("op_type"),
                    "entity_id": op.get("entity_id"),
                    "payload": op_payload,
                    "created_at": op.get("created_at"),
                },
                conn,
            )
        cleanup_old_ops(user["id"], conn)
        snapshot_updated_at = get_workspace_snapshot_updated_at(user["id"], conn) or utcnow().isoformat()
        conn.commit()
    upsert_origin_status(
        user["id"],
        current_origin,
        last_backup_updated_at=snapshot_updated_at,
    )

    return {
        "ok": True,
        "serverTime": utcnow().isoformat(),
        "snapshotUpdatedAt": snapshot_updated_at,
        "currentOrigin": current_origin,
        "origins": list_origin_statuses(user["id"]),
    }
