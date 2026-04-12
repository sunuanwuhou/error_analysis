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


@router.post("/api/images")
async def upload_image(
    request: Request,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    body = await request.body()
    if not body:
        raise HTTPException(status_code=400, detail="empty image body")
    if len(body) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="image too large (max 5MB)")

    content_type = request.headers.get("content-type", "image/jpeg").strip() or "image/jpeg"
    sha256 = hashlib.sha256(body).hexdigest()
    user_img_dir = IMAGES_DIR / user["id"]
    user_img_dir.mkdir(parents=True, exist_ok=True)
    img_path = user_img_dir / sha256
    if not img_path.exists():
        img_path.write_bytes(body)

    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO user_images(hash, user_id, content_type, size_bytes, ref_count, created_at)
            VALUES(?, ?, ?, ?, 1, ?)
            ON CONFLICT(hash, user_id) DO UPDATE SET
              ref_count = user_images.ref_count + 1,
              content_type = excluded.content_type,
              size_bytes = excluded.size_bytes
            """,
            (sha256, user["id"], content_type, len(body), utcnow().isoformat()),
        )
        conn.commit()

    return {"ok": True, "hash": sha256, "url": f"/api/images/{sha256}"}

@router.get("/api/images/{sha256}")
def get_image(
    sha256: str,
    xingce_session: Optional[str] = Cookie(default=None),
) -> Response:
    user = require_user(xingce_session)
    with get_conn() as conn:
        row = conn.execute(
            "SELECT content_type FROM user_images WHERE hash = ? AND user_id = ?",
            (sha256, user["id"]),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="image not found")

    img_path = IMAGES_DIR / user["id"] / sha256
    if not img_path.exists():
        raise HTTPException(status_code=404, detail="image file missing")

    return Response(
        content=img_path.read_bytes(),
        media_type=row["content_type"],
        headers={"Cache-Control": "max-age=31536000, immutable"},
    )

@router.delete("/api/images/{sha256}/unref")
def unref_image(
    sha256: str,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    img_path = IMAGES_DIR / user["id"] / sha256

    with get_conn() as conn:
        row = conn.execute(
            "SELECT ref_count FROM user_images WHERE hash = ? AND user_id = ?",
            (sha256, user["id"]),
        ).fetchone()
        if not row:
            return {"ok": True, "deleted": False}

        next_ref_count = row["ref_count"] - 1
        if next_ref_count <= 0:
            conn.execute(
                "DELETE FROM user_images WHERE hash = ? AND user_id = ?",
                (sha256, user["id"]),
            )
            if img_path.exists():
                img_path.unlink()
            deleted = True
        else:
            conn.execute(
                "UPDATE user_images SET ref_count = ? WHERE hash = ? AND user_id = ?",
                (next_ref_count, sha256, user["id"]),
            )
            deleted = False
        conn.commit()

    return {"ok": True, "deleted": deleted}
