from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
import secrets
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional

from fastapi import Cookie, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "xingce.db"
HTML_PATH = BASE_DIR / "xingce_v3" / "xingce_v3.html"
LOGIN_HTML_PATH = BASE_DIR / "app" / "login.html"
RUNTIME_DIR = BASE_DIR / "runtime"
TUNNEL_LOG_PATH = RUNTIME_DIR / "cloudflared.log"
SESSION_COOKIE = "xingce_session"
SESSION_TTL_DAYS = 30


def utcnow() -> datetime:
    return datetime.utcnow()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
    return base64.b64encode(salt + digest).decode("ascii")


def verify_password(password: str, encoded: str) -> bool:
    raw = base64.b64decode(encoded.encode("ascii"))
    salt, expected = raw[:16], raw[16:]
    actual = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
    return hmac.compare_digest(actual, expected)


def get_conn() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
              id TEXT PRIMARY KEY,
              username TEXT NOT NULL UNIQUE,
              password_hash TEXT NOT NULL,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
              token TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              expires_at TEXT NOT NULL,
              created_at TEXT NOT NULL,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS user_backups (
              user_id TEXT PRIMARY KEY,
              payload_json TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS user_origin_status (
              user_id TEXT NOT NULL,
              origin TEXT NOT NULL,
              last_local_change_at TEXT NOT NULL DEFAULT '',
              last_loaded_at TEXT NOT NULL DEFAULT '',
              last_saved_at TEXT NOT NULL DEFAULT '',
              last_backup_updated_at TEXT NOT NULL DEFAULT '',
              updated_at TEXT NOT NULL,
              PRIMARY KEY (user_id, origin),
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """
        )


def get_user_by_token(token: Optional[str]) -> Optional[dict[str, Any]]:
    if not token:
        return None

    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT u.id, u.username, s.expires_at
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token = ?
            """,
            (token,),
        ).fetchone()

        if not row:
            return None

        expires_at = datetime.fromisoformat(row["expires_at"])
        if expires_at <= utcnow():
            conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
            conn.commit()
            return None

        return {"id": row["id"], "username": row["username"]}


def issue_session(user_id: str) -> tuple[str, str]:
    token = secrets.token_urlsafe(32)
    expires_at = utcnow() + timedelta(days=SESSION_TTL_DAYS)
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO sessions(token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
            (token, user_id, expires_at.isoformat(), utcnow().isoformat()),
        )
        conn.commit()
    return token, expires_at.isoformat()


def clear_session(token: Optional[str]) -> None:
    if not token:
        return
    with get_conn() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()


def normalize_origin(value: str) -> str:
    return value.rstrip("/")


def infer_request_origin(request: Request) -> str:
    forwarded_proto = request.headers.get("x-forwarded-proto")
    forwarded_host = request.headers.get("x-forwarded-host")
    host = forwarded_host or request.headers.get("host") or ""
    scheme = forwarded_proto or request.url.scheme
    return normalize_origin(f"{scheme}://{host}")


def read_tunnel_url() -> Optional[str]:
    if not TUNNEL_LOG_PATH.exists():
      return None
    try:
        text = TUNNEL_LOG_PATH.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None

    matches = re.findall(r"https://[a-z0-9-]+\.trycloudflare\.com", text)
    return matches[-1] if matches else None


class AuthPayload(BaseModel):
    username: str = Field(min_length=2, max_length=32)
    password: str = Field(min_length=6, max_length=128)


class BackupPayload(BaseModel):
    xc_version: int = 2
    exportTime: Optional[str] = None
    errors: list[dict[str, Any]] = Field(default_factory=list)
    notesByType: dict[str, Any] = Field(default_factory=dict)
    noteImages: dict[str, Any] = Field(default_factory=dict)
    typeRules: Any = None
    dirTree: Any = None
    globalNote: str = ""
    knowledgeTree: Any = None
    knowledgeNotes: dict[str, Any] = Field(default_factory=dict)


class OriginStatusPayload(BaseModel):
    localChangedAt: Optional[str] = None
    lastLoadedAt: Optional[str] = None
    lastSavedAt: Optional[str] = None
    lastBackupUpdatedAt: Optional[str] = None


app = FastAPI(title="xingce_v3_lab")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)
app.mount("/assets", StaticFiles(directory=str(BASE_DIR / "xingce_v3")), name="assets")


@app.on_event("startup")
def on_startup() -> None:
    init_db()


def json_error(message: str, status_code: int) -> JSONResponse:
    return JSONResponse({"error": message}, status_code=status_code)


def require_user(token: Optional[str]) -> dict[str, Any]:
    user = get_user_by_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="unauthorized")
    return user


def upsert_origin_status(user_id: str, origin: str, **fields: str) -> None:
    origin = normalize_origin(origin or "")
    if not origin:
        return

    allowed = {
        "last_local_change_at",
        "last_loaded_at",
        "last_saved_at",
        "last_backup_updated_at",
    }
    payload = {key: value for key, value in fields.items() if key in allowed and value is not None}
    now = utcnow().isoformat()
    columns = ["user_id", "origin", "updated_at", *payload.keys()]
    values = [user_id, origin, now, *payload.values()]
    updates = ["updated_at = excluded.updated_at", *[f"{key} = excluded.{key}" for key in payload.keys()]]

    with get_conn() as conn:
        conn.execute(
            f"""
            INSERT INTO user_origin_status({", ".join(columns)})
            VALUES ({", ".join("?" for _ in columns)})
            ON CONFLICT(user_id, origin) DO UPDATE SET
              {", ".join(updates)}
            """,
            values,
        )
        conn.commit()


