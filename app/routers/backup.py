from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Cookie, HTTPException, Query, Request
from fastapi.responses import JSONResponse, Response

from app.core import require_user
from app.runtime import infer_request_origin
from app.schemas import (
    BackupPayload,
    CloudChunkCompletePayload,
    CloudChunkDownloadInitPayload,
    CloudChunkInitPayload,
    LocalBackupCreatePayload,
    LocalBackupRestorePayload,
    OriginStatusPayload,
)
from app.services.backup_service import (
    BackupConflictError,
    BackupSnapshotNotFoundError,
    ChunkUploadInvalidError,
    ChunkUploadNotFoundError,
    complete_chunk_upload,
    download_chunk_part,
    create_local_backup_response,
    delete_local_backup_response,
    get_backup_response,
    init_chunk_download,
    init_chunk_upload,
    list_local_backup_items,
    restore_local_backup_response,
    save_backup,
    upload_chunk_part,
    update_origin_status,
    ChunkDownloadInvalidError,
    ChunkDownloadNotFoundError,
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


@router.post("/api/backup/chunk/init")
def init_backup_chunk_upload(
    payload: CloudChunkInitPayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user_id = _user_id_from_session(xingce_session)
    return init_chunk_upload(user_id, payload)


@router.put("/api/backup/chunk/{upload_id}/part")
async def put_backup_chunk_part(
    upload_id: str,
    request: Request,
    index: int = Query(default=0, ge=0),
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user_id = _user_id_from_session(xingce_session)
    body = await request.body()
    try:
        return upload_chunk_part(user_id, upload_id, index, body)
    except ChunkUploadNotFoundError as exc:
        raise HTTPException(status_code=404, detail=exc.detail) from exc
    except ChunkUploadInvalidError as exc:
        raise HTTPException(status_code=400, detail=exc.detail) from exc


@router.post("/api/backup/chunk/complete")
def complete_backup_chunk_upload(
    payload: CloudChunkCompletePayload,
    request: Request,
    xingce_session: Optional[str] = Cookie(default=None),
) -> Any:
    user_id = _user_id_from_session(xingce_session)
    try:
        return complete_chunk_upload(
            user_id,
            payload.uploadId,
            current_origin=infer_request_origin(request),
        )
    except BackupConflictError as exc:
        return JSONResponse(exc.payload, status_code=409)
    except ChunkUploadNotFoundError as exc:
        raise HTTPException(status_code=404, detail=exc.detail) from exc
    except ChunkUploadInvalidError as exc:
        raise HTTPException(status_code=400, detail=exc.detail) from exc


@router.post("/api/backup/chunk/download/init")
def init_backup_chunk_download(
    payload: CloudChunkDownloadInitPayload,
    request: Request,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user_id = _user_id_from_session(xingce_session)
    return init_chunk_download(
        user_id,
        payload,
        current_origin=infer_request_origin(request),
    )


@router.get("/api/backup/chunk/download/{download_id}/part")
def get_backup_chunk_download_part(
    download_id: str,
    index: int = Query(default=0, ge=0),
    xingce_session: Optional[str] = Cookie(default=None),
) -> Response:
    user_id = _user_id_from_session(xingce_session)
    try:
        chunk, meta = download_chunk_part(user_id, download_id, index)
    except ChunkDownloadNotFoundError as exc:
        raise HTTPException(status_code=404, detail=exc.detail) from exc
    except ChunkDownloadInvalidError as exc:
        raise HTTPException(status_code=400, detail=exc.detail) from exc
    return Response(
        content=chunk,
        media_type="application/octet-stream",
        headers={
            "x-chunk-index": str(index),
            "x-total-chunks": str(int(meta.get("totalChunks") or 0)),
            "x-total-bytes": str(int(meta.get("totalBytes") or 0)),
        },
    )


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
