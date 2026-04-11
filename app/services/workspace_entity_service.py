from __future__ import annotations

import base64
import json
import mimetypes
import re
import sqlite3
import uuid
from typing import Any, Optional

from app.config import IMAGES_DIR
from app.database import get_conn
from app.security import utcnow

ENTITY_SYNC_OPS: dict[str, tuple[str, str]] = {
    "error": ("error_upsert", "error_delete"),
    "note_type": ("note_type_upsert", "note_type_delete"),
    "note_image": ("note_image_upsert", "note_image_delete"),
    "knowledge_node": ("knowledge_node_upsert", "knowledge_node_delete"),
    "setting": ("setting_upsert", "setting_delete"),
}
UPSERT_TO_ENTITY_TYPE: dict[str, str] = {ops[0]: entity_type for entity_type, ops in ENTITY_SYNC_OPS.items()}
DELETE_TO_ENTITY_TYPE: dict[str, str] = {ops[1]: entity_type for entity_type, ops in ENTITY_SYNC_OPS.items()}

IMAGE_API_REF_RE = re.compile(r"^/api/images/([a-f0-9]{32,64})$", re.I)


def cleanup_old_ops(user_id: str, conn: sqlite3.Connection) -> None:
    conn.execute(
        "DELETE FROM operations WHERE user_id = ? AND created_at < datetime('now', '-30 days')",
        (user_id,),
    )


def normalize_error_sync_record(raw: Any, fallback_updated_at: str) -> Optional[dict[str, Any]]:
    if not isinstance(raw, dict):
        return None
    entry_kind = str(raw.get("entryKind") or "error").strip() or "error"
    if entry_kind != "error":
        return None
    record = dict(raw)
    record["id"] = str(record.get("id") or uuid.uuid4())
    record["entryKind"] = "error"
    record["updatedAt"] = record.get("updatedAt") or fallback_updated_at or utcnow().isoformat()
    return record


def materialize_backup_image_value(
    user_id: str,
    value: Any,
    conn: sqlite3.Connection,
) -> Any:
    if not isinstance(value, str):
        return value
    match = IMAGE_API_REF_RE.match(value.strip())
    if not match:
        return value
    sha256 = match.group(1)
    row = conn.execute(
        "SELECT content_type FROM user_images WHERE hash = ? AND user_id = ?",
        (sha256, user_id),
    ).fetchone()
    img_path = IMAGES_DIR / user_id / sha256
    if not row or not img_path.exists():
        return value
    content_type = str(row["content_type"] or "").strip() or (mimetypes.guess_type(img_path.name)[0] or "image/jpeg")
    encoded = base64.b64encode(img_path.read_bytes()).decode("ascii")
    return f"data:{content_type};base64,{encoded}"


def materialize_backup_error_images(
    user_id: str,
    error: dict[str, Any],
    conn: sqlite3.Connection,
) -> dict[str, Any]:
    record = dict(error or {})
    record["imgData"] = materialize_backup_image_value(user_id, record.get("imgData"), conn)
    record["analysisImgData"] = materialize_backup_image_value(user_id, record.get("analysisImgData"), conn)
    return record


def normalize_note_type_sync_record(entity_id: str, raw: Any, fallback_updated_at: str) -> dict[str, Any]:
    payload = raw if isinstance(raw, dict) else {"value": raw}
    value = payload.get("value") if isinstance(payload, dict) and "value" in payload else raw
    updated_at = payload.get("updatedAt") if isinstance(payload, dict) else ""
    return {
        "key": str(entity_id),
        "value": value if value is not None else {},
        "updatedAt": updated_at or fallback_updated_at or utcnow().isoformat(),
    }


def normalize_note_image_sync_record(entity_id: str, raw: Any, fallback_updated_at: str) -> dict[str, Any]:
    payload = raw if isinstance(raw, dict) else {"data": raw}
    data = payload.get("data") if isinstance(payload, dict) and "data" in payload else raw
    updated_at = payload.get("updatedAt") if isinstance(payload, dict) else ""
    return {
        "id": str(entity_id),
        "data": data or "",
        "updatedAt": updated_at or fallback_updated_at or utcnow().isoformat(),
    }


