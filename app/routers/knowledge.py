from __future__ import annotations

import hashlib
import json
import os
import re
import secrets
import sqlite3
import urllib.error
import urllib.request
import uuid
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Cookie, File, HTTPException, Query, Request, Response, UploadFile
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse

from app.config import (
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
    DistillPayload,
    EvaluateAnswerPayload,
    GenerateQuestionPayload,
    ModuleSummaryPayload,
    KnowledgeNodeUpsertPayload,
    OriginStatusPayload,
    PracticeLogPayload,
    SuggestRestructurePayload,
    SyncPushPayload,
    SynthesizeNodePayload,
)
from app.security import clear_session, create_user_account, get_user_by_token, issue_session, utcnow, verify_password

router = APIRouter()


def _load_knowledge_node_record(user_id: str, node_id: str) -> Optional[dict[str, Any]]:
    with get_conn() as conn:
        ensure_workspace_entities_seeded(user_id, conn)
        row = conn.execute(
            """
            SELECT payload_json, updated_at, deleted_at
            FROM state_entities
            WHERE user_id = ? AND entity_type = 'knowledge_node' AND entity_id = ?
            """,
            (user_id, node_id),
        ).fetchone()
    if not row or str(row["deleted_at"] or "").strip():
        return None
    try:
        payload = json.loads(row["payload_json"] or "{}")
    except json.JSONDecodeError:
        payload = {}
    return normalize_knowledge_node_sync_record(node_id, payload, str(row["updated_at"] or ""))


def _persist_knowledge_node_upsert(user_id: str, entity_id: str, record: dict[str, Any], created_at: str) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO operations(id, user_id, op_type, entity_id, payload, created_at)
            VALUES (?, ?, 'knowledge_node_upsert', ?, ?, ?)
            """,
            (str(uuid.uuid4()), user_id, entity_id, json.dumps(record, ensure_ascii=False), created_at),
        )
        apply_sync_op_to_state_entity(
            user_id,
            {
                "op_type": "knowledge_node_upsert",
                "entity_id": entity_id,
                "payload": record,
                "created_at": created_at,
            },
            conn,
        )
        conn.commit()


@router.get("/api/knowledge/search")
def knowledge_search(
    q: str,
    limit: int = 10,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    keyword = q.strip().lower()
    if not keyword:
        return {"ok": True, "nodes": [], "errors": []}
    payload = load_backup_payload(user["id"])
    nodes = flatten_knowledge_tree(payload.get("knowledgeTree") or [])
    node_hits = []
    for node in nodes:
        haystack = " ".join(
            [
                str(node.get("title") or ""),
                " / ".join(node.get("path") or []),
                str(node.get("contentMd") or ""),
            ]
        ).lower()
        if keyword in haystack:
            node_hits.append(
                {
                    "id": node["id"],
                    "title": node["title"],
                    "path": node["path"],
                    "excerpt": clean_multiline_text(node.get("contentMd"), 180),
                }
            )
            if len(node_hits) >= limit:
                break

    error_hits = []
    for error in get_backup_errors(user["id"]):
        haystack = " ".join(
            [
                str(error.get("question") or ""),
                str(error.get("analysis") or ""),
                str(error.get("rootReason") or ""),
                str(error.get("errorReason") or ""),
            ]
        ).lower()
        if keyword in haystack:
            error_hits.append(summarize_error(error))
            if len(error_hits) >= limit:
                break

    return {"ok": True, "nodes": node_hits, "errors": error_hits}


@router.get("/api/knowledge/nodes/{node_id}")
def get_knowledge_node(node_id: str, xingce_session: Optional[str] = Cookie(default=None)) -> dict[str, Any]:
    user = require_user(xingce_session)
    record = _load_knowledge_node_record(user["id"], node_id)
    if not record:
        raise HTTPException(status_code=404, detail="knowledge node not found")
    return {"ok": True, "item": record}


@router.post("/api/knowledge/nodes")
def create_knowledge_node(
    payload: KnowledgeNodeUpsertPayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    created_at = utcnow().isoformat()
    node_id = str(payload.id or uuid.uuid4())
    record = normalize_knowledge_node_sync_record(
        node_id,
        {
            **payload.model_dump(),
            "id": node_id,
            "updatedAt": created_at,
        },
        created_at,
    )
    if not record:
        raise HTTPException(status_code=400, detail="invalid knowledge node payload")
    _persist_knowledge_node_upsert(user["id"], node_id, record, created_at)
    return {"ok": True, "item": record}


@router.put("/api/knowledge/nodes/{node_id}")
def update_knowledge_node(
    node_id: str,
    payload: KnowledgeNodeUpsertPayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    existing = _load_knowledge_node_record(user["id"], node_id)
    if not existing:
        raise HTTPException(status_code=404, detail="knowledge node not found")
    created_at = utcnow().isoformat()
    record = normalize_knowledge_node_sync_record(
      node_id,
      {
          **existing,
          **payload.model_dump(),
          "id": node_id,
          "updatedAt": created_at,
      },
      created_at,
    )
    if not record:
        raise HTTPException(status_code=400, detail="invalid knowledge node payload")
    _persist_knowledge_node_upsert(user["id"], node_id, record, created_at)
    return {"ok": True, "item": record}
