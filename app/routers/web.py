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
    V51_INDEX_PATH,
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


@router.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "time": utcnow().isoformat()}

@router.get("/")
def root(xingce_session: Optional[str] = Cookie(default=None)) -> Response:
    user = get_user_by_token(xingce_session)
    if not user:
        return RedirectResponse(url="/login", status_code=302)
    return FileResponse(
        V51_INDEX_PATH,
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )

@router.get("/legacy")
def legacy_root(xingce_session: Optional[str] = Cookie(default=None)) -> Response:
    user = get_user_by_token(xingce_session)
    if not user:
        return RedirectResponse(url="/login", status_code=302)
    return FileResponse(
        HTML_PATH,
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )

@router.get("/shenlun")
def shenlun_root(xingce_session: Optional[str] = Cookie(default=None)) -> Response:
    user = get_user_by_token(xingce_session)
    if not user:
        return RedirectResponse(url="/login", status_code=302)
    return FileResponse(
        SHENLUN_HTML_PATH,
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )

@router.get("/v51")
@router.get("/v53")
def new_frontend_root(xingce_session: Optional[str] = Cookie(default=None)) -> Response:
    user = get_user_by_token(xingce_session)
    if not user:
        return RedirectResponse(url="/login", status_code=302)
    return RedirectResponse(url="/", status_code=302)

@router.get("/v51/{path:path}")
@router.get("/v53/{path:path}")
def new_frontend_spa(path: str, xingce_session: Optional[str] = Cookie(default=None)) -> Response:
    user = get_user_by_token(xingce_session)
    if not user:
        return RedirectResponse(url="/login", status_code=302)
    return RedirectResponse(url="/", status_code=302)

@router.get("/login")
def login_page(request: Request, xingce_session: Optional[str] = Cookie(default=None)) -> Response:
    user = get_user_by_token(xingce_session)
    if user:
        return RedirectResponse(url="/", status_code=302)
    return FileResponse(
        LOGIN_HTML_PATH,
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )

@router.get("/api/public-entry")
def public_entry(request: Request) -> dict[str, Any]:
    return {
        "origin": infer_request_origin(request),
        "tunnelUrl": read_tunnel_url(),
    }

@router.get("/api/runtime-info")
def runtime_info(request: Request) -> dict[str, Any]:
    return {
        "mode": RUNTIME_MODE,
        "label": build_runtime_label(request),
        "origin": infer_request_origin(request),
    }