def normalize_setting_sync_record(entity_id: str, raw: Any, fallback_updated_at: str) -> dict[str, Any]:
    payload = raw if isinstance(raw, dict) else {"value": raw}
    value = payload.get("value") if isinstance(payload, dict) and "value" in payload else raw
    updated_at = payload.get("updatedAt") if isinstance(payload, dict) else ""
    return {
        "key": str(entity_id),
        "value": value,
        "updatedAt": updated_at or fallback_updated_at or utcnow().isoformat(),
    }


def normalize_knowledge_node_sync_record(entity_id: str, raw: Any, fallback_updated_at: str) -> Optional[dict[str, Any]]:
    if not isinstance(raw, dict):
        return None
    node_id = str(raw.get("id") or entity_id or uuid.uuid4())
    return {
        "id": node_id,
        "parentId": str(raw.get("parentId") or ""),
        "title": str(raw.get("title") or "").strip() or f"知识点{node_id[-4:]}",
        "contentMd": str(raw.get("contentMd") or ""),
        "updatedAt": str(raw.get("updatedAt") or fallback_updated_at or utcnow().isoformat()),
        "sort": int(raw.get("sort") or 0),
    }


def iter_backup_sync_entities(data: dict[str, Any], fallback_updated_at: str) -> list[tuple[str, str, str, str]]:
    entities: list[tuple[str, str, str, str]] = []
    backup_updated_at = fallback_updated_at or utcnow().isoformat()
    knowledge_notes = data.get("knowledgeNotes") or {}

    for raw in data.get("errors") or []:
        record = normalize_error_sync_record(raw, backup_updated_at)
        if not record:
            continue
        entities.append(("error", record["id"], json.dumps(record, ensure_ascii=False), record["updatedAt"]))

    for key, value in (data.get("notesByType") or {}).items():
        record = normalize_note_type_sync_record(str(key), {"value": value}, backup_updated_at)
        entities.append(("note_type", record["key"], json.dumps(record, ensure_ascii=False), record["updatedAt"]))

    for key, value in (data.get("noteImages") or {}).items():
        record = normalize_note_image_sync_record(str(key), {"data": value}, backup_updated_at)
        entities.append(("note_image", record["id"], json.dumps(record, ensure_ascii=False), record["updatedAt"]))

    def walk_knowledge_nodes(nodes: Any, parent_id: str) -> None:
        for idx, raw_node in enumerate(nodes or []):
            if not isinstance(raw_node, dict):
                continue
            node_id = str(raw_node.get("id") or uuid.uuid4())
            legacy_note = knowledge_notes.get(node_id) if isinstance(knowledge_notes, dict) else None
            record = normalize_knowledge_node_sync_record(
                node_id,
                {
                    "id": node_id,
                    "parentId": parent_id,
                    "title": raw_node.get("title"),
                    "contentMd": raw_node.get("contentMd")
                    if raw_node.get("contentMd") is not None
                    else (legacy_note.get("content") if isinstance(legacy_note, dict) else ""),
                    "updatedAt": raw_node.get("updatedAt")
                    or (legacy_note.get("updatedAt") if isinstance(legacy_note, dict) else "")
                    or backup_updated_at,
                    "sort": raw_node.get("sort", idx),
                },
                backup_updated_at,
            )
            if not record:
                continue
            entities.append(("knowledge_node", record["id"], json.dumps(record, ensure_ascii=False), record["updatedAt"]))
            walk_knowledge_nodes(raw_node.get("children") or [], record["id"])

    tree = data.get("knowledgeTree") or {}
    roots = tree.get("roots") if isinstance(tree, dict) else tree
    walk_knowledge_nodes(roots or [], "")

    setting_values = {
        "revealed": data.get("revealed"),
        "exp_types": data.get("expTypes"),
        "expansion_state": {
            "main": data.get("expMain") or [],
            "sub": data.get("expMainSub") or [],
            "sub2": data.get("expMainSub2") or [],
        },
        "global_note": data.get("globalNote"),
        "type_rules": data.get("typeRules"),
        "dir_tree": data.get("dirTree"),
        "knowledge_expanded": data.get("knowledgeExpanded"),
        "today_progress": {
            "date": data.get("todayDate") or "",
            "done": int(data.get("todayDone") or 0),
        },
        "history": data.get("history") or [],
    }
    for key, value in setting_values.items():
        if value is None:
            continue
        record = normalize_setting_sync_record(key, {"value": value}, backup_updated_at)
        entities.append(("setting", key, json.dumps(record, ensure_ascii=False), record["updatedAt"]))

    return entities


