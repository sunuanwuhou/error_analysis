from __future__ import annotations

import http.cookiejar
import json
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.main import create_user_account, init_db


BASE = "http://127.0.0.1:8000"


class Client:
    def __init__(self) -> None:
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def req(self, path: str, method: str = "GET", data=None, headers=None):
        body = None
        req_headers = dict(headers or {})
        if data is not None and not isinstance(data, (bytes, bytearray)):
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")
            req_headers.setdefault("Content-Type", "application/json")
        else:
            body = data
        req = urllib.request.Request(BASE + path, data=body, headers=req_headers, method=method)
        with self.opener.open(req, timeout=20) as resp:
            raw = resp.read()
            if "application/json" in (resp.headers.get("Content-Type") or ""):
                return resp.status, json.loads(raw.decode("utf-8"))
            return resp.status, raw


def assert_true(cond: bool, msg: str) -> None:
    if not cond:
        raise AssertionError(msg)


def main() -> int:
    username = "smoke_" + uuid.uuid4().hex[:8]
    password = "codexpass123"
    c1 = Client()
    c2 = Client()

    status, data = c1.req("/health")
    assert_true(status == 200 and data.get("ok") is True, "health failed")

    init_db()
    create_user_account(username, password)

    status, data = c1.req("/api/auth/login", method="POST", data={"username": username, "password": password})
    assert_true(status == 200 and data.get("ok") is True, "login failed (client 1)")

    status, data = c2.req("/api/auth/login", method="POST", data={"username": username, "password": password})
    assert_true(status == 200 and data.get("ok") is True, "login failed (client 2)")

    backup_payload = {
        "xc_version": 2,
        "exportTime": "2026-03-26T12:00:00",
        "baseUpdatedAt": "",
        "forceOverwrite": False,
        "errors": [
            {
                "id": "err-1",
                "type": "判断推理",
                "subtype": "逻辑判断",
                "subSubtype": "条件推理",
                "question": "Q1",
                "answer": "A",
                "myAnswer": "B",
                "rootReason": "条件链不稳",
                "errorReason": "审题漏看",
                "analysis": "【根本主因分析】x\\n\\n【解题思路】y",
                "status": "focus",
                "updatedAt": "2026-03-26T12:00:00",
                "masteryLevel": "not_mastered",
                "quiz": None,
            }
        ],
        "notesByType": {},
        "noteImages": {},
        "typeRules": None,
        "dirTree": None,
        "globalNote": "",
        "knowledgeTree": None,
        "knowledgeNotes": {},
    }
    status, data = c1.req("/api/backup", method="PUT", data=backup_payload)
    assert_true(status == 200 and data.get("ok") is True, "backup put failed")

    status, data = c2.req("/api/backup")
    assert_true(status == 200 and data.get("exists") is True, "backup get failed")
    assert_true(data["backup"]["errors"][0]["id"] == "err-1", "backup payload mismatch")

    status, data = c1.req(
        "/api/origin-status",
        method="POST",
        data={
            "localChangedAt": "2026-03-26T12:10:00",
            "lastLoadedAt": "2026-03-26T12:10:00",
            "lastSavedAt": "2026-03-26T12:10:00",
            "lastBackupUpdatedAt": "2026-03-26T12:10:00",
        },
    )
    assert_true(status == 200 and data.get("ok") is True, "origin status update failed")
    assert_true(isinstance(data.get("origins"), list) and data["origins"], "origin statuses missing")

    op1 = {
        "id": "op-" + uuid.uuid4().hex,
        "op_type": "error_upsert",
        "entity_id": "err-1",
        "payload": {
            "id": "err-1",
            "type": "判断推理",
            "subtype": "逻辑判断",
            "subSubtype": "条件推理",
            "question": "Q1 updated",
            "answer": "A",
            "myAnswer": "C",
            "rootReason": "条件链不稳",
            "errorReason": "逻辑推理出错",
            "analysis": "sync test",
            "status": "review",
            "updatedAt": "2026-03-26T12:05:00",
            "masteryLevel": "fuzzy",
        },
        "created_at": "2026-03-26T12:05:00",
    }
    status, data = c1.req("/api/sync", method="POST", data={"ops": [op1]})
    assert_true(status == 200 and data.get("ok") is True, "sync push failed")

    status, data = c2.req("/api/sync?since=2026-03-26T12:00:00")
    assert_true(status == 200 and len(data.get("ops", [])) >= 1, "sync pull missing ops")
    pulled = next((op for op in data["ops"] if op["id"] == op1["id"]), None)
    assert_true(pulled is not None, "pushed op not found")
    assert_true(json.loads(pulled["payload"])["question"] == "Q1 updated", "pulled payload mismatch")

    status, data = c1.req("/api/sync", method="POST", data={"ops": [op1]})
    assert_true(status == 200, "idempotent push failed")
    status, data = c2.req("/api/sync?since=2026-03-26T12:00:00")
    matches = [op for op in data.get("ops", []) if op["id"] == op1["id"]]
    assert_true(len(matches) == 1, "duplicate op inserted")

    img_bytes = b"fake-image-bytes-for-api-test"
    status, data = c1.req("/api/images", method="POST", data=img_bytes, headers={"Content-Type": "image/png"})
    assert_true(status == 200 and data.get("ok") is True, "image upload failed")
    img_hash = data["hash"]

    status, raw = c1.req(f"/api/images/{img_hash}")
    assert_true(status == 200 and raw == img_bytes, "image fetch failed")

    status, data = c1.req(f"/api/images/{img_hash}/unref", method="DELETE")
    assert_true(status == 200 and data.get("ok") is True, "image unref failed")

    try:
        c1.req(f"/api/images/{img_hash}")
        raise AssertionError("image should be deleted after unref")
    except urllib.error.HTTPError as exc:
        assert_true(exc.code == 404, "image delete expectation failed")

    status, data = c1.req("/api/practice/daily?limit=5")
    assert_true(status == 200 and data.get("ok") is True, "practice daily failed")
    assert_true(isinstance(data.get("items"), list), "practice daily items missing")

    status, data = c1.req(
        "/api/practice/log",
        method="POST",
        data={
            "date": "2026-03-26",
            "mode": "daily",
            "weaknessTag": "判断推理",
            "total": 1,
            "correct": 0,
            "errorIds": ["err-1"],
        },
    )
    assert_true(status == 200 and data.get("ok") is True, "practice log failed")
    assert_true(isinstance(data.get("recent"), list) and data["recent"], "practice recent logs missing")

    status, data = c1.req("/api/codex/threads", method="POST", data={"title": "验收线程"})
    assert_true(status == 200 and data.get("ok") is True, "codex thread create failed")
    thread_id = data["thread"]["id"]

    status, data = c1.req(
        f"/api/codex/threads/{thread_id}/messages",
        method="POST",
        data={
            "content": "请根据当前知识点生成复习建议",
            "context": {"selectedKnowledgeNode": {"title": "判断推理"}},
        },
    )
    assert_true(status == 200 and data.get("ok") is True, "codex message create failed")
    assert_true(data["message"]["status"] == "pending", "codex message status mismatch")

    status, data = c1.req("/api/codex/threads")
    assert_true(status == 200 and data.get("ok") is True and data.get("threads"), "codex threads list failed")

    status, data = c1.req(f"/api/codex/threads/{thread_id}")
    assert_true(status == 200 and data.get("ok") is True, "codex thread get failed")
    assert_true(len(data.get("messages", [])) == 1, "codex thread messages mismatch")

    print(json.dumps({"ok": True, "username": username, "image_hash": img_hash}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"SMOKE FAILED: {exc}", file=sys.stderr)
        raise
