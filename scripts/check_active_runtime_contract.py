from __future__ import annotations

import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import uuid
from http.cookiejar import CookieJar
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.parse import urljoin
from urllib.request import HTTPCookieProcessor, Request, build_opener

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.config import DB_PATH


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def wait_for_server(base_url: str, timeout: float = 20.0) -> None:
    deadline = time.time() + timeout
    last_error: Exception | None = None
    while time.time() < deadline:
        try:
            with build_opener().open(f"{base_url}/health", timeout=2) as response:
                if response.status == 200:
                    return
        except Exception as error:  # noqa: BLE001
            last_error = error
            time.sleep(0.25)
    raise RuntimeError(f"Server did not become ready: {last_error}")


def request_text(opener, url: str) -> tuple[int, str]:
    req = Request(url, method="GET")
    try:
        with opener.open(req, timeout=20) as response:
            return response.status, response.read().decode("utf-8")
    except HTTPError as error:
        return error.code, error.read().decode("utf-8")


def request_json(opener, url: str, *, method: str = "GET", payload: dict[str, Any] | None = None) -> tuple[int, dict[str, Any]]:
    data = None
    headers: dict[str, str] = {}
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = Request(url, data=data, headers=headers, method=method)
    try:
        with opener.open(req, timeout=20) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        body = error.read().decode("utf-8")
        try:
            parsed = json.loads(body)
        except json.JSONDecodeError:
            parsed = {"detail": body}
        return error.code, parsed


def ensure_test_user(username: str, password: str) -> None:
    from app.security import create_user_account

    try:
        create_user_account(username, password)
    except ValueError as error:
        if str(error) != "username already exists":
            raise


def restore_db(db_backup_path: Path) -> None:
    if db_backup_path.exists():
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(db_backup_path, DB_PATH)


def assert_contains(text: str, snippet: str, label: str) -> None:
    if snippet not in text:
        raise AssertionError(f"Missing {label}: {snippet}")


def extract_next_asset_paths(index_html: str) -> list[str]:
    asset_paths: list[str] = []
    for marker in ('src="', 'href="'):
        start = 0
        while True:
            idx = index_html.find(marker, start)
            if idx == -1:
                break
            value_start = idx + len(marker)
            value_end = index_html.find('"', value_start)
            if value_end == -1:
                break
            value = index_html[value_start:value_end]
            if value.startswith("/next-static/"):
                asset_paths.append(value)
            start = value_end + 1
    return asset_paths


def assert_next_route(opener, base_url: str, path: str) -> None:
    last_status: int | str = 0
    last_html = ""
    for _ in range(3):
        status, html = request_text(opener, f"{base_url}{path}")
        last_status = status
        last_html = html
        if status == 200 and "/next-static/assets/" in html:
            return
        time.sleep(0.2)
    raise AssertionError(f"{path} -> {last_status}: {last_html[:120]}")


