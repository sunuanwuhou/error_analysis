from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from app.config import SESSION_TTL_DAYS
from app.database import get_conn


def utcnow() -> datetime:
    return datetime.utcnow()


def parse_iso_datetime(value: str) -> Optional[datetime]:
    text = str(value or "").strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is not None:
        return parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
    return base64.b64encode(salt + digest).decode("ascii")


def verify_password(password: str, encoded: str) -> bool:
    raw = base64.b64decode(encoded.encode("ascii"))
    salt, expected = raw[:16], raw[16:]
    actual = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
    return hmac.compare_digest(actual, expected)


def create_user_account(username: str, password: str) -> dict[str, str]:
    normalized_username = username.strip()
    if len(normalized_username) < 2 or len(normalized_username) > 32:
        raise ValueError("username must be 2-32 characters")
    if len(password) < 6 or len(password) > 128:
        raise ValueError("password must be 6-128 characters")

    user_id = secrets.token_hex(12)
    with get_conn() as conn:
        existing = conn.execute("SELECT id FROM users WHERE username = ?", (normalized_username,)).fetchone()
        if existing:
            raise ValueError("username already exists")

        conn.execute(
            "INSERT INTO users(id, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
            (user_id, normalized_username, hash_password(password), utcnow().isoformat()),
        )
        conn.commit()

    return {"id": user_id, "username": normalized_username}


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
