from __future__ import annotations

import argparse
import hashlib
import json
import uuid
from dataclasses import dataclass
from typing import Any

from app.database import get_conn
from app.security import utcnow
from app.services.workspace_entity_service import invalidate_workspace_snapshot_cache


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _split_path_text(raw: Any) -> list[str]:
    text = _clean_text(raw)
    if not text:
        return []
    return [_clean_text(part) for part in __import__("re").split(r">|/|→", text) if _clean_text(part)]


def _collapse_titles(parts: list[Any], max_depth: int = 5) -> list[str]:
    result: list[str] = []
    for raw in parts:
        part = _clean_text(raw)
        if not part:
            continue
        if result and result[-1] == part:
            continue
        result.append(part)
        if len(result) >= max_depth:
            break
    return result


def _ensure_min_levels(titles: list[str]) -> list[str]:
    if not titles:
        return []
    if len(titles) == 1:
        return [titles[0], "未分类", "未细分"]
    if len(titles) == 2:
        return [titles[0], titles[1], "未细分"]
    return titles


def resolve_error_path_titles(error_payload: dict[str, Any]) -> list[str]:
    type_chain = _collapse_titles(
        [
            error_payload.get("type"),
            error_payload.get("subtype"),
            error_payload.get("subSubtype"),
            error_payload.get("level4") or error_payload.get("fourthLevel") or error_payload.get("levelFour") or error_payload.get("topic4"),
            error_payload.get("level5") or error_payload.get("fifthLevel") or error_payload.get("levelFive") or error_payload.get("topic5"),
        ]
    )
    if type_chain:
        return _ensure_min_levels(type_chain)

    titles_field = error_payload.get("knowledgePathTitles")
    if isinstance(titles_field, list):
        titles = _collapse_titles(titles_field)
        if titles:
            return _ensure_min_levels(titles)
    elif isinstance(titles_field, str):
        titles = _collapse_titles(_split_path_text(titles_field))
        if titles:
            return _ensure_min_levels(titles)

    for key in ("knowledgePath", "knowledgeNodePath", "notePath"):
        titles = _collapse_titles(_split_path_text(error_payload.get(key)))
        if titles:
            return _ensure_min_levels(titles)

    return []


def _path_key(titles: list[str]) -> str:
    return " > ".join(titles)


def _make_node_id(path_key: str) -> str:
    digest = hashlib.sha1(path_key.encode("utf-8")).hexdigest()[:12]
    return f"kn_{digest}"


@dataclass
class NodeDef:
    path_titles: list[str]
    node_id: str
    parent_path_key: str
    parent_id: str
    title: str
    content_md: str
    updated_at: str
    sort: int


def _parse_json_maybe(text: str) -> dict[str, Any]:
    try:
        data = json.loads(text or "{}")
        return data if isinstance(data, dict) else {}
    except json.JSONDecodeError:
        return {}


def _build_existing_node_content_map(existing_nodes: list[dict[str, Any]]) -> dict[str, tuple[str, str]]:
    by_id: dict[str, dict[str, Any]] = {str(row.get("entity_id") or ""): _parse_json_maybe(str(row.get("payload_json") or "{}")) for row in existing_nodes}
    path_cache: dict[str, list[str]] = {}

    def resolve_path(node_id: str, visiting: set[str]) -> list[str]:
        if not node_id:
            return []
        if node_id in path_cache:
            return path_cache[node_id]
        if node_id in visiting:
            return []
        visiting.add(node_id)
        node = by_id.get(node_id) or {}
        title = _clean_text(node.get("title"))
        parent_id = _clean_text(node.get("parentId"))
        parent_path = resolve_path(parent_id, visiting) if parent_id else []
        path = _collapse_titles(parent_path + ([title] if title else []))
        path_cache[node_id] = path
        visiting.remove(node_id)
        return path

    content_map: dict[str, tuple[str, str]] = {}
    for node_id, payload in by_id.items():
        titles = resolve_path(node_id, set())
        key = _path_key(titles)
        if not key:
            continue
        content = str(payload.get("contentMd") or "")
        updated_at = _clean_text(payload.get("updatedAt"))
        old = content_map.get(key)
        if old is None or updated_at > old[1]:
            content_map[key] = (content, updated_at)
    return content_map


