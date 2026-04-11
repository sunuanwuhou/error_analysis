from __future__ import annotations

import json
import re
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any, Optional
from uuid import uuid4

from app.config import BACKUPS_DIR, IMAGES_DIR
from app.database import get_conn
from app.schemas import (
    BackupPayload,
    CloudChunkInitPayload,
    LocalBackupCreatePayload,
    LocalBackupRestorePayload,
    OriginStatusPayload,
)
from app.services.origin_status_service import list_origin_statuses, upsert_origin_status
from app.services.snapshot_service import build_backup_summary
from app.services.workspace_entity_service import (
    append_workspace_snapshot_ops,
    build_workspace_snapshot_from_entities,
    replace_workspace_entities_from_snapshot,
)
from app.security import parse_iso_datetime, utcnow


class BackupConflictError(Exception):
    def __init__(self, payload: dict[str, Any]) -> None:
        super().__init__(str(payload.get("error") or "backup conflict"))
        self.payload = payload


class BackupSnapshotNotFoundError(Exception):
    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class ChunkUploadNotFoundError(Exception):
    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class ChunkUploadInvalidError(Exception):
    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


def _now_local_iso() -> str:
    return datetime.now().astimezone().isoformat()


def _chunk_upload_root(user_id: str) -> Path:
    root = BACKUPS_DIR / "_chunk_uploads" / user_id
    root.mkdir(parents=True, exist_ok=True)
    return root


def _user_backup_root(user_id: str) -> Path:
    root = BACKUPS_DIR / user_id
    root.mkdir(parents=True, exist_ok=True)
    return root


def _normalize_backup_kind(raw: str) -> str:
    kind = re.sub(r"[^a-z0-9_]+", "_", str(raw or "manual").strip().lower()).strip("_")
    return kind or "manual"


def _normalize_backup_label(raw: str) -> str:
    return re.sub(r"\s+", " ", str(raw or "").strip())[:80]


def _make_backup_id(kind: str, created_at: str) -> str:
    stamp = created_at.replace(":", "").replace("-", "").replace("T", "_").split(".")[0]
    return f"{kind}_{stamp}"