def replace_workspace_entities_from_snapshot(
    user_id: str,
    data: dict[str, Any],
    conn: sqlite3.Connection,
    fallback_updated_at: str,
) -> int:
    entities = iter_backup_sync_entities(data, fallback_updated_at)
    conn.execute(
        f"DELETE FROM state_entities WHERE user_id = ? AND entity_type IN ({', '.join('?' for _ in ENTITY_SYNC_OPS)})",
        (user_id, *ENTITY_SYNC_OPS.keys()),
    )
    if entities:
        conn.executemany(
            """
            INSERT INTO state_entities(user_id, entity_type, entity_id, payload_json, updated_at, deleted_at)
            VALUES (?, ?, ?, ?, ?, '')
            """,
            [(user_id, entity_type, entity_id, payload_json, updated_at) for entity_type, entity_id, payload_json, updated_at in entities],
        )
    return len(entities)


def append_workspace_snapshot_ops(
    user_id: str,
    data: dict[str, Any],
    conn: sqlite3.Connection,
    created_at: str,
) -> None:
    current_rows = conn.execute(
        """
        SELECT entity_type, entity_id, payload_json
        FROM state_entities
        WHERE user_id = ? AND entity_type IN ('error', 'note_type', 'note_image', 'knowledge_node', 'setting') AND deleted_at = ''
        """,
        (user_id,),
    ).fetchall()
    current_map = {
        (row["entity_type"], row["entity_id"]): row["payload_json"]
        for row in current_rows
    }
    next_entities = iter_backup_sync_entities(data, created_at)
    next_map = {(entity_type, entity_id): payload_json for entity_type, entity_id, payload_json, _ in next_entities}

    for (entity_type, entity_id), payload_json in next_map.items():
        if current_map.get((entity_type, entity_id)) == payload_json:
            continue
        upsert_op = ENTITY_SYNC_OPS[entity_type][0]
        conn.execute(
            """
            INSERT OR IGNORE INTO operations(id, user_id, op_type, entity_id, payload, created_at)
            VALUES(?, ?, ?, ?, ?, ?)
            """,
            (str(uuid.uuid4()), user_id, upsert_op, entity_id, payload_json, created_at),
        )

    for entity_type, entity_id in current_map.keys() - next_map.keys():
        delete_op = ENTITY_SYNC_OPS[entity_type][1]
        conn.execute(
            """
            INSERT OR IGNORE INTO operations(id, user_id, op_type, entity_id, payload, created_at)
            VALUES(?, ?, ?, ?, '{}', ?)
            """,
            (str(uuid.uuid4()), user_id, delete_op, entity_id, created_at),
        )


def apply_sync_op_to_state_entity(user_id: str, op: dict[str, Any], conn: sqlite3.Connection) -> None:
    op_type = str(op.get("op_type") or "").strip()
    entity_id = str(op.get("entity_id") or "").strip()
    created_at = str(op.get("created_at") or utcnow().isoformat())
    if not entity_id:
        return
    if op_type in DELETE_TO_ENTITY_TYPE:
        entity_type = DELETE_TO_ENTITY_TYPE[op_type]
        conn.execute(
            """
            INSERT INTO state_entities(user_id, entity_type, entity_id, payload_json, updated_at, deleted_at)
            VALUES (?, ?, ?, '{}', ?, ?)
            ON CONFLICT(user_id, entity_type, entity_id) DO UPDATE SET
              payload_json = '{}',
              updated_at = excluded.updated_at,
              deleted_at = excluded.deleted_at
            """,
            (user_id, entity_type, entity_id, created_at, created_at),
        )
        return

    payload = op.get("payload") or {}
    entity_type = UPSERT_TO_ENTITY_TYPE.get(op_type)
    record: Optional[dict[str, Any]] = None
    if entity_type == "error":
        record = normalize_error_sync_record(payload, created_at)
    elif entity_type == "note_type":
        record = normalize_note_type_sync_record(entity_id, payload, created_at)
    elif entity_type == "note_image":
        record = normalize_note_image_sync_record(entity_id, payload, created_at)
    elif entity_type == "knowledge_node":
        record = normalize_knowledge_node_sync_record(entity_id, payload, created_at)
    elif entity_type == "setting":
        record = normalize_setting_sync_record(entity_id, payload, created_at)
    if not entity_type or not record:
        return
    conn.execute(
        """
        INSERT INTO state_entities(user_id, entity_type, entity_id, payload_json, updated_at, deleted_at)
        VALUES (?, ?, ?, ?, ?, '')
        ON CONFLICT(user_id, entity_type, entity_id) DO UPDATE SET
          payload_json = excluded.payload_json,
          updated_at = excluded.updated_at,
          deleted_at = ''
        """,
        (
            user_id,
            entity_type,
            entity_id,
            json.dumps(record, ensure_ascii=False),
            str(record.get("updatedAt") or created_at),
        ),
    )