def rebuild_for_user(user_id: str) -> dict[str, int]:
    now = utcnow().isoformat()
    with get_conn() as conn:
        error_rows = conn.execute(
            """
            SELECT entity_id, payload_json, updated_at
            FROM state_entities
            WHERE user_id=? AND entity_type='error' AND deleted_at=''
            ORDER BY updated_at ASC, entity_id ASC
            """,
            (user_id,),
        ).fetchall()
        existing_nodes = conn.execute(
            """
            SELECT entity_id, payload_json, updated_at
            FROM state_entities
            WHERE user_id=? AND entity_type='knowledge_node' AND deleted_at=''
            ORDER BY updated_at ASC, entity_id ASC
            """,
            (user_id,),
        ).fetchall()

        content_map = _build_existing_node_content_map(existing_nodes)

        path_first_seen: list[str] = []
        path_seen_set: set[str] = set()
        sibling_orders: dict[str, list[str]] = {}
        leaf_key_by_error_id: dict[str, str] = {}
        updated_error_payloads: dict[str, tuple[str, dict[str, Any]]] = {}

        for row in error_rows:
            error_id = _clean_text(row.get("entity_id"))
            if not error_id:
                continue
            payload = _parse_json_maybe(str(row.get("payload_json") or "{}"))
            titles = resolve_error_path_titles(payload)

            if titles:
                for idx in range(1, len(titles) + 1):
                    prefix = titles[:idx]
                    key = _path_key(prefix)
                    if key and key not in path_seen_set:
                        path_seen_set.add(key)
                        path_first_seen.append(key)
                    if idx > 1:
                        parent_key = _path_key(prefix[:-1])
                        child_list = sibling_orders.setdefault(parent_key, [])
                        if key not in child_list:
                            child_list.append(key)
                leaf_key = _path_key(titles)
                leaf_key_by_error_id[error_id] = leaf_key
                payload["type"] = titles[0] if len(titles) > 0 else ""
                payload["subtype"] = titles[1] if len(titles) > 1 else ""
                payload["subSubtype"] = titles[-1] if titles else ""
                payload["knowledgePathTitles"] = titles
                payload["knowledgePath"] = leaf_key
                payload["knowledgeNodePath"] = leaf_key
                payload["notePath"] = leaf_key
            else:
                leaf_key_by_error_id[error_id] = ""
                payload["noteNodeId"] = ""

            payload["updatedAt"] = _clean_text(payload.get("updatedAt")) or now
            updated_error_payloads[error_id] = (_clean_text(row.get("updated_at")) or now, payload)

        node_defs_by_key: dict[str, NodeDef] = {}
        for key in path_first_seen:
            titles = key.split(" > ")
            parent_titles = titles[:-1]
            parent_key = _path_key(parent_titles)
            parent_id = _make_node_id(parent_key) if parent_key else ""
            sort = sibling_orders.get(parent_key, []).index(key) if key in sibling_orders.get(parent_key, []) else 0
            content, content_updated_at = content_map.get(key, ("", ""))
            node_defs_by_key[key] = NodeDef(
                path_titles=titles,
                node_id=_make_node_id(key),
                parent_path_key=parent_key,
                parent_id=parent_id,
                title=titles[-1],
                content_md=content,
                updated_at=content_updated_at or now,
                sort=sort,
            )

        changed_errors = 0
        for error_id, (_, payload) in updated_error_payloads.items():
            leaf_key = leaf_key_by_error_id.get(error_id, "")
            next_node_id = node_defs_by_key[leaf_key].node_id if leaf_key in node_defs_by_key else ""
            old_node_id = _clean_text(payload.get("noteNodeId"))
            if old_node_id != next_node_id:
                payload["noteNodeId"] = next_node_id
                changed_errors += 1

        old_node_ids = {_clean_text(row.get("entity_id")) for row in existing_nodes if _clean_text(row.get("entity_id"))}
        new_node_ids = {node.node_id for node in node_defs_by_key.values()}

        conn.execute(
            "DELETE FROM state_entities WHERE user_id=? AND entity_type='knowledge_node'",
            (user_id,),
        )

        for node in node_defs_by_key.values():
            payload = {
                "id": node.node_id,
                "parentId": node.parent_id,
                "title": node.title,
                "contentMd": node.content_md,
                "updatedAt": node.updated_at,
                "sort": node.sort,
            }
            conn.execute(
                """
                INSERT INTO state_entities(user_id, entity_type, entity_id, payload_json, updated_at, deleted_at)
                VALUES (?, 'knowledge_node', ?, ?, ?, '')
                ON CONFLICT (user_id, entity_type, entity_id) DO UPDATE SET
                  payload_json=excluded.payload_json,
                  updated_at=excluded.updated_at,
                  deleted_at=''
                """,
                (user_id, node.node_id, json.dumps(payload, ensure_ascii=False), node.updated_at),
            )

        error_upsert_ops = 0
        for error_id, (row_updated_at, payload) in updated_error_payloads.items():
            updated_at = _clean_text(payload.get("updatedAt")) or row_updated_at or now
            conn.execute(
                """
                INSERT INTO state_entities(user_id, entity_type, entity_id, payload_json, updated_at, deleted_at)
                VALUES (?, 'error', ?, ?, ?, '')
                ON CONFLICT (user_id, entity_type, entity_id) DO UPDATE SET
                  payload_json=excluded.payload_json,
                  updated_at=excluded.updated_at,
                  deleted_at=''
                """,
                (user_id, error_id, json.dumps(payload, ensure_ascii=False), updated_at),
            )
            conn.execute(
                """
                INSERT INTO operations(id, user_id, op_type, entity_id, payload, created_at)
                VALUES (?, ?, 'error_upsert', ?, ?, ?)
                ON CONFLICT (id) DO NOTHING
                """,
                (str(uuid.uuid4()), user_id, error_id, json.dumps(payload, ensure_ascii=False), now),
            )
            error_upsert_ops += 1

        node_upsert_ops = 0
        for node in node_defs_by_key.values():
            payload = {
                "id": node.node_id,
                "parentId": node.parent_id,
                "title": node.title,
                "contentMd": node.content_md,
                "updatedAt": node.updated_at,
                "sort": node.sort,
            }
            conn.execute(
                """
                INSERT INTO operations(id, user_id, op_type, entity_id, payload, created_at)
                VALUES (?, ?, 'knowledge_node_upsert', ?, ?, ?)
                ON CONFLICT (id) DO NOTHING
                """,
                (str(uuid.uuid4()), user_id, node.node_id, json.dumps(payload, ensure_ascii=False), now),
            )
            node_upsert_ops += 1

        node_delete_ops = 0
        for node_id in sorted(old_node_ids - new_node_ids):
            conn.execute(
                """
                INSERT INTO operations(id, user_id, op_type, entity_id, payload, created_at)
                VALUES (?, ?, 'knowledge_node_delete', ?, '{}', ?)
                ON CONFLICT (id) DO NOTHING
                """,
                (str(uuid.uuid4()), user_id, node_id, now),
            )
            node_delete_ops += 1

        invalidate_workspace_snapshot_cache(user_id)

        return {
            "errors_total": len(updated_error_payloads),
            "errors_relinked": changed_errors,
            "nodes_new": len(node_defs_by_key),
            "ops_error_upsert": error_upsert_ops,
            "ops_node_upsert": node_upsert_ops,
            "ops_node_delete": node_delete_ops,
        }


