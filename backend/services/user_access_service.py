from __future__ import annotations

import secrets
from typing import Any

from backend.database import get_conn
from backend.security import hash_password, utcnow
from backend.user_access import (
    DEFAULT_NEW_USER_MODULES,
    PORTAL_MODULE_KEYS,
    SUPER_ADMIN_USERNAME,
    USER_ROLE_SUPER_ADMIN,
    USER_ROLE_USER,
    is_super_admin_username,
    is_valid_module_key,
    normalize_username,
)


def _all_portal_modules() -> list[str]:
    return list(PORTAL_MODULE_KEYS)


def list_user_module_grants(conn, user_id: str) -> list[str]:
    rows = conn.execute(
        "SELECT module_key FROM user_module_grants WHERE user_id = ? ORDER BY module_key",
        (user_id,),
    ).fetchall()
    return [str(row["module_key"]) for row in rows]


def resolve_user_modules(role: str, username: str, granted: list[str]) -> list[str]:
    if role == USER_ROLE_SUPER_ADMIN and is_super_admin_username(username):
        return _all_portal_modules()
    return [key for key in granted if is_valid_module_key(key)]


def enrich_user_row(row: dict[str, Any]) -> dict[str, Any]:
    role = str(row.get("role") or USER_ROLE_USER)
    username = str(row.get("username") or "")
    is_active = int(row.get("is_active") if row.get("is_active") is not None else 1)
    with get_conn() as conn:
        granted = list_user_module_grants(conn, str(row["id"]))
    modules = resolve_user_modules(role, username, granted)
    return {
        "id": row["id"],
        "username": username,
        "role": role,
        "is_active": bool(is_active),
        "modules": modules,
        "is_super_admin": role == USER_ROLE_SUPER_ADMIN and is_super_admin_username(username),
    }


def set_user_module_grants(user_id: str, module_keys: list[str], granted_by: str) -> list[str]:
    normalized = sorted({key for key in module_keys if is_valid_module_key(key)})
    now = utcnow().isoformat()
    with get_conn() as conn:
        conn.execute("DELETE FROM user_module_grants WHERE user_id = ?", (user_id,))
        for key in normalized:
            conn.execute(
                """
                INSERT INTO user_module_grants(user_id, module_key, granted_at, granted_by)
                VALUES (?, ?, ?, ?)
                """,
                (user_id, key, now, granted_by),
            )
        conn.commit()
    return normalized


def create_managed_user(
    username: str,
    password: str,
    module_keys: list[str] | None,
    created_by: str,
) -> dict[str, Any]:
    normalized_username = normalize_username(username)
    if is_super_admin_username(normalized_username):
        raise ValueError("cannot create another super admin account")
    if len(normalized_username) < 2 or len(normalized_username) > 32:
        raise ValueError("username must be 2-32 characters")
    if len(password) < 6 or len(password) > 128:
        raise ValueError("password must be 6-128 characters")

    modules = (
        [key for key in (module_keys or []) if is_valid_module_key(key)]
        if module_keys is not None
        else list(DEFAULT_NEW_USER_MODULES)
    )
    if not modules:
        modules = list(DEFAULT_NEW_USER_MODULES)

    user_id = secrets.token_hex(12)
    now = utcnow().isoformat()
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT id FROM users WHERE username = ?",
            (normalized_username,),
        ).fetchone()
        if existing:
            raise ValueError("username already exists")
        conn.execute(
            """
            INSERT INTO users(id, username, password_hash, created_at, role, is_active, updated_at)
            VALUES (?, ?, ?, ?, ?, 1, ?)
            """,
            (user_id, normalized_username, hash_password(password), now, USER_ROLE_USER, now),
        )
        conn.commit()

    set_user_module_grants(user_id, modules, created_by)
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, username, role, is_active FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
    return enrich_user_row(dict(row))


def list_managed_users() -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, username, role, is_active, created_at FROM users ORDER BY lower(username)"
        ).fetchall()
    return [enrich_user_row(dict(row)) for row in rows]


def update_managed_user_password(user_id: str, password: str) -> None:
    if len(password) < 6 or len(password) > 128:
        raise ValueError("password must be 6-128 characters")
    with get_conn() as conn:
        row = conn.execute("SELECT id, username, role FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            raise ValueError("user not found")
        if str(row["role"]) == USER_ROLE_SUPER_ADMIN:
            raise ValueError("cannot reset super admin password here")
        conn.execute(
            "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
            (hash_password(password), utcnow().isoformat(), user_id),
        )
        conn.commit()


def update_managed_user_active(user_id: str, is_active: bool) -> dict[str, Any]:
    with get_conn() as conn:
        row = conn.execute("SELECT id, username, role FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            raise ValueError("user not found")
        if str(row["role"]) == USER_ROLE_SUPER_ADMIN:
            raise ValueError("cannot disable super admin")
        conn.execute(
            "UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?",
            (1 if is_active else 0, utcnow().isoformat(), user_id),
        )
        conn.commit()
        updated = conn.execute(
            "SELECT id, username, role, is_active FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
    return enrich_user_row(dict(updated))


def ensure_wesly_super_admin() -> None:
    now = utcnow().isoformat()
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, username, role FROM users WHERE lower(username) = ?",
            (SUPER_ADMIN_USERNAME.lower(),),
        ).fetchone()
        if not row:
            return
        if str(row["role"]) != USER_ROLE_SUPER_ADMIN:
            conn.execute(
                "UPDATE users SET role = ?, updated_at = ? WHERE id = ?",
                (USER_ROLE_SUPER_ADMIN, now, row["id"]),
            )
            conn.commit()


def backfill_legacy_user_grants() -> None:
    """Existing users without grants keep full portal access (pre-permission behavior)."""
    now = utcnow().isoformat()
    with get_conn() as conn:
        users = conn.execute("SELECT id, username, role FROM users").fetchall()
        for user in users:
            if str(user["role"]) == USER_ROLE_SUPER_ADMIN:
                continue
            existing = conn.execute(
                "SELECT 1 FROM user_module_grants WHERE user_id = ? LIMIT 1",
                (user["id"],),
            ).fetchone()
            if existing:
                continue
            for key in _all_portal_modules():
                conn.execute(
                    """
                    INSERT INTO user_module_grants(user_id, module_key, granted_at, granted_by)
                    VALUES (?, ?, ?, '')
                    ON CONFLICT DO NOTHING
                    """,
                    (user["id"], key, now),
                )
        conn.commit()
