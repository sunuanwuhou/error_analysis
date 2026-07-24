#!/usr/bin/env python3
import json, os, psycopg
from psycopg.rows import dict_row
DSN = os.environ.get("DATABASE_URL", "postgresql://xingce:xingce_password@postgres:5432/xingce")
with psycopg.connect(DSN, row_factory=dict_row) as conn:
    uid = conn.execute("SELECT id FROM users WHERE username='wesly'").fetchone()["id"]
    rows = conn.execute(
        """SELECT entity_id, payload_json FROM state_entities
        WHERE user_id=%s AND entity_type='error' AND deleted_at='' AND payload_json LIKE %s LIMIT 3""",
        (uid, '%贸易进出口%'),
    ).fetchall()
for row in rows:
    p = json.loads(row["payload_json"])
    q = str(p.get("question") or "")
    print("id", row["entity_id"][:12])
    print("len", len(q))
    print("prefix", repr(q[:300]))
    print("has_html", "<" in q and ">" in q)
    print("---")
