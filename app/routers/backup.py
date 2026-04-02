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


@router.get("/api/backup")
def get_backup(
    request: Request,
    meta: bool = Query(default=False),
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    current_origin = infer_request_origin(request)
    with get_conn() as conn:
        materialized = build_workspace_snapshot_from_entities(user["id"], conn)
        row = conn.execute(
            "SELECT payload_json, updated_at FROM user_backups WHERE user_id = ?",
            (user["id"],),
        ).fetchone()
    if materialized:
        updated_at = str(materialized.get("exportTime") or materialized.get("baseUpdatedAt") or "")
        response = {
            "exists": True,
            "currentOrigin": current_origin,
            "updatedAt": updated_at,
            "payloadBytes": len(json.dumps(materialized, ensure_ascii=False)),
            "summary": build_backup_summary(materialized),
            "payload": None if meta else materialized,
            "backup": None if meta else materialized,
            "origins": list_origin_statuses(user["id"]),
        }
        return response
    if not row:
        return {
            "exists": False,
            "currentOrigin": current_origin,
            "payloadBytes": 0,
            "summary": {},
            "payload": None,
            "backup": None,
            "origins": list_origin_statuses(user["id"]),
        }
    payload_text = row["payload_json"] or "{}"
    backup = json.loads(payload_text)
    return {
        "exists": True,
        "currentOrigin": current_origin,
        "updatedAt": row["updated_at"],
        "payloadBytes": len(payload_text.encode("utf-8")),
        "summary": build_backup_summary(backup),
        "payload": None if meta else backup,
        "backup": None if meta else backup,
        "origins": list_origin_statuses(user["id"]),
    }

@router.put("/api/backup")
def put_backup(payload: BackupPayload, request: Request, xingce_session: Optional[str] = Cookie(default=None)) -> dict[str, Any]:
    user = require_user(xingce_session)
    current_origin = infer_request_origin(request)
    updated_at = utcnow().isoformat()
    body = payload.dict()
    if not body.get("exportTime"):
        body["exportTime"] = updated_at

    with get_conn() as conn:
        existing = conn.execute(
            "SELECT updated_at FROM user_backups WHERE user_id = ?",
            (user["id"],),
        ).fetchone()
        existing_updated_at = existing["updated_at"] if existing else ""
        base_updated_at = (payload.baseUpdatedAt or "").strip()

        if existing_updated_at and not payload.forceOverwrite:
            if not base_updated_at:
                return JSONResponse(
                    {
                        "error": "cloud backup changed; reload latest backup before saving",
                        "currentUpdatedAt": existing_updated_at,
                        "currentOrigin": current_origin,
                        "origins": list_origin_statuses(user["id"]),
                    },
                    status_code=409,
                )
            base_dt = parse_iso_datetime(base_updated_at)
            existing_dt = parse_iso_datetime(existing_updated_at)
            if not base_dt or not existing_dt:
                return JSONResponse(
                    {
                        "error": "cloud backup version is invalid; reload latest backup before saving",
                        "currentUpdatedAt": existing_updated_at,
                        "currentOrigin": current_origin,
                        "origins": list_origin_statuses(user["id"]),
                    },
                    status_code=409,
                )
            if existing_dt > base_dt:
                return JSONResponse(
                    {
                        "error": "cloud backup is newer than your local base version",
                        "currentUpdatedAt": existing_updated_at,
                        "currentOrigin": current_origin,
                        "origins": list_origin_statuses(user["id"]),
                    },
                    status_code=409,
                )

        conn.execute(
            """
            INSERT INTO user_backups(user_id, payload_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              payload_json = excluded.payload_json,
              updated_at = excluded.updated_at
            """,
            (user["id"], json.dumps(body, ensure_ascii=False), updated_at),
        )
        append_workspace_snapshot_ops(
            user["id"],
            body,
            conn,
            updated_at,
        )
        replace_workspace_entities_from_snapshot(
            user["id"],
            body,
            conn,
            updated_at,
        )
        conn.commit()

    upsert_origin_status(
        user["id"],
        current_origin,
        last_local_change_at=updated_at,
        last_saved_at=updated_at,
        last_backup_updated_at=updated_at,
    )

    return {
        "ok": True,
        "updatedAt": updated_at,
        "currentOrigin": current_origin,
        "origins": list_origin_statuses(user["id"]),
    }

@router.post("/api/origin-status")
def put_origin_status(
    payload: OriginStatusPayload,
    request: Request,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    current_origin = infer_request_origin(request)
    upsert_origin_status(
        user["id"],
        current_origin,
        last_local_change_at=payload.localChangedAt,
        last_loaded_at=payload.lastLoadedAt,
        last_saved_at=payload.lastSavedAt,
        last_backup_updated_at=payload.lastBackupUpdatedAt,
    )
    return {
        "ok": True,
        "currentOrigin": current_origin,
        "origins": list_origin_statuses(user["id"]),
    }
