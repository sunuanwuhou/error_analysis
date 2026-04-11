from __future__ import annotations

import json
import sqlite3
from typing import Any, Optional

from app.database import get_conn
from app.services.workspace_entity_service import build_workspace_snapshot_from_entities, ensure_workspace_entities_seeded
from app.security import utcnow


def count_knowledge_tree_nodes(nodes: Any) -> int:
    total = 0
    for node in nodes or []:
        if not isinstance(node, dict):
            continue
        total += 1
        total += count_knowledge_tree_nodes(node.get("children") or [])
    return total


def build_backup_summary(payload: dict[str, Any]) -> dict[str, Any]:
    tree = payload.get("knowledgeTree") or {}
    roots = tree.get("roots") if isinstance(tree, dict) else tree
    return {
        "errors": len(payload.get("errors") or []),
        "notesByType": len(payload.get("notesByType") or {}),
        "noteImages": len(payload.get("noteImages") or {}),
        "knowledgeNodes": count_knowledge_tree_nodes(roots or []),
        "knowledgeNotes": len(payload.get("knowledgeNotes") or {}),
        "history": len(payload.get("history") or []),
    }


def get_workspace_snapshot_updated_at(user_id: str, conn: sqlite3.Connection) -> str:
    ensure_workspace_entities_seeded(user_id, conn)
    row = conn.execute(
        """
        SELECT MAX(updated_at) AS updated_at
        FROM state_entities
        WHERE user_id = ? AND entity_type IN ('error', 'note_type', 'note_image', 'knowledge_node', 'setting')
        """,
        (user_id,),
    ).fetchone()
    return str((row["updated_at"] if row else "") or "")


def load_backup_payload(user_id: str) -> dict[str, Any]:
    with get_conn() as conn:
        materialized = build_workspace_snapshot_from_entities(user_id, conn)
        if materialized:
            return materialized
        row = conn.execute(
            "SELECT payload_json FROM user_backups WHERE user_id = ?",
            (user_id,),
        ).fetchone()
    if not row:
        return {}
    try:
        data = json.loads(row["payload_json"])
        return data if isinstance(data, dict) else {}
    except json.JSONDecodeError:
        return {}


def save_backup_payload(user_id: str, payload: dict[str, Any]) -> None:
    updated_at = utcnow().isoformat()
    body = dict(payload or {})
    body["exportTime"] = body.get("exportTime") or updated_at
    with get_conn() as conn:
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
        conn.commit()


def get_backup_errors(user_id: str) -> list[dict[str, Any]]:
    payload = load_backup_payload(user_id)
    errors = payload.get("errors") or []
    return [item for item in errors if isinstance(item, dict)]


def flatten_knowledge_tree(nodes: Any, path: Optional[list[str]] = None) -> list[dict[str, Any]]:
    path = path or []
    if not isinstance(nodes, list):
        return []
    flat: list[dict[str, Any]] = []
    for node in nodes:
        if not isinstance(node, dict):
            continue
        title = str(node.get("title") or "").strip()
        node_id = str(node.get("id") or "").strip()
        current_path = [*path, title] if title else list(path)
        flat.append(
            {
                "id": node_id,
                "title": title,
                "path": current_path,
                "contentMd": str(node.get("contentMd") or ""),
                "isLeaf": bool(node.get("isLeaf")),
                "childCount": len(node.get("children") or []),
            }
        )
        flat.extend(flatten_knowledge_tree(node.get("children") or [], current_path))
    return flat
