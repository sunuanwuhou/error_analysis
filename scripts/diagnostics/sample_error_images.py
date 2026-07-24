#!/usr/bin/env python3
"""Sample errors with imgData for wesly."""
import json
import os
import psycopg
from psycopg.rows import dict_row

DSN = os.environ.get("DATABASE_URL", "postgresql://xingce:xingce_password@postgres:5432/xingce")

with psycopg.connect(DSN, row_factory=dict_row) as conn:
    uid = conn.execute("SELECT id FROM users WHERE username='wesly'").fetchone()["id"]
    rows = conn.execute(
        """
        SELECT entity_id, payload_json
        FROM state_entities
        WHERE user_id=%s AND entity_type='error' AND deleted_at=''
        LIMIT 500
        """,
        (uid,),
    ).fetchall()

with_img = 0
samples = []
for row in rows:
    try:
        p = json.loads(row["payload_json"] or "{}")
        if isinstance(p, str):
            p = json.loads(p)
    except Exception:
        continue
    img = str(p.get("imgData") or "")
    if not img.strip():
        continue
    with_img += 1
    if len(samples) < 5:
        q = str(p.get("question") or "")[:60]
        samples.append({
            "id": row["entity_id"][:12],
            "question": q,
            "img_prefix": img[:80],
            "img_len": len(img),
        })

print("errors_with_imgData:", with_img, "/", len(rows))
for s in samples:
    print(s)