def _read_user_image_rows(conn: Any, user_id: str) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT hash, content_type, size_bytes, ref_count, created_at
        FROM user_images
        WHERE user_id = ?
        ORDER BY created_at ASC, hash ASC
        """,
        (user_id,),
    ).fetchall()
    return [dict(row) for row in rows]


def _write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def _copy_user_images_into_snapshot(user_id: str, target_dir: Path) -> int:
    source_dir = IMAGES_DIR / user_id
    if not source_dir.exists():
        return 0
    copied = 0
    snapshot_dir = target_dir / "images"
    snapshot_dir.mkdir(parents=True, exist_ok=True)
    for item in source_dir.iterdir():
        if not item.is_file():
            continue
        shutil.copy2(item, snapshot_dir / item.name)
        copied += 1
    return copied


def _build_snapshot_meta(
    backup_id: str,
    *,
    kind: str,
    label: str,
    created_at: str,
    snapshot: dict[str, Any],
    image_rows: list[dict[str, Any]],
    image_file_count: int,
) -> dict[str, Any]:
    summary = build_backup_summary(snapshot)
    return {
        "id": backup_id,
        "kind": kind,
        "label": label,
        "createdAt": created_at,
        "summary": summary,
        "errorCount": int(summary.get("errors") or 0),
        "knowledgeNodeCount": int(summary.get("knowledgeNodes") or 0),
        "knowledgeNoteCount": int(summary.get("knowledgeNotes") or 0),
        "noteModuleCount": int(summary.get("notesByType") or 0),
        "noteImageRefCount": int(summary.get("noteImages") or 0),
        "imageFileCount": image_file_count,
        "userImageRowCount": len(image_rows),
    }


def _snapshot_directory_size(path: Path) -> int:
    total = 0
    for item in path.rglob("*"):
        if item.is_file():
            total += item.stat().st_size
    return total


def _read_backup_meta(path: Path) -> Optional[dict[str, Any]]:
    meta_path = path / "meta.json"
    if not meta_path.exists():
        return None
    meta = _read_json(meta_path, {})
    meta["sizeBytes"] = _snapshot_directory_size(path)
    return meta


def list_local_backup_items(user_id: str) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    root = _user_backup_root(user_id)
    for child in root.iterdir():
        if not child.is_dir():
            continue
        meta = _read_backup_meta(child)
        if not meta:
            continue
        items.append(meta)
    items.sort(key=lambda item: str(item.get("createdAt") or ""), reverse=True)
    return items


def _prune_old_auto_backups(user_id: str, keep: int = 14) -> None:
    auto_items = [item for item in list_local_backup_items(user_id) if item.get("kind") == "auto"]
    for stale in auto_items[keep:]:
        backup_dir = _user_backup_root(user_id) / str(stale.get("id") or "")
        if backup_dir.exists():
            shutil.rmtree(backup_dir, ignore_errors=True)


def _create_local_backup_snapshot(
    user_id: str,
    *,
    kind: str,
    label: str,
    skip_recent_hours: int = 0,
) -> tuple[dict[str, Any], bool]:
    items = list_local_backup_items(user_id)
    if skip_recent_hours > 0:
        latest_same_kind = next((item for item in items if item.get("kind") == kind), None)
        latest_at = parse_iso_datetime(str(latest_same_kind.get("createdAt") or "")) if latest_same_kind else None
        if latest_at:
            delta_seconds = (utcnow() - latest_at).total_seconds()
            if delta_seconds < skip_recent_hours * 3600:
                latest_same_kind["skipped"] = True
                return latest_same_kind, True

    with get_conn() as conn:
        snapshot = build_workspace_snapshot_from_entities(user_id, conn)
        image_rows = _read_user_image_rows(conn, user_id)
    created_at = _now_local_iso()
    backup_id = _make_backup_id(kind, created_at)
    backup_dir = _user_backup_root(user_id) / backup_id
    backup_dir.mkdir(parents=True, exist_ok=True)
    _write_json(backup_dir / "snapshot.json", snapshot)
    _write_json(backup_dir / "image_rows.json", image_rows)
    image_file_count = _copy_user_images_into_snapshot(user_id, backup_dir)
    meta = _build_snapshot_meta(
        backup_id,
        kind=kind,
        label=label,
        created_at=created_at,
        snapshot=snapshot,
        image_rows=image_rows,
        image_file_count=image_file_count,
    )
    _write_json(backup_dir / "meta.json", meta)
    if kind == "auto":
        _prune_old_auto_backups(user_id, keep=14)
    meta["sizeBytes"] = _snapshot_directory_size(backup_dir)
    return meta, False


def _load_snapshot_bundle(user_id: str, backup_id: str) -> tuple[Path, dict[str, Any], list[dict[str, Any]], dict[str, Any]]:
    backup_dir = _user_backup_root(user_id) / backup_id
    if not backup_dir.exists():
        raise BackupSnapshotNotFoundError("backup snapshot not found")
    meta = _read_backup_meta(backup_dir)
    if not meta:
        raise BackupSnapshotNotFoundError("backup meta missing")
    snapshot = _read_json(backup_dir / "snapshot.json", {})
    image_rows = _read_json(backup_dir / "image_rows.json", [])
    return backup_dir, snapshot, image_rows, meta


def _restore_user_images(user_id: str, backup_dir: Path) -> int:
    target_dir = IMAGES_DIR / user_id
    source_dir = backup_dir / "images"
    if target_dir.exists():
        shutil.rmtree(target_dir, ignore_errors=True)
    if not source_dir.exists():
        return 0
    shutil.copytree(source_dir, target_dir)
    return sum(1 for item in target_dir.iterdir() if item.is_file())


def _chunk_session_dir(user_id: str, upload_id: str) -> Path:
    return _chunk_upload_root(user_id) / upload_id


def _load_chunk_meta(user_id: str, upload_id: str) -> dict[str, Any]:
    session_dir = _chunk_session_dir(user_id, upload_id)
    if not session_dir.exists():
        raise ChunkUploadNotFoundError("chunk upload session not found")
    meta_path = session_dir / "meta.json"
    if not meta_path.exists():
        raise ChunkUploadInvalidError("chunk upload metadata missing")
    return _read_json(meta_path, {})


def _save_chunk_meta(user_id: str, upload_id: str, meta: dict[str, Any]) -> None:
    session_dir = _chunk_session_dir(user_id, upload_id)
    session_dir.mkdir(parents=True, exist_ok=True)
    _write_json(session_dir / "meta.json", meta)


def _purge_stale_chunk_uploads(user_id: str, keep: int = 6) -> None:
    root = _chunk_upload_root(user_id)
    sessions = [child for child in root.iterdir() if child.is_dir()]
    sessions.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    for stale in sessions[keep:]:
        shutil.rmtree(stale, ignore_errors=True)


def init_chunk_upload(user_id: str, payload: CloudChunkInitPayload) -> dict[str, Any]:
    upload_id = f"up_{uuid4().hex}"
    session_dir = _chunk_session_dir(user_id, upload_id)
    parts_dir = session_dir / "parts"
    parts_dir.mkdir(parents=True, exist_ok=True)
    now = _now_local_iso()
    meta = {
        "uploadId": upload_id,
        "createdAt": now,
        "updatedAt": now,
        "totalBytes": int(payload.totalBytes),
        "totalChunks": int(payload.totalChunks),
        "chunkSize": int(payload.chunkSize),
        "receivedBytes": 0,
        "receivedChunks": [],
        "baseUpdatedAt": str(payload.baseUpdatedAt or ""),
        "forceOverwrite": bool(payload.forceOverwrite),
        "exportTime": str(payload.exportTime or ""),
    }
    _save_chunk_meta(user_id, upload_id, meta)
    _purge_stale_chunk_uploads(user_id)
    return {
        "ok": True,
        "uploadId": upload_id,
        "totalBytes": meta["totalBytes"],
        "totalChunks": meta["totalChunks"],
        "chunkSize": meta["chunkSize"],
        "receivedBytes": 0,
        "receivedChunks": 0,
    }


def upload_chunk_part(user_id: str, upload_id: str, chunk_index: int, body: bytes) -> dict[str, Any]:
    meta = _load_chunk_meta(user_id, upload_id)
    total_chunks = int(meta.get("totalChunks") or 0)
    if chunk_index < 0 or chunk_index >= total_chunks:
        raise ChunkUploadInvalidError("chunk index out of range")
    if not body:
        raise ChunkUploadInvalidError("empty chunk body")

    session_dir = _chunk_session_dir(user_id, upload_id)
    parts_dir = session_dir / "parts"
    parts_dir.mkdir(parents=True, exist_ok=True)
    part_path = parts_dir / f"{chunk_index:06d}.part"
    previous_size = part_path.stat().st_size if part_path.exists() else 0
    part_path.write_bytes(body)
    current_size = part_path.stat().st_size
    received_list = [int(v) for v in list(meta.get("receivedChunks") or [])]
    if chunk_index not in received_list:
        received_list.append(chunk_index)
    meta["receivedChunks"] = sorted(received_list)
    meta["receivedBytes"] = max(0, int(meta.get("receivedBytes") or 0) - previous_size + current_size)
    meta["updatedAt"] = _now_local_iso()
    _save_chunk_meta(user_id, upload_id, meta)
    return {
        "ok": True,
        "uploadId": upload_id,
        "chunkIndex": chunk_index,
        "receivedChunks": len(meta["receivedChunks"]),
        "totalChunks": total_chunks,
        "receivedBytes": int(meta.get("receivedBytes") or 0),
        "totalBytes": int(meta.get("totalBytes") or 0),
    }


def complete_chunk_upload(user_id: str, upload_id: str, *, current_origin: str) -> dict[str, Any]:
    meta = _load_chunk_meta(user_id, upload_id)
    total_chunks = int(meta.get("totalChunks") or 0)
    total_bytes = int(meta.get("totalBytes") or 0)
    received_chunks = sorted(int(v) for v in list(meta.get("receivedChunks") or []))
    if len(received_chunks) != total_chunks:
        raise ChunkUploadInvalidError("chunk upload not complete")
    for idx, value in enumerate(received_chunks):
        if value != idx:
            raise ChunkUploadInvalidError("missing chunk segments")

    session_dir = _chunk_session_dir(user_id, upload_id)
    parts_dir = session_dir / "parts"
    assembled = bytearray()
    for idx in range(total_chunks):
        part_path = parts_dir / f"{idx:06d}.part"
        if not part_path.exists():
            raise ChunkUploadInvalidError(f"chunk part {idx} missing")
        assembled.extend(part_path.read_bytes())
    if len(assembled) != total_bytes:
        raise ChunkUploadInvalidError("chunk byte size mismatch")
    try:
        payload_data = json.loads(assembled.decode("utf-8"))
    except Exception as exc:
        raise ChunkUploadInvalidError("chunk payload decode failed") from exc

    payload_data["baseUpdatedAt"] = str(meta.get("baseUpdatedAt") or payload_data.get("baseUpdatedAt") or "")
    payload_data["forceOverwrite"] = bool(meta.get("forceOverwrite") or payload_data.get("forceOverwrite") or False)
    if meta.get("exportTime") and not payload_data.get("exportTime"):
        payload_data["exportTime"] = str(meta.get("exportTime"))
    payload = BackupPayload(**payload_data)
    result = save_backup(user_id, payload, current_origin=current_origin)
    shutil.rmtree(session_dir, ignore_errors=True)
    return {
        "ok": True,
        "mode": "chunked_full_backup",
        **result,
    }


def get_backup_response(user_id: str, *, current_origin: str, meta: bool) -> dict[str, Any]:
    with get_conn() as conn:
        materialized = build_workspace_snapshot_from_entities(user_id, conn)
        row = conn.execute(
            "SELECT payload_json, updated_at FROM user_backups WHERE user_id = ?",
            (user_id,),
        ).fetchone()
    if materialized:
        updated_at = str(materialized.get("exportTime") or materialized.get("baseUpdatedAt") or "")
        return {
            "exists": True,
            "currentOrigin": current_origin,
            "updatedAt": updated_at,
            "payloadBytes": len(json.dumps(materialized, ensure_ascii=False)),
            "summary": build_backup_summary(materialized),
            "payload": None if meta else materialized,
            "backup": None if meta else materialized,
            "origins": list_origin_statuses(user_id),
        }
    if not row:
        return {
            "exists": False,
            "currentOrigin": current_origin,
            "payloadBytes": 0,
            "summary": {},
            "payload": None,
            "backup": None,
            "origins": list_origin_statuses(user_id),
        }
    payload_text = row["payload_json"] or "{}"
    backup = json.loads(payload_text)
    return {
        "exists": True,
        "currentOrigin": current_origin,
        "updatedAt": row["updated_at"],
        "payloadBytes": len(payload_text.encode("utf-8")),
        "summary": build_backup_summary(backup),
        "payload": None if meta else backup,
        "backup": None if meta else backup,
        "origins": list_origin_statuses(user_id),
    }


def save_backup(user_id: str, payload: BackupPayload, *, current_origin: str) -> dict[str, Any]:
    updated_at = _now_local_iso()
    body = payload.dict()
    if not body.get("exportTime"):
        body["exportTime"] = updated_at

    with get_conn() as conn:
        existing = conn.execute(
            "SELECT updated_at FROM user_backups WHERE user_id = ?",
            (user_id,),
        ).fetchone()
        existing_updated_at = existing["updated_at"] if existing else ""
        base_updated_at = (payload.baseUpdatedAt or "").strip()

        if existing_updated_at and not payload.forceOverwrite:
            if not base_updated_at:
                raise BackupConflictError(
                    {
                        "error": "cloud backup changed; reload latest backup before saving",
                        "currentUpdatedAt": existing_updated_at,
                        "currentOrigin": current_origin,
                        "origins": list_origin_statuses(user_id),
                    }
                )
            base_dt = parse_iso_datetime(base_updated_at)
            existing_dt = parse_iso_datetime(existing_updated_at)
            if not base_dt or not existing_dt:
                raise BackupConflictError(
                    {
                        "error": "cloud backup version is invalid; reload latest backup before saving",
                        "currentUpdatedAt": existing_updated_at,
                        "currentOrigin": current_origin,
                        "origins": list_origin_statuses(user_id),
                    }
                )
            if existing_dt > base_dt:
                raise BackupConflictError(
                    {
                        "error": "cloud backup is newer than your local base version",
                        "currentUpdatedAt": existing_updated_at,
                        "currentOrigin": current_origin,
                        "origins": list_origin_statuses(user_id),
                    }
                )

        conn.execute(
            """
            INSERT INTO user_backups(user_id, payload_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              payload_json = excluded.payload_json,
              updated_at = excluded.updated_at
            """,
            (user_id, json.dumps(body, ensure_ascii=False), updated_at),
        )
        append_workspace_snapshot_ops(user_id, body, conn, updated_at)
        replace_workspace_entities_from_snapshot(user_id, body, conn, updated_at)
        conn.commit()

    upsert_origin_status(
        user_id,
        current_origin,
        last_local_change_at=updated_at,
        last_saved_at=updated_at,
        last_backup_updated_at=updated_at,
    )

    return {
        "ok": True,
        "updatedAt": updated_at,
        "currentOrigin": current_origin,
        "origins": list_origin_statuses(user_id),
    }


def update_origin_status(user_id: str, payload: OriginStatusPayload, *, current_origin: str) -> dict[str, Any]:
    upsert_origin_status(
        user_id,
        current_origin,
        last_local_change_at=payload.localChangedAt,
        last_loaded_at=payload.lastLoadedAt,
        last_saved_at=payload.lastSavedAt,
        last_backup_updated_at=payload.lastBackupUpdatedAt,
    )
    return {
        "ok": True,
        "currentOrigin": current_origin,
        "origins": list_origin_statuses(user_id),
    }


def create_local_backup_response(user_id: str, payload: LocalBackupCreatePayload) -> dict[str, Any]:
    kind = _normalize_backup_kind(payload.kind)
    label = _normalize_backup_label(payload.label)
    item, skipped = _create_local_backup_snapshot(
        user_id,
        kind=kind,
        label=label,
        skip_recent_hours=int(payload.skipRecentHours or 0),
    )
    return {
        "ok": True,
        "created": not skipped,
        "skipped": skipped,
        "item": item,
        "items": list_local_backup_items(user_id),
    }


def restore_local_backup_response(
    user_id: str,
    payload: LocalBackupRestorePayload,
    *,
    current_origin: str,
) -> dict[str, Any]:
    safety_item = None
    if payload.createSafetyBackup:
        safety_item, _ = _create_local_backup_snapshot(
            user_id,
            kind="before_restore",
            label="恢复前自动备份",
            skip_recent_hours=0,
        )

    backup_dir, snapshot, image_rows, meta = _load_snapshot_bundle(user_id, payload.backupId)
    restored_image_files = _restore_user_images(user_id, backup_dir)
    updated_at = utcnow().isoformat()
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO user_backups(user_id, payload_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              payload_json = excluded.payload_json,
              updated_at = excluded.updated_at
            """,
            (user_id, json.dumps(snapshot, ensure_ascii=False), updated_at),
        )
        replace_workspace_entities_from_snapshot(user_id, snapshot, conn, updated_at)
        conn.execute("DELETE FROM user_images WHERE user_id = ?", (user_id,))
        for row in image_rows:
            conn.execute(
                """
                INSERT INTO user_images(hash, user_id, content_type, size_bytes, ref_count, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    str(row.get("hash") or ""),
                    user_id,
                    str(row.get("content_type") or "image/jpeg"),
                    int(row.get("size_bytes") or 0),
                    int(row.get("ref_count") or 1),
                    str(row.get("created_at") or updated_at),
                ),
            )
        conn.commit()

    upsert_origin_status(
        user_id,
        current_origin,
        last_local_change_at=updated_at,
        last_saved_at=updated_at,
        last_backup_updated_at=updated_at,
    )
    return {
        "ok": True,
        "updatedAt": updated_at,
        "backupId": meta.get("id"),
        "currentOrigin": current_origin,
        "restoredImageFiles": restored_image_files,
        "summary": meta.get("summary") or build_backup_summary(snapshot),
        "safetyBackup": safety_item,
        "items": list_local_backup_items(user_id),
    }


def delete_local_backup_response(user_id: str, backup_id: str) -> dict[str, Any]:
    backup_dir = _user_backup_root(user_id) / backup_id
    if backup_dir.exists():
        shutil.rmtree(backup_dir, ignore_errors=True)
    return {
        "ok": True,
        "items": list_local_backup_items(user_id),
    }