def ensure_workspace_entities_seeded(user_id: str, conn: sqlite3.Connection) -> None:
    existing = conn.execute(
        """
        SELECT 1
        FROM state_entities
        WHERE user_id = ? AND entity_type IN ('error', 'note_type', 'note_image', 'knowledge_node', 'setting')
        LIMIT 1
        """,
        (user_id,),
    ).fetchone()
    if existing:
        return

    backup_row = conn.execute(
        "SELECT payload_json, updated_at FROM user_backups WHERE user_id = ?",
        (user_id,),
    ).fetchone()
    if not backup_row:
        return

    try:
        backup = json.loads(backup_row["payload_json"] or "{}")
    except json.JSONDecodeError:
        return
    replace_workspace_entities_from_snapshot(
        user_id,
        backup,
        conn,
        backup_row["updated_at"] or utcnow().isoformat(),
    )
    ops = conn.execute(
        """
        SELECT op_type, entity_id, payload, created_at
        FROM operations
        WHERE user_id = ?
        ORDER BY created_at ASC
        """,
        (user_id,),
    ).fetchall()
    for row in ops:
        try:
            op_payload = json.loads(row["payload"] or "{}")
        except json.JSONDecodeError:
            op_payload = {}
        apply_sync_op_to_state_entity(
            user_id,
            {
                "op_type": row["op_type"],
                "entity_id": row["entity_id"],
                "payload": op_payload,
                "created_at": row["created_at"],
            },
            conn,
        )


def list_current_sync_ops(user_id: str, conn: sqlite3.Connection) -> list[dict[str, Any]]:
    ensure_workspace_entities_seeded(user_id, conn)
    rows = conn.execute(
        """
        SELECT entity_type, entity_id, payload_json, updated_at
        FROM state_entities
        WHERE user_id = ? AND entity_type IN ('error', 'note_type', 'note_image', 'knowledge_node', 'setting') AND deleted_at = ''
        ORDER BY updated_at ASC, entity_type ASC, entity_id ASC
        """,
        (user_id,),
    ).fetchall()
    ops: list[dict[str, Any]] = []
    for row in rows:
        upsert_op = ENTITY_SYNC_OPS[row["entity_type"]][0]
        ops.append(
            {
                "id": f"snapshot:{row['entity_type']}:{row['entity_id']}:{row['updated_at']}",
                "op_type": upsert_op,
                "entity_id": row["entity_id"],
                "payload": row["payload_json"],
                "created_at": row["updated_at"],
            }
        )
    return ops


def build_knowledge_tree_snapshot(records: list[dict[str, Any]]) -> dict[str, Any]:
    node_map: dict[str, dict[str, Any]] = {}
    children_map: dict[str, list[dict[str, Any]]] = {}
    roots: list[dict[str, Any]] = []
    for raw in records:
        record = normalize_knowledge_node_sync_record(str(raw.get("id") or ""), raw, str(raw.get("updatedAt") or ""))
        if not record:
            continue
        node_map[record["id"]] = record
    for record in node_map.values():
        parent_id = str(record.get("parentId") or "")
        if parent_id and parent_id in node_map:
            children_map.setdefault(parent_id, []).append(record)
        else:
            roots.append(record)

    def finalize(nodes: list[dict[str, Any]], level: int) -> list[dict[str, Any]]:
        ordered = sorted(
            nodes,
            key=lambda item: (int(item.get("sort") or 0), str(item.get("title") or "")),
        )
        result: list[dict[str, Any]] = []
        for node in ordered:
            kids = finalize(children_map.get(node["id"], []), level + 1)
            result.append(
                {
                    "id": node["id"],
                    "title": str(node.get("title") or ""),
                    "contentMd": str(node.get("contentMd") or ""),
                    "updatedAt": str(node.get("updatedAt") or ""),
                    "level": level,
                    "isLeaf": len(kids) == 0,
                    "children": kids,
                    "sort": int(node.get("sort") or 0),
                }
            )
        return result

    return {"version": 1, "roots": finalize(roots, 1)}


