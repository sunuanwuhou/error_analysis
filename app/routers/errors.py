from __future__ import annotations

import json
import uuid
from typing import Any, Optional

from fastapi import APIRouter, Cookie, HTTPException

from app.core import apply_sync_op_to_state_entity, ensure_workspace_entities_seeded, normalize_error_sync_record, require_user
from app.database import get_conn
from app.schemas import ErrorUpsertPayload
from app.security import utcnow

router = APIRouter()


def _load_error_record(user_id: str, error_id: str) -> Optional[dict[str, Any]]:
    with get_conn() as conn:
        ensure_workspace_entities_seeded(user_id, conn)
        row = conn.execute(
            """
            SELECT payload_json, updated_at, deleted_at
            FROM state_entities
            WHERE user_id = ? AND entity_type = 'error' AND entity_id = ?
            """,
            (user_id, error_id),
        ).fetchone()
    if not row or str(row["deleted_at"] or "").strip():
        return None
    try:
        payload = json.loads(row["payload_json"] or "{}")
    except json.JSONDecodeError:
        payload = {}
    return normalize_error_sync_record(payload, str(row["updated_at"] or ""))


def _persist_error_upsert(user_id: str, entity_id: str, record: dict[str, Any], created_at: str) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO operations(id, user_id, op_type, entity_id, payload, created_at)
            VALUES (?, ?, 'error_upsert', ?, ?, ?)
            """,
            (str(uuid.uuid4()), user_id, entity_id, json.dumps(record, ensure_ascii=False), created_at),
        )
        apply_sync_op_to_state_entity(
            user_id,
            {
                "op_type": "error_upsert",
                "entity_id": entity_id,
                "payload": record,
                "created_at": created_at,
            },
            conn,
        )
        conn.commit()


@router.get("/api/errors/{error_id}")
def get_error(error_id: str, xingce_session: Optional[str] = Cookie(default=None)) -> dict[str, Any]:
    user = require_user(xingce_session)
    record = _load_error_record(user["id"], error_id)
    if not record:
        raise HTTPException(status_code=404, detail="error not found")
    return {"ok": True, "item": record}


@router.post("/api/errors")
def create_error(payload: ErrorUpsertPayload, xingce_session: Optional[str] = Cookie(default=None)) -> dict[str, Any]:
    user = require_user(xingce_session)
    created_at = utcnow().isoformat()
    entity_id = str(payload.id or uuid.uuid4())
    record = normalize_error_sync_record(
        {
            **payload.model_dump(),
            "id": entity_id,
            "entryKind": "error",
            "addDate": payload.addDate or created_at[:10],
            "createdAt": payload.createdAt or created_at,
            "updatedAt": created_at,
        },
        created_at,
    )
    if not record:
        raise HTTPException(status_code=400, detail="invalid error payload")
    _persist_error_upsert(user["id"], entity_id, record, created_at)
    return {"ok": True, "item": record}


@router.delete("/api/errors/{error_id}")
def delete_error(error_id: str, xingce_session: Optional[str] = Cookie(default=None)) -> dict[str, Any]:
    user = require_user(xingce_session)
    existing = _load_error_record(user["id"], error_id)
    if not existing:
        raise HTTPException(status_code=404, detail="error not found")
    deleted_at = utcnow().isoformat()
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO operations(id, user_id, op_type, entity_id, payload, created_at)
            VALUES (?, ?, 'error_delete', ?, '{}', ?)
            """,
            (str(uuid.uuid4()), user["id"], error_id, deleted_at),
        )
        conn.execute(
            """
            UPDATE state_entities SET deleted_at = ?
            WHERE user_id = ? AND entity_type = 'error' AND entity_id = ?
            """,
            (deleted_at, user["id"], error_id),
        )
        conn.commit()
    return {"ok": True}


@router.patch("/api/errors/{error_id}/mastery")
def patch_error_mastery(
    error_id: str,
    payload: dict[str, Any],
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    existing = _load_error_record(user["id"], error_id)
    if not existing:
        raise HTTPException(status_code=404, detail="error not found")
    updated_at = utcnow().isoformat()
    allowed_keys = {"masteryLevel", "confidence", "status", "workflowStage", "nextActionType"}
    patch = {k: v for k, v in payload.items() if k in allowed_keys}
    record = normalize_error_sync_record({**existing, **patch, "updatedAt": updated_at}, updated_at)
    if not record:
        raise HTTPException(status_code=400, detail="invalid patch")
    _persist_error_upsert(user["id"], error_id, record, updated_at)
    return {"ok": True, "item": record}


@router.put("/api/errors/{error_id}")
def update_error(
    error_id: str,
    payload: ErrorUpsertPayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    existing = _load_error_record(user["id"], error_id)
    if not existing:
        raise HTTPException(status_code=404, detail="error not found")
    created_at = utcnow().isoformat()
    record = normalize_error_sync_record(
        {
            **existing,
            **payload.model_dump(),
            "id": error_id,
            "entryKind": "error",
            "addDate": payload.addDate or str(existing.get("addDate") or created_at[:10]),
            "createdAt": payload.createdAt or str(existing.get("createdAt") or created_at),
            "updatedAt": created_at,
        },
        created_at,
    )
    if not record:
        raise HTTPException(status_code=400, detail="invalid error payload")
    _persist_error_upsert(user["id"], error_id, record, created_at)
    return {"ok": True, "item": record}
