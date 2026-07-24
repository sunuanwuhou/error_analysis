#!/usr/bin/env python3
"""Count knowledge_node ops in GET /api/sync response (stdin JSON)."""
import json
import sys

data = json.load(sys.stdin)
ops = data.get("ops", [])
kn_ops = [o for o in ops if "knowledge" in str(o.get("op_type", ""))]
upserts = [o for o in kn_ops if o.get("op_type") == "knowledge_node_upsert"]
deletes = [o for o in kn_ops if o.get("op_type") == "knowledge_node_delete"]
print(f"total_ops={len(ops)}")
print(f"knowledge_ops={len(kn_ops)}")
print(f"knowledge_upserts={len(upserts)}")
print(f"knowledge_deletes={len(deletes)}")
# sample titles
titles = []
for o in upserts[:20]:
    p = o.get("payload") or {}
    if isinstance(p, str):
        try:
            p = json.loads(p)
        except Exception:
            p = {}
    titles.append(str((p or {}).get("title", "?")))
print("sample_titles:", titles)
