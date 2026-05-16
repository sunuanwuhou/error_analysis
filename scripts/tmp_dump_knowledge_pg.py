from __future__ import annotations

import json

from app.database import get_conn


USER_ID = "5759eb632cf113d6b9b47edd"
TARGET_WEEKDAY = "\u661f\u671f\u65e5\u671f"
TARGET_QUANTITY = "\u6570\u91cf\u5173\u7cfb"
TARGET_JUDGMENT = "\u5224\u65ad\u63a8\u7406"
TARGET_LOGIC = "\u903b\u8f91\u5224\u65ad"


def find_paths(nodes, target_title: str) -> list[str]:
    found: list[str] = []

    def walk(items, trail):
        for node in items or []:
            title = str(node.get("title") or "")
            next_trail = trail + [title]
            if title == target_title:
                found.append(" > ".join(next_trail))
            walk(node.get("children") or [], next_trail)

    walk(nodes, [])
    return found


def main() -> None:
    with get_conn() as conn:
        row = conn.execute(
            "select payload_json, updated_at from user_backups where user_id = ?",
            (USER_ID,),
        ).fetchone()
        print("backup_updated_at", row["updated_at"] if row else None)
        if row:
            backup = json.loads(row["payload_json"] or "{}")
            tree = backup.get("knowledgeTree") or {}
            roots = tree.get("roots") if isinstance(tree, dict) else tree
            print("backup_root_titles", [str(item.get("title") or "") for item in (roots or [])[:20]])
            print("backup_xingqi", find_paths(roots or [], TARGET_WEEKDAY))

        rows = conn.execute(
            """
            select entity_id, payload_json
            from state_entities
            where user_id = ? and entity_type = 'knowledge_node' and deleted_at = ''
            order by updated_at asc, entity_id asc
            """,
            (USER_ID,),
        ).fetchall()
        print("state_entities_count", len(rows))
        title_rows = []
        for row in rows:
            payload = json.loads(row["payload_json"] or "{}")
            title = str(payload.get("title") or "")
            parent_id = str(payload.get("parentId") or "")
            if title in {TARGET_WEEKDAY, TARGET_QUANTITY, TARGET_JUDGMENT, TARGET_LOGIC}:
                title_rows.append((title, str(payload.get("id") or row["entity_id"]), parent_id))
        print("state_matches", title_rows)


if __name__ == "__main__":
    main()
