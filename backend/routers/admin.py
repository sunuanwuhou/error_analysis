from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Cookie, HTTPException

from backend.core import require_super_admin
from backend.database import get_conn
from backend.schemas import (
    AdminCreateUserPayload,
    AdminResetPasswordPayload,
    AdminUpdateUserActivePayload,
    AdminUpdateUserModulesPayload,
)
from backend.services import user_access_service as access_svc
from backend.user_access import MODULE_LABELS, PORTAL_MODULE_KEYS, USER_ROLE_SUPER_ADMIN

router = APIRouter()


def _load_user_or_404(user_id: str) -> dict[str, Any]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, username, role, is_active FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="user not found")
    return dict(row)


@router.get("/api/admin/users")
def admin_list_users(xingce_session: Optional[str] = Cookie(default=None)) -> dict[str, Any]:
    require_super_admin(xingce_session)
    users = access_svc.list_managed_users()
    return {
        "ok": True,
        "users": users,
        "module_catalog": [{"key": key, "label": MODULE_LABELS[key]} for key in PORTAL_MODULE_KEYS],
    }


@router.post("/api/admin/users")
def admin_create_user(
    payload: AdminCreateUserPayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    actor = require_super_admin(xingce_session)
    try:
        user = access_svc.create_managed_user(
            payload.username,
            payload.password,
            payload.modules,
            str(actor["id"]),
        )
    except ValueError as exc:
        detail = str(exc)
        if detail == "username already exists":
            raise HTTPException(status_code=409, detail=detail) from exc
        raise HTTPException(status_code=400, detail=detail) from exc
    return {"ok": True, "user": user}


@router.put("/api/admin/users/{user_id}/modules")
def admin_update_user_modules(
    user_id: str,
    payload: AdminUpdateUserModulesPayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    actor = require_super_admin(xingce_session)
    row = _load_user_or_404(user_id)
    if str(row["role"]) == USER_ROLE_SUPER_ADMIN:
        raise HTTPException(status_code=400, detail="cannot change super admin modules")
    modules = access_svc.set_user_module_grants(user_id, payload.modules, str(actor["id"]))
    enriched = access_svc.enrich_user_row(row)
    enriched["modules"] = modules
    return {"ok": True, "user": enriched}


@router.patch("/api/admin/users/{user_id}/password")
def admin_reset_password(
    user_id: str,
    payload: AdminResetPasswordPayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    require_super_admin(xingce_session)
    _load_user_or_404(user_id)
    try:
        access_svc.update_managed_user_password(user_id, payload.password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


@router.patch("/api/admin/users/{user_id}/active")
def admin_update_active(
    user_id: str,
    payload: AdminUpdateUserActivePayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    require_super_admin(xingce_session)
    try:
        user = access_svc.update_managed_user_active(user_id, payload.is_active)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "user": user}