def main() -> None:
    port = find_free_port()
    base_url = f"http://127.0.0.1:{port}"
    env = os.environ.copy()
    env.setdefault("PYTHONPATH", str(ROOT))
    backup_dir = Path(tempfile.mkdtemp(prefix="runtime-contract-"))
    db_backup_path = backup_dir / "xingce.db.backup"
    if DB_PATH.exists():
        shutil.copy2(DB_PATH, db_backup_path)

    server = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(port)],
        cwd=ROOT,
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        wait_for_server(base_url)
        cookie_jar = CookieJar()
        opener = build_opener(HTTPCookieProcessor(cookie_jar))

        status, login_html = request_text(opener, f"{base_url}/login")
        assert status == 200
        assert_contains(login_html, 'id="username"', "login username input")
        assert_contains(login_html, 'id="password"', "login password input")

        status, me_payload = request_json(opener, f"{base_url}/api/me")
        assert status == 200 and me_payload.get("authenticated") is False

        username = f"contract_{uuid.uuid4().hex[:10]}"
        password = "contract-pass-123"
        ensure_test_user(username, password)
        status, login_payload = request_json(
            opener,
            f"{base_url}/api/auth/login",
            method="POST",
            payload={"username": username, "password": password},
        )
        assert status == 200 and login_payload.get("ok") is True

        status, root_html = request_text(opener, f"{base_url}/")
        assert status == 200
        assert_contains(root_html, "/v51-static/assets/v53-bootstrap.js", "active bootstrap")
        assert_contains(root_html, "/assets/styles/legacy-app.bundle.css", "active legacy css")

        status, next_login_html = request_text(opener, f"{base_url}/next/login")
        assert status == 200
        assert_contains(next_login_html, "/next-static/assets/", "next login asset mount")

        for path in ["/v51", "/v53"]:
            status, html = request_text(opener, f"{base_url}{path}")
            assert status == 200
            assert_contains(html, "/v51-static/assets/v53-bootstrap.js", f"{path} bootstrap")

        status, legacy_html = request_text(opener, f"{base_url}/legacy")
        assert status == 200
        assert_contains(legacy_html, "/assets/modules/legacy-app.bundle.js", "legacy bundle js")
        assert_contains(legacy_html, "/assets/styles/legacy-app.bundle.css", "legacy bundle css")

        asset_checks = [
            "/v51-static/assets/v53-shell.js",
            "/v51-static/assets/final-flow.js",
            "/v51-static/assets/process-canvas-ultimate.js",
            "/v51-static/assets/process-canvas-ultimate.css",
            "/v51-static/partials.bundle.html",
            "/v51-static/deferred-partials.bundle.html",
            "/assets/legacy-app.bundle.manifest.json",
            "/assets/note_editor.html",
            "/assets/note_viewer.html",
            "/assets/process_image_editor.html",
            "/assets/global_search.html",
            "/assets/markdown_smoke_harness.html",
            "/assets/process_image_smoke_harness.html",
        ]
        for path in asset_checks:
            status, text = request_text(opener, urljoin(base_url, path))
            assert status == 200, path
            assert text.strip(), f"Empty response: {path}"

        status, note_editor = request_text(opener, f"{base_url}/assets/note_editor.html")
        assert_contains(note_editor, "editor-page", "note editor shell")
        assert_contains(note_editor, "noteTitle", "note editor title mount")

        status, note_viewer = request_text(opener, f"{base_url}/assets/note_viewer.html")
        assert_contains(note_viewer, "viewer-layout", "note viewer layout")
        assert_contains(note_viewer, "viewer-content", "note viewer content area")

        status, process_editor = request_text(opener, f"{base_url}/assets/process_image_editor.html")
        assert_contains(process_editor, "process-page", "process image page")
        assert_contains(process_editor, "process-shell", "process image shell")

        status, global_search = request_text(opener, f"{base_url}/assets/global_search.html")
        assert_contains(global_search, "search-page", "global search page")
        assert_contains(global_search, "search-shell", "global search shell")

        preview_paths = [
            "/next",
            "/next/login",
            "/next/workspace",
            "/next/workspace/errors",
            "/next/workspace/notes",
            "/next/workspace/tasks/errors",
            "/next/workspace/tasks/notes",
            "/next/legacy",
            "/next/v51",
            "/next/v53",
            "/next/shenlun",
            "/next/actions/quickadd",
            "/next/actions/cloud-load",
            "/next/actions/cloud-save",
            "/next/actions/daily",
            "/next/actions/full",
            "/next/actions/note",
            "/next/actions/recommended-notes",
            "/next/actions/recommended-notes/return",
            "/next/actions/recommended-note",
            "/next/actions/direct",
            "/next/actions/speed",
            "/next/actions/dashboard",
            "/next/actions/codex",
            "/next/tools/history",
            "/next/tools/ai",
            "/next/tools/add",
            "/next/tools/edit",
            "/next/tools/backup",
            "/next/tools/backup/create",
            "/next/tools/backup/refresh",
            "/next/tools/backup/restore",
            "/next/tools/backup/delete",
            "/next/tools/export",
            "/next/tools/remarks",
            "/next/tools/remarks/daily-log",
            "/next/tools/journal",
            "/next/tools/journal/today",
            "/next/tools/journal/template",
            "/next/tools/search",
            "/next/tools/note-editor",
            "/next/tools/note-viewer",
            "/next/tools/process-image",
            "/next/tools/markdown-harness",
            "/next/tools/process-harness",
            "/next/tools/import",
            "/next/tools/directory",
            "/next/tools/knowledge-move",
            "/next/tools/knowledge-node",
            "/next/tools/quick-import",
            "/next/tools/type-rules",
            "/next/tools/claude-helper",
            "/next/tools/claude-bank",
            "/next/tools/claude-bank/refresh",
            "/next/tools/canvas",
        ]
        for path in preview_paths:
            assert_next_route(opener, base_url, path)

        status, next_workspace_html = request_text(opener, f"{base_url}/next")
        assert status == 200
        assert_contains(next_workspace_html, "/next-static/assets/", "next workspace asset mount")

        next_assets = extract_next_asset_paths(next_workspace_html)
        assert next_assets, "No built next assets were referenced."
        for path in next_assets:
            status, text = request_text(opener, f"{base_url}{path}")
            assert status == 200, path
            assert text.strip(), f"Empty response: {path}"

        print("Active runtime contract check passed.")
        print(f"- Base URL: {base_url}")
        print("- Verified chain: /login -> / -> v51 bootstrap -> xingce_v3 feature pages")
        print("- Verified preview chain: /next/login -> /next -> built Vue assets")
    finally:
        server.terminate()
        try:
            server.wait(timeout=10)
        except subprocess.TimeoutExpired:
            server.kill()
            server.wait(timeout=5)
        restore_db(db_backup_path)
        shutil.rmtree(backup_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
