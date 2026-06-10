from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from backend.config import SESSION_TTL_DAYS
from backend.database import get_conn


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

        now = utcnow().isoformat()
        conn.execute(
            """
            INSERT INTO users(id, username, password_hash, created_at, role, is_active, updated_at)
            VALUES (?, ?, ?, ?, 'user', 1, ?)
            """,
            (user_id, normalized_username, hash_password(password), now, now),
        )
        conn.commit()

    from backend.services.user_access_service import set_user_module_grants
    from backend.user_access import DEFAULT_NEW_USER_MODULES

    set_user_module_grants(user_id, list(DEFAULT_NEW_USER_MODULES), "")
    return enrich_user_after_create(user_id, normalized_username)


def enrich_user_after_create(user_id: str, username: str) -> dict[str, Any]:
    from backend.services.user_access_service import enrich_user_row

    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, username, role, is_active FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
    return enrich_user_row(dict(row)) if row else {"id": user_id, "username": username}


def get_user_by_token(token: Optional[str]) -> Optional[dict[str, Any]]:
    if not token:
        return None

    from backend.services.user_access_service import enrich_user_row

    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT u.id, u.username, u.role, u.is_active, s.expires_at
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

        if int(row.get("is_active") if row.get("is_active") is not None else 1) != 1:
            return None

        return enrich_user_row(dict(row))


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
