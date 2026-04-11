from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Cookie, HTTPException, Query, Request
from fastapi.responses import JSONResponse

from app.core import require_user
from app.runtime import infer_request_origin
from app.schemas import BackupPayload, LocalBackupCreatePayload, LocalBackupRestorePayload, OriginStatusPayload
from app.services.backup_service import (
    BackupConflictError,
    BackupSnapshotNotFoundError,
    create_local_backup_response,
    delete_local_backup_response,
    get_backup_response,
    list_local_backup_items,
    restore_local_backup_response,
    save_backup,
    update_origin_status,
)

router = APIRouter()


def _user_id_from_session(xingce_session: Optional[str]) -> str:
    user = require_user(xingce_session)
    return str(user["id"])


@router.get("/api/backup")
def get_backup(
    request: Request,
    meta: bool = Query(default=False),
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user_id = _user_id_from_session(xingce_session)
    return get_backup_response(
        user_id,
        current_origin=infer_request_origin(request),
        meta=meta,
    )


@router.put("/api/backup")
def put_backup(
    payload: BackupPayload,
    request: Request,
    xingce_session: Optional[str] = Cookie(default=None),
) -> Any:
    user_id = _user_id_from_session(xingce_session)
    try:
        return save_backup(
            user_id,
            payload,
            current_origin=infer_request_origin(request),
        )
    except BackupConflictError as exc:
        return JSONResponse(exc.payload, status_code=409)


@router.post("/api/origin-status")
def put_origin_status(
    payload: OriginStatusPayload,
    request: Request,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user_id = _user_id_from_session(xingce_session)
    return update_origin_status(
        user_id,
        payload,
        current_origin=infer_request_origin(request),
    )


@router.get("/api/local-backups")
def list_local_backups(
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user_id = _user_id_from_session(xingce_session)
    return {
        "ok": True,
        "items": list_local_backup_items(user_id),
    }


@router.post("/api/local-backups/create")
def create_local_backup(
    payload: LocalBackupCreatePayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user_id = _user_id_from_session(xingce_session)
    return create_local_backup_response(user_id, payload)


@router.post("/api/local-backups/restore")
def restore_local_backup(
    payload: LocalBackupRestorePayload,
    request: Request,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user_id = _user_id_from_session(xingce_session)
    try:
        return restore_local_backup_response(
            user_id,
            payload,
            current_origin=infer_request_origin(request),
        )
    except BackupSnapshotNotFoundError as exc:
        raise HTTPException(status_code=404, detail=exc.detail) from exc


@router.delete("/api/local-backups/{backup_id}")
def delete_local_backup(
    backup_id: str,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user_id = _user_id_from_session(xingce_session)
    return delete_local_backup_response(user_id, backup_id)
