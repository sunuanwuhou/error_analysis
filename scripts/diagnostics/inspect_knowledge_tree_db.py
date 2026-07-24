#!/usr/bin/env python3
"""Inspect knowledge_node counts per user in workspace DB."""
from __future__ import annotations

import json
import os
import sqlite3
import sys

DB_PATH = os.environ.get(
    "WORKSPACE_DB",
    "/data/workspace/xingce_workspace.db",
)


def main() -> None:
    username = sys.argv[1] if len(sys.argv) > 1 else "wesly"
    if not os.path.exists(DB_PATH):
        print(f"DB not found: {DB_PATH}", file=sys.stderr)
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute("SELECT id, username FROM users WHERE username = ?", (username,))
    user = cur.fetchone()
    if not user:
        print(f"user not found: {username}")
        cur.execute("SELECT username FROM users LIMIT 20")
        print("users:", [r["username"] for r in cur.fetchall()])
        return

    uid = user["id"]
    print(f"user={username} id={uid}")

    cur.execute(
        """
        SELECT COUNT(*) AS c
        FROM workspace_entities
        WHERE user_id = ? AND entity_type = 'knowledge_node' AND deleted_at = ''
        """,
        (uid,),
    )
    print("active_knowledge_nodes:", cur.fetchone()["c"])

    cur.execute(
        """
        SELECT entity_id, updated_at, substr(payload, 1, 200) AS payload_head
        FROM workspace_entities
        WHERE user_id = ? AND entity_type = 'knowledge_node' AND deleted_at = ''
        ORDER BY updated_at DESC
        LIMIT 15
        """,
        (uid,),
    )
    rows = cur.fetchall()
    print("sample_nodes:")
    for row in rows:
        title = "?"
        try:
            payload = json.loads(row["payload_head"] + "..." if len(row["payload_head"]) == 200 else row["payload_head"])
            if isinstance(payload, dict):
                title = str(payload.get("title", "?"))
        except Exception:
            pass
        print(f"  - {row['entity_id'][:12]}… title={title} updated={row['updated_at']}")

    cur.execute(
        """
        SELECT entity_type, COUNT(*) AS c
        FROM workspace_entities
        WHERE user_id = ? AND deleted_at = ''
        GROUP BY entity_type
        ORDER BY c DESC
        """,
        (uid,),
    )
    print("entity_counts:")
    for row in cur.fetchall():
        print(f"  {row['entity_type']}: {row['c']}")


if __name__ == "__main__":
    main()
