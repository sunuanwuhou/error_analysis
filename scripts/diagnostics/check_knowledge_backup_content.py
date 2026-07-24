#!/usr/bin/env python3
"""Check whether cloud backup / entities actually contain knowledge note content."""
from __future__ import annotations

import json
import sys
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8088"
USER = sys.argv[2] if len(sys.argv) > 2 else "wesly"
PASS = sys.argv[3] if len(sys.argv) > 3 else "admin123456"


def post_json(path: str, payload: dict, cookie: str | None = None) -> tuple[dict, str | None]:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    if cookie:
        req.add_header("Cookie", cookie)
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = resp.read().decode("utf-8")
        set_cookie = resp.headers.get("Set-Cookie")
        return json.loads(body or "{}"), set_cookie


def get_json(path: str, cookie: str) -> dict:
    req = urllib.request.Request(f"{BASE}{path}", headers={"Cookie": cookie})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def walk_tree(nodes, stats):
    for node in nodes or []:
        stats["nodes"] += 1
        content = str(node.get("contentMd") or "").strip()
        if content:
            stats["tree_with_content"] += 1
            if len(stats["tree_samples"]) < 3:
                stats["tree_samples"].append(
                    {"id": node.get("id"), "title": node.get("title"), "len": len(content)}
                )
        walk_tree(node.get("children") or [], stats)


def main() -> None:
    _, cookie_hdr = post_json("/api/login", {"username": USER, "password": PASS})
    if not cookie_hdr:
        print("login failed: no cookie")
        return
    cookie = cookie_hdr.split(";")[0]
    print(f"logged in as {USER}")

    backup = get_json("/api/backup", cookie)
    if not backup.get("exists"):
        print("backup missing")
        return

    payload = backup.get("backup") or backup.get("payload") or {}
    tree = payload.get("knowledgeTree") or {}
    roots = tree.get("roots") if isinstance(tree, dict) else []
    notes = payload.get("knowledgeNotes") or {}

    tree_stats = {"nodes": 0, "tree_with_content": 0, "tree_samples": []}
    walk_tree(roots, tree_stats)

    note_with_content = 0
    note_samples = []
    for node_id, item in notes.items():
        content = str((item or {}).get("content") or "").strip()
        if content:
            note_with_content += 1
            if len(note_samples) < 3:
                note_samples.append(
                    {"id": node_id, "title": (item or {}).get("title"), "len": len(content)}
                )

    print(f"backup updatedAt={backup.get('updatedAt')}")
    print(f"knowledgeTree nodes={tree_stats['nodes']} with_content={tree_stats['tree_with_content']}")
    print(f"knowledgeNotes keys={len(notes)} with_content={note_with_content}")
    if tree_stats["tree_samples"]:
        print("tree samples:", json.dumps(tree_stats["tree_samples"], ensure_ascii=False))
    if note_samples:
        print("note samples:", json.dumps(note_samples, ensure_ascii=False))
    if tree_stats["tree_with_content"] == 0 and note_with_content == 0:
        print("ERROR: cloud backup has NO note content in tree or knowledgeNotes")


if __name__ == "__main__":
    main()