def list_origin_statuses(user_id: str) -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT origin, last_local_change_at, last_loaded_at, last_saved_at,
                   last_backup_updated_at, updated_at
            FROM user_origin_status
            WHERE user_id = ?
            ORDER BY updated_at DESC, origin ASC
            """,
            (user_id,),
        ).fetchall()
    return [
        {
            "origin": row["origin"],
            "lastLocalChangeAt": row["last_local_change_at"],
            "lastLoadedAt": row["last_loaded_at"],
            "lastSavedAt": row["last_saved_at"],
            "lastBackupUpdatedAt": row["last_backup_updated_at"],
            "updatedAt": row["updated_at"],
        }
        for row in rows
    ]


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "time": utcnow().isoformat()}


@app.get("/")
def root(xingce_session: Optional[str] = Cookie(default=None)) -> Response:
    user = get_user_by_token(xingce_session)
    if not user:
        return RedirectResponse(url="/login", status_code=302)
    return FileResponse(HTML_PATH)


@app.get("/login")
def login_page(request: Request, xingce_session: Optional[str] = Cookie(default=None)) -> Response:
    user = get_user_by_token(xingce_session)
    if user:
        return RedirectResponse(url="/", status_code=302)
    return FileResponse(LOGIN_HTML_PATH)


@app.get("/api/public-entry")
def public_entry(request: Request) -> dict[str, Any]:
    return {
        "origin": infer_request_origin(request),
        "tunnelUrl": read_tunnel_url(),
    }


@app.post("/api/auth/register")
def register(payload: AuthPayload, response: Response) -> dict[str, Any]:
    user_id = secrets.token_hex(12)
    with get_conn() as conn:
        existing = conn.execute("SELECT id FROM users WHERE username = ?", (payload.username.strip(),)).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="username already exists")

        conn.execute(
            "INSERT INTO users(id, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
            (user_id, payload.username.strip(), hash_password(payload.password), utcnow().isoformat()),
        )
        conn.commit()

    token, _ = issue_session(user_id)
    response.set_cookie(
        SESSION_COOKIE,
        token,
        httponly=True,
        samesite="lax",
        max_age=SESSION_TTL_DAYS * 24 * 3600,
    )
    return {"ok": True, "user": {"id": user_id, "username": payload.username.strip()}}


@app.post("/api/auth/login")
def login(payload: AuthPayload, response: Response) -> dict[str, Any]:
    with get_conn() as conn:
        user = conn.execute(
            "SELECT id, username, password_hash FROM users WHERE username = ?",
            (payload.username.strip(),),
        ).fetchone()
        if not user or not verify_password(payload.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="invalid credentials")

    token, _ = issue_session(user["id"])
    response.set_cookie(
        SESSION_COOKIE,
        token,
        httponly=True,
        samesite="lax",
        max_age=SESSION_TTL_DAYS * 24 * 3600,
    )
    return {"ok": True, "user": {"id": user["id"], "username": user["username"]}}


@app.post("/api/auth/logout")
def logout(response: Response, xingce_session: Optional[str] = Cookie(default=None)) -> dict[str, Any]:
    clear_session(xingce_session)
    response.delete_cookie(SESSION_COOKIE)
    return {"ok": True}


@app.get("/api/me")
def me(xingce_session: Optional[str] = Cookie(default=None)) -> dict[str, Any]:
    user = get_user_by_token(xingce_session)
    if not user:
        return {"authenticated": False}
    return {"authenticated": True, "user": user}


@app.get("/api/backup")
def get_backup(request: Request, xingce_session: Optional[str] = Cookie(default=None)) -> dict[str, Any]:
    user = require_user(xingce_session)
    current_origin = infer_request_origin(request)
    with get_conn() as conn:
        row = conn.execute(
            "SELECT payload_json, updated_at FROM user_backups WHERE user_id = ?",
            (user["id"],),
        ).fetchone()
    if not row:
        return {
            "exists": False,
            "currentOrigin": current_origin,
            "origins": list_origin_statuses(user["id"]),
        }
    return {
        "exists": True,
        "currentOrigin": current_origin,
        "updatedAt": row["updated_at"],
        "backup": json.loads(row["payload_json"]),
        "origins": list_origin_statuses(user["id"]),
    }


@app.put("/api/backup")
def put_backup(payload: BackupPayload, request: Request, xingce_session: Optional[str] = Cookie(default=None)) -> dict[str, Any]:
    user = require_user(xingce_session)
    current_origin = infer_request_origin(request)
    updated_at = utcnow().isoformat()
    body = payload.dict()
    if not body.get("exportTime"):
        body["exportTime"] = updated_at

    with get_conn() as conn:
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


@app.post("/api/origin-status")
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


@app.get("/api/debug/users")
def debug_users() -> dict[str, Any]:
    with get_conn() as conn:
        rows = conn.execute("SELECT id, username, created_at FROM users ORDER BY created_at DESC").fetchall()
    return {"items": [dict(row) for row in rows]}
