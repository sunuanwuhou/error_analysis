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
    IMAGES_DIR,
    LOGIN_HTML_PATH,
    RUNTIME_MODE,
    SELF_SERVICE_REGISTRATION_ENABLED,
    SESSION_COOKIE,
    SESSION_TTL_DAYS,
    SHENLUN_HTML_PATH,
)
from app.core import (
    clean_multiline_text,
    flatten_knowledge_tree,
    get_backup_errors,
    load_backup_payload,
    require_user,
    summarize_error,
)
from app.database import get_conn
from app.runtime import build_runtime_label, infer_request_origin, read_tunnel_url, request_is_secure
from app.schemas import (
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
from app.security import clear_session, create_user_account, get_user_by_token, issue_session, utcnow, verify_password

router = APIRouter()


@router.get("/api/knowledge/search")
def knowledge_search(
    q: str,
    limit: int = 10,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    keyword = q.strip().lower()
    if not keyword:
        return {"ok": True, "nodes": [], "errors": []}
    payload = load_backup_payload(user["id"])
    nodes = flatten_knowledge_tree(payload.get("knowledgeTree") or [])
    node_hits = []
    for node in nodes:
        haystack = " ".join(
            [
                str(node.get("title") or ""),
                " / ".join(node.get("path") or []),
                str(node.get("contentMd") or ""),
            ]
        ).lower()
        if keyword in haystack:
            node_hits.append(
                {
                    "id": node["id"],
                    "title": node["title"],
                    "path": node["path"],
                    "excerpt": clean_multiline_text(node.get("contentMd"), 180),
                }
            )
            if len(node_hits) >= limit:
                break

    error_hits = []
    for error in get_backup_errors(user["id"]):
        haystack = " ".join(
            [
                str(error.get("question") or ""),
                str(error.get("analysis") or ""),
                str(error.get("rootReason") or ""),
                str(error.get("errorReason") or ""),
            ]
        ).lower()
        if keyword in haystack:
            error_hits.append(summarize_error(error))
            if len(error_hits) >= limit:
                break

    return {"ok": True, "nodes": node_hits, "errors": error_hits}