def list_user_ids() -> list[str]:
    with get_conn() as conn:
        rows = conn.execute("SELECT id FROM users ORDER BY created_at ASC, id ASC").fetchall()
        return [_clean_text(row.get("id")) for row in rows if _clean_text(row.get("id"))]


def main() -> None:
    parser = argparse.ArgumentParser(description="按错题路径重建知识树节点并重挂题目")
    parser.add_argument("--user-id", default="", help="指定单个用户ID；不传则处理全部用户")
    args = parser.parse_args()

    user_ids = [_clean_text(args.user_id)] if _clean_text(args.user_id) else list_user_ids()
    if not user_ids:
        print("No users found.")
        return

    totals = {
        "users": 0,
        "errors_total": 0,
        "errors_relinked": 0,
        "nodes_new": 0,
        "ops_error_upsert": 0,
        "ops_node_upsert": 0,
        "ops_node_delete": 0,
    }

    for user_id in user_ids:
        stats = rebuild_for_user(user_id)
        totals["users"] += 1
        for key in ("errors_total", "errors_relinked", "nodes_new", "ops_error_upsert", "ops_node_upsert", "ops_node_delete"):
            totals[key] += int(stats.get(key, 0))
        print(
            f"[rebuild] user={user_id} errors={stats['errors_total']} relinked={stats['errors_relinked']} "
            f"nodes={stats['nodes_new']} node_del_ops={stats['ops_node_delete']}"
        )

    print(
        f"[done] users={totals['users']} errors={totals['errors_total']} relinked={totals['errors_relinked']} "
        f"nodes={totals['nodes_new']}"
    )


if __name__ == "__main__":
    main()