def build_workspace_snapshot_from_entities(user_id: str, conn: sqlite3.Connection) -> dict[str, Any]:
    ensure_workspace_entities_seeded(user_id, conn)
    rows = conn.execute(
        """
        SELECT entity_type, entity_id, payload_json, updated_at, deleted_at
        FROM state_entities
        WHERE user_id = ? AND entity_type IN ('error', 'note_type', 'note_image', 'knowledge_node', 'setting')
        ORDER BY updated_at ASC, entity_type ASC, entity_id ASC
        """,
        (user_id,),
    ).fetchall()
    if not rows:
        return {}

    latest_updated_at = ""
    errors: list[dict[str, Any]] = []
    notes_by_type: dict[str, Any] = {}
    note_images: dict[str, Any] = {}
    knowledge_records: list[dict[str, Any]] = []
    settings: dict[str, Any] = {}

    for row in rows:
        latest_updated_at = max(latest_updated_at, str(row["updated_at"] or ""))
        if str(row["deleted_at"] or "").strip():
            continue
        try:
            payload = json.loads(row["payload_json"] or "{}")
        except json.JSONDecodeError:
            payload = {}
        entity_type = str(row["entity_type"] or "")
        updated_at = str(row["updated_at"] or "")
        entity_id = str(row["entity_id"] or "")
        if entity_type == "error":
            record = normalize_error_sync_record(payload, updated_at)
            if record:
                errors.append(materialize_backup_error_images(user_id, record, conn))
            continue
        if entity_type == "note_type":
            record = normalize_note_type_sync_record(entity_id, payload, updated_at)
            notes_by_type[record["key"]] = record["value"]
            continue
        if entity_type == "note_image":
            record = normalize_note_image_sync_record(entity_id, payload, updated_at)
            note_images[record["id"]] = record["data"]
            continue
        if entity_type == "knowledge_node":
            record = normalize_knowledge_node_sync_record(entity_id, payload, updated_at)
            if record:
                knowledge_records.append(record)
            continue
        if entity_type == "setting":
            record = normalize_setting_sync_record(entity_id, payload, updated_at)
            settings[record["key"]] = record["value"]

    knowledge_tree = build_knowledge_tree_snapshot(knowledge_records)
    knowledge_notes: dict[str, Any] = {}

    def collect_notes(nodes: list[dict[str, Any]]) -> None:
        for node in nodes or []:
            node_id = str(node.get("id") or "")
            if node_id:
                knowledge_notes[node_id] = {
                    "title": str(node.get("title") or ""),
                    "content": str(node.get("contentMd") or ""),
                    "updatedAt": str(node.get("updatedAt") or ""),
                }
            collect_notes(node.get("children") or [])

    collect_notes(knowledge_tree.get("roots") or [])
    expansion_state = settings.get("expansion_state") if isinstance(settings.get("expansion_state"), dict) else {}
    today_progress = settings.get("today_progress") if isinstance(settings.get("today_progress"), dict) else {}

    return {
        "xc_version": 2,
        "exportTime": latest_updated_at or utcnow().isoformat(),
        "baseUpdatedAt": latest_updated_at or "",
        "errors": errors,
        "revealed": settings.get("revealed") or [],
        "expTypes": settings.get("exp_types") or [],
        "expMain": expansion_state.get("main") or [],
        "expMainSub": expansion_state.get("sub") or [],
        "expMainSub2": expansion_state.get("sub2") or [],
        "notesByType": notes_by_type,
        "noteImages": note_images,
        "globalNote": settings.get("global_note") or "",
        "typeRules": settings.get("type_rules"),
        "dirTree": settings.get("dir_tree"),
        "knowledgeTree": knowledge_tree,
        "knowledgeNotes": knowledge_notes,
        "knowledgeExpanded": settings.get("knowledge_expanded") or [],
        "todayDate": str(today_progress.get("date") or ""),
        "todayDone": int(today_progress.get("done") or 0),
        "history": settings.get("history") or [],
    }

