from __future__ import annotations

import hashlib
import json
import os
import re
import secrets
import shutil
import sqlite3
import urllib.error
import urllib.request
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Cookie, File, HTTPException, Query, Request, Response, UploadFile
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse

from app.config import (
    BACKUPS_DIR,
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
    LocalBackupCreatePayload,
    LocalBackupRestorePayload,
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


def _now_local_iso() -> str:
    return datetime.now().astimezone().isoformat()


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


def _read_user_image_rows(conn: sqlite3.Connection, user_id: str) -> list[dict[str, Any]]:
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


def _list_local_backups(user_id: str) -> list[dict[str, Any]]:
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
    auto_items = [item for item in _list_local_backups(user_id) if item.get("kind") == "auto"]
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
    items = _list_local_backups(user_id)
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
        raise HTTPException(status_code=404, detail="backup snapshot not found")
    meta = _read_backup_meta(backup_dir)
    if not meta:
        raise HTTPException(status_code=404, detail="backup meta missing")
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


@router.get("/api/backup")
def get_backup(
    request: Request,
    meta: bool = Query(default=False),
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    current_origin = infer_request_origin(request)
    with get_conn() as conn:
        materialized = build_workspace_snapshot_from_entities(user["id"], conn)
        row = conn.execute(
            "SELECT payload_json, updated_at FROM user_backups WHERE user_id = ?",
            (user["id"],),
        ).fetchone()
    if materialized:
        updated_at = str(materialized.get("exportTime") or materialized.get("baseUpdatedAt") or "")
        response = {
            "exists": True,
            "currentOrigin": current_origin,
            "updatedAt": updated_at,
            "payloadBytes": len(json.dumps(materialized, ensure_ascii=False)),
            "summary": build_backup_summary(materialized),
            "payload": None if meta else materialized,
            "backup": None if meta else materialized,
            "origins": list_origin_statuses(user["id"]),
        }
        return response
    if not row:
        return {
            "exists": False,
            "currentOrigin": current_origin,
            "payloadBytes": 0,
            "summary": {},
            "payload": None,
            "backup": None,
            "origins": list_origin_statuses(user["id"]),
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
        "origins": list_origin_statuses(user["id"]),
    }

@router.put("/api/backup")
def put_backup(payload: BackupPayload, request: Request, xingce_session: Optional[str] = Cookie(default=None)) -> dict[str, Any]:
    user = require_user(xingce_session)
    current_origin = infer_request_origin(request)
    updated_at = _now_local_iso()
    body = payload.dict()
    if not body.get("exportTime"):
        body["exportTime"] = updated_at

    with get_conn() as conn:
        existing = conn.execute(
            "SELECT updated_at FROM user_backups WHERE user_id = ?",
            (user["id"],),
        ).fetchone()
        existing_updated_at = existing["updated_at"] if existing else ""
        base_updated_at = (payload.baseUpdatedAt or "").strip()

        if existing_updated_at and not payload.forceOverwrite:
            if not base_updated_at:
                return JSONResponse(
                    {
                        "error": "cloud backup changed; reload latest backup before saving",
                        "currentUpdatedAt": existing_updated_at,
                        "currentOrigin": current_origin,
                        "origins": list_origin_statuses(user["id"]),
                    },
                    status_code=409,
                )
            base_dt = parse_iso_datetime(base_updated_at)
            existing_dt = parse_iso_datetime(existing_updated_at)
            if not base_dt or not existing_dt:
                return JSONResponse(
                    {
                        "error": "cloud backup version is invalid; reload latest backup before saving",
                        "currentUpdatedAt": existing_updated_at,
                        "currentOrigin": current_origin,
                        "origins": list_origin_statuses(user["id"]),
                    },
                    status_code=409,
                )
            if existing_dt > base_dt:
                return JSONResponse(
                    {
                        "error": "cloud backup is newer than your local base version",
                        "currentUpdatedAt": existing_updated_at,
                        "currentOrigin": current_origin,
                        "origins": list_origin_statuses(user["id"]),
                    },
                    status_code=409,
                )

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
        append_workspace_snapshot_ops(
            user["id"],
            body,
            conn,
            updated_at,
        )
        replace_workspace_entities_from_snapshot(
            user["id"],
            body,
            conn,
            updated_at,
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

@router.post("/api/origin-status")
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


@router.get("/api/local-backups")
def list_local_backups(
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    return {
        "ok": True,
        "items": _list_local_backups(user["id"]),
    }


@router.post("/api/local-backups/create")
def create_local_backup(
    payload: LocalBackupCreatePayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    kind = _normalize_backup_kind(payload.kind)
    label = _normalize_backup_label(payload.label)
    item, skipped = _create_local_backup_snapshot(
        user["id"],
        kind=kind,
        label=label,
        skip_recent_hours=int(payload.skipRecentHours or 0),
    )
    return {
        "ok": True,
        "created": not skipped,
        "skipped": skipped,
        "item": item,
        "items": _list_local_backups(user["id"]),
    }


@router.post("/api/local-backups/restore")
def restore_local_backup(
    payload: LocalBackupRestorePayload,
    request: Request,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    current_origin = infer_request_origin(request)
    kind = "before_restore"
    safety_item = None
    if payload.createSafetyBackup:
      safety_item, _ = _create_local_backup_snapshot(
          user["id"],
          kind=kind,
          label="恢复前自动备份",
          skip_recent_hours=0,
      )

    backup_dir, snapshot, image_rows, meta = _load_snapshot_bundle(user["id"], payload.backupId)
    restored_image_files = _restore_user_images(user["id"], backup_dir)
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
            (user["id"], json.dumps(snapshot, ensure_ascii=False), updated_at),
        )
        replace_workspace_entities_from_snapshot(
            user["id"],
            snapshot,
            conn,
            updated_at,
        )
        conn.execute("DELETE FROM user_images WHERE user_id = ?", (user["id"],))
        for row in image_rows:
            conn.execute(
                """
                INSERT INTO user_images(hash, user_id, content_type, size_bytes, ref_count, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    str(row.get("hash") or ""),
                    user["id"],
                    str(row.get("content_type") or "image/jpeg"),
                    int(row.get("size_bytes") or 0),
                    int(row.get("ref_count") or 1),
                    str(row.get("created_at") or updated_at),
                ),
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
        "backupId": meta.get("id"),
        "currentOrigin": current_origin,
        "restoredImageFiles": restored_image_files,
        "summary": meta.get("summary") or build_backup_summary(snapshot),
        "safetyBackup": safety_item,
        "items": _list_local_backups(user["id"]),
    }


@router.delete("/api/local-backups/{backup_id}")
def delete_local_backup(
    backup_id: str,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    backup_dir = _user_backup_root(user["id"]) / backup_id
    if not backup_dir.exists():
        raise HTTPException(status_code=404, detail="backup snapshot not found")
    shutil.rmtree(backup_dir, ignore_errors=True)
    return {
        "ok": True,
        "items": _list_local_backups(user["id"]),
    }
