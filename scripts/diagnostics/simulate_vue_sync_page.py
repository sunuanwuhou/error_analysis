#!/usr/bin/env python3
"""Simulate Vue first-page sync load for wesly and analyze knowledge tree gaps."""
from __future__ import annotations

import json
import os

import psycopg
from psycopg.rows import dict_row

DSN = os.environ.get(
    "DATABASE_URL",
    "postgresql://xingce:xingce_password@postgres:5432/xingce",
)
PAGE = 50


def main() -> None:
    with psycopg.connect(DSN, row_factory=dict_row) as conn:
        uid = conn.execute(
            "SELECT id FROM users WHERE username = %s",
            ("wesly",),
        ).fetchone()["id"]

        rows = conn.execute(
            """
            SELECT entity_type, entity_id, payload_json, updated_at
            FROM state_entities
            WHERE user_id = %s AND deleted_at = ''
            ORDER BY updated_at ASC, entity_type ASC, entity_id ASC
            LIMIT %s
            """,
            (uid, PAGE),
        ).fetchall()

        all_kn = conn.execute(
            """
            SELECT entity_id, payload_json
            FROM state_entities
            WHERE user_id = %s AND entity_type = 'knowledge_node' AND deleted_at = ''
            """,
            (uid,),
        ).fetchall()

    loaded_ids = {r["entity_id"] for r in rows if r["entity_type"] == "knowledge_node"}
    all_ids = {r["entity_id"] for r in all_kn}
    missing = all_ids - loaded_ids

    orphan_parents = 0
    titles_sample = []
    for r in rows:
        if r["entity_type"] != "knowledge_node":
            continue
        payload = json.loads(r["payload_json"] or "{}")
        if isinstance(payload, str):
            payload = json.loads(payload)
        parent = str(payload.get("parentId") or "").strip()
        if parent and parent not in loaded_ids and parent in all_ids:
            orphan_parents += 1
        titles_sample.append(str(payload.get("title", "?")))

    print(f"page_size={PAGE}")
    print(f"loaded_knowledge_nodes={len(loaded_ids)}")
    print(f"total_knowledge_nodes={len(all_ids)}")
    print(f"missing_knowledge_nodes={len(missing)}")
    print(f"loaded_nodes_with_missing_parent_in_page={orphan_parents}")
    print("loaded_titles_sample:", titles_sample[:15])


if __name__ == "__main__":
    main()
