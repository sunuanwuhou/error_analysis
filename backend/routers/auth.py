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

from backend.config import (
    IMAGES_DIR,
    LOGIN_HTML_PATH,
    RUNTIME_MODE,
    SELF_SERVICE_REGISTRATION_ENABLED,
    SESSION_COOKIE,
    SESSION_TTL_DAYS,
    SHENLUN_HTML_PATH,
)
from backend.database import get_conn
from backend.runtime import build_runtime_label, infer_request_origin, read_tunnel_url, request_is_secure
from backend.schemas import (
    AnalyzeEntryPayload,
    AuthPayload,
    BackupPayload,
    ChatPayload,
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
from backend.security import clear_session, create_user_account, get_user_by_token, issue_session, utcnow, verify_password

router = APIRouter()


@router.post("/api/auth/register")
def register(payload: AuthPayload, response: Response, request: Request) -> dict[str, Any]:
    if not SELF_SERVICE_REGISTRATION_ENABLED:
        raise HTTPException(status_code=404, detail="not found")
    try:
        user = create_user_account(payload.username, payload.password)
    except ValueError as exc:
        detail = str(exc)
        if detail == "username already exists":
            raise HTTPException(status_code=409, detail=detail) from exc
        raise HTTPException(status_code=400, detail=detail) from exc

    token, _ = issue_session(user["id"])
    response.set_cookie(
        SESSION_COOKIE,
        token,
        httponly=True,
        samesite="lax",
        secure=request_is_secure(request),
        max_age=SESSION_TTL_DAYS * 24 * 3600,
    )
    return {"ok": True, "user": user}

@router.post("/api/auth/login")
def login(
    payload: AuthPayload,
    response: Response,
    request: Request,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    # Clear any stale cookie first to avoid duplicated/dirty session state in browser.
    if xingce_session:
        clear_session(xingce_session)
    response.delete_cookie(SESSION_COOKIE, path="/")
    with get_conn() as conn:
        user = conn.execute(
            "SELECT id, username, password_hash, is_active FROM users WHERE username = ?",
            (payload.username.strip(),),
        ).fetchone()
        if not user or not verify_password(payload.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="invalid credentials")
        if int(user.get("is_active") if user.get("is_active") is not None else 1) != 1:
            raise HTTPException(status_code=403, detail="account_disabled")

    token, _ = issue_session(user["id"])
    response.set_cookie(
        SESSION_COOKIE,
        token,
        httponly=True,
        samesite="lax",
        secure=request_is_secure(request),
        max_age=SESSION_TTL_DAYS * 24 * 3600,
    )
    from backend.services.user_access_service import enrich_user_row

    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, username, role, is_active FROM users WHERE id = ?",
            (user["id"],),
        ).fetchone()
    profile = enrich_user_row(dict(row)) if row else {"id": user["id"], "username": user["username"]}
    return {"ok": True, "user": profile}

@router.post("/api/auth/logout")
def logout(response: Response, xingce_session: Optional[str] = Cookie(default=None)) -> dict[str, Any]:
    clear_session(xingce_session)
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}

@router.get("/api/me")
def me(response: Response, xingce_session: Optional[str] = Cookie(default=None)) -> dict[str, Any]:
    user = get_user_by_token(xingce_session)
    if not user:
        if xingce_session:
            response.delete_cookie(SESSION_COOKIE, path="/")
        return {"authenticated": False}
    return {"authenticated": True, "user": user}

