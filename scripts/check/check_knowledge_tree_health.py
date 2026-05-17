from __future__ import annotations

import argparse
import json
from collections import defaultdict
from dataclasses import dataclass
from typing import Any

from backend.database import get_conn


@dataclass
class NodeRecord:
    node_id: str
    parent_id: str
    title: str
    content_md: str
    sort: int


def _title_key(value: str) -> str:
    return " ".join(str(value or "").strip().split()).casefold()


def _load_active_nodes(user_id: str) -> dict[str, NodeRecord]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT entity_id, payload_json
            FROM state_entities
            WHERE user_id = ? AND entity_type = 'knowledge_node' AND deleted_at = ''
            """,
            (user_id,),
        ).fetchall()
    records: dict[str, NodeRecord] = {}
    for row in rows:
        entity_id = str(row["entity_id"] or "").strip()
        if not entity_id:
            continue
        try:
            payload = json.loads(row["payload_json"] or "{}")
        except json.JSONDecodeError:
            payload = {}
        node_id = str(payload.get("id") or entity_id or "").strip()
        if not node_id:
            continue
        records[node_id] = NodeRecord(
            node_id=node_id,
            parent_id=str(payload.get("parentId") or "").strip(),
            title=str(payload.get("title") or "").strip(),
            content_md=str(payload.get("contentMd") or ""),
            sort=int(payload.get("sort") or 0),
        )
    return records


def _load_error_note_refs(user_id: str) -> dict[str, int]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT payload_json
            FROM state_entities
            WHERE user_id = ? AND entity_type = 'error' AND deleted_at = ''
            """,
            (user_id,),
        ).fetchall()
    refs: dict[str, int] = defaultdict(int)
    for row in rows:
        try:
            payload = json.loads(row["payload_json"] or "{}")
        except json.JSONDecodeError:
            payload = {}
        node_id = str(payload.get("noteNodeId") or "").strip()
        if node_id:
            refs[node_id] += 1
    return refs


def _build_children(nodes: dict[str, NodeRecord]) -> dict[str, list[str]]:
    children: dict[str, list[str]] = defaultdict(list)
    for node in nodes.values():
        if node.parent_id and node.parent_id in nodes:
            children[node.parent_id].append(node.node_id)
    for parent_id in list(children.keys()):
        children[parent_id].sort(key=lambda nid: (nodes[nid].sort, nodes[nid].title))
    return children


def main() -> None:
    parser = argparse.ArgumentParser(description="Knowledge tree health check")
    parser.add_argument("--username", required=True, help="Target username")
    args = parser.parse_args()

    with get_conn() as conn:
        user = conn.execute("SELECT id, username FROM users WHERE username = ? LIMIT 1", (args.username,)).fetchone()
    if not user:
        raise SystemExit(f"user not found: {args.username}")
    user_id = str(user["id"])

    nodes = _load_active_nodes(user_id)
    refs = _load_error_note_refs(user_id)
    children = _build_children(nodes)

    duplicate_groups: list[dict[str, Any]] = []
    grouped: dict[tuple[str, str], list[str]] = defaultdict(list)
    for node in nodes.values():
        key = (node.parent_id, _title_key(node.title))
        if not key[1]:
            continue
        grouped[key].append(node.node_id)
    for (parent_id, title_key), ids in grouped.items():
        if len(ids) <= 1:
            continue
        ids_sorted = sorted(ids)
        title = nodes[ids_sorted[0]].title
        duplicate_groups.append(
            {
                "parentId": parent_id,
                "title": title,
                "titleKey": title_key,
                "count": len(ids_sorted),
                "ids": ids_sorted,
            }
        )
    duplicate_groups.sort(key=lambda item: (-int(item["count"]), str(item["title"])))

    orphan_nodes = [
        node.node_id
        for node in nodes.values()
        if node.parent_id and node.parent_id not in nodes
    ]
    orphan_nodes.sort()

    subtree_keep: dict[str, bool] = {}

    def mark_keep(node_id: str) -> bool:
        node = nodes[node_id]
        has_note = bool(node.content_md.strip())
        has_question = refs.get(node_id, 0) > 0
        child_keep = False
        for child_id in children.get(node_id, []):
            if mark_keep(child_id):
                child_keep = True
        keep = has_note or has_question or child_keep
        subtree_keep[node_id] = keep
        return keep

    roots = [
        node.node_id
        for node in nodes.values()
        if not node.parent_id or node.parent_id not in nodes
    ]
    roots.sort(key=lambda nid: (nodes[nid].sort, nodes[nid].title))
    for root_id in roots:
        mark_keep(root_id)

    empty_prunable = sorted([node_id for node_id, keep in subtree_keep.items() if not keep])

    summary = {
        "username": str(user["username"]),
        "userId": user_id,
        "totalNodes": len(nodes),
        "duplicateGroupCount": len(duplicate_groups),
        "duplicateNodeCount": sum(max(int(item["count"]) - 1, 0) for item in duplicate_groups),
        "orphanNodeCount": len(orphan_nodes),
        "emptyPrunableCount": len(empty_prunable),
    }
    print(json.dumps({"summary": summary, "duplicates": duplicate_groups[:50], "orphans": orphan_nodes[:200], "emptyPrunable": empty_prunable[:200]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
