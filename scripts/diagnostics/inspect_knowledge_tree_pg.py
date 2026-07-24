#!/usr/bin/env python3
"""Inspect knowledge_node counts for a user via app DATABASE_URL."""
from __future__ import annotations

import json
import os
import sys

import psycopg
from psycopg.rows import dict_row


def main() -> None:
    username = sys.argv[1] if len(sys.argv) > 1 else "wesly"
    dsn = os.environ.get(
        "DATABASE_URL",
        "postgresql://xingce:xingce_password@postgres:5432/xingce",
    )
    with psycopg.connect(dsn, row_factory=dict_row) as conn:
        cur = conn.execute(
            "SELECT id, username FROM users WHERE username = %s LIMIT 1",
            (username,),
        )
        user = cur.fetchone()
        if not user:
            cur = conn.execute("SELECT username FROM users LIMIT 20")
            print(f"user not found: {username}")
            print("users:", [r["username"] for r in cur.fetchall()])
            return

        uid = user["id"]
        print(f"user={username} id={uid}")

        cur = conn.execute(
            """
            SELECT entity_type, COUNT(*)::int AS c
            FROM state_entities
            WHERE user_id = %s AND deleted_at = ''
            GROUP BY entity_type
            ORDER BY c DESC
            """,
            (uid,),
        )
        print("entity_counts:")
        for row in cur.fetchall():
            print(f"  {row['entity_type']}: {row['c']}")

        cur = conn.execute(
            """
            SELECT entity_id, updated_at, payload_json
            FROM state_entities
            WHERE user_id = %s AND entity_type = 'knowledge_node' AND deleted_at = ''
            ORDER BY updated_at DESC
            LIMIT 20
            """,
            (uid,),
        )
        rows = cur.fetchall()
        print(f"sample_knowledge_nodes ({len(rows)} shown):")
        for row in rows:
            title = parent = "?"
            try:
                payload = json.loads(row["payload_json"] or "{}")
                if isinstance(payload, str):
                    payload = json.loads(payload)
                if isinstance(payload, dict):
                    title = str(payload.get("title", "?"))
                    parent = str(payload.get("parentId", ""))
            except Exception:
                pass
            print(
                f"  id={row['entity_id'][:16]}… title={title!r} parent={parent!r} updated={row['updated_at']}"
            )

        cur = conn.execute(
            "SELECT updated_at, length(payload_json)::int AS bytes FROM user_backups WHERE user_id = %s",
            (uid,),
        )
        backup = cur.fetchone()
        if backup:
            print(f"user_backup: updated={backup['updated_at']} bytes={backup['bytes']}")
            try:
                data = json.loads(
                    conn.execute(
                        "SELECT payload_json FROM user_backups WHERE user_id = %s",
                        (uid,),
                    ).fetchone()["payload_json"]
                )
                kn = data.get("knowledgeNodes") or data.get("knowledge_nodes") or []
                print(f"backup knowledgeNodes count: {len(kn)}")
            except Exception as exc:
                print(f"backup parse error: {exc}")
        else:
            print("user_backup: none")


if __name__ == "__main__":
    main()
