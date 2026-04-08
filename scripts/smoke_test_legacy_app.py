from __future__ import annotations

import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.parse import urljoin
from urllib.request import HTTPCookieProcessor, Request, build_opener
from http.cookiejar import CookieJar

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.config import DB_PATH


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(('127.0.0.1', 0))
        return int(sock.getsockname()[1])


def wait_for_server(base_url: str, timeout: float = 20.0) -> None:
    deadline = time.time() + timeout
    last_error: Exception | None = None
    while time.time() < deadline:
        try:
            with build_opener().open(f'{base_url}/health', timeout=2) as response:
                if response.status == 200:
                    return
        except Exception as error:  # noqa: BLE001
            last_error = error
            time.sleep(0.25)
    raise RuntimeError(f'Server did not become ready: {last_error}')


def request_json(opener, url: str, method: str = 'GET', payload: dict[str, Any] | None = None):
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    req = Request(url, data=data, headers=headers, method=method)
    try:
        with opener.open(req, timeout=20) as response:
            return response.status, json.loads(response.read().decode('utf-8'))
    except HTTPError as error:
        try:
            body = error.read().decode('utf-8', errors='replace')
        except Exception as read_error:  # noqa: BLE001
            body = json.dumps({'detail': f'failed to read error body: {read_error}'}, ensure_ascii=False)
        try:
            parsed = json.loads(body)
        except json.JSONDecodeError:
            parsed = {'detail': body}
        return error.code, parsed


def request_text(opener, url: str):
    req = Request(url, method='GET')
    try:
        with opener.open(req, timeout=20) as response:
            return response.status, response.read().decode('utf-8')
    except HTTPError as error:
        return error.code, error.read().decode('utf-8')


def ensure_test_user(username: str, password: str) -> None:
    from app.security import create_user_account

    try:
        create_user_account(username, password)
    except ValueError as error:
        if str(error) != 'username already exists':
            raise


def login_with_retry(opener, base_url: str, username: str, password: str, attempts: int = 3):
    last_status = 0
    last_payload: dict[str, Any] = {}
    for index in range(max(1, attempts)):
        status, payload = request_json(
            opener,
            f'{base_url}/api/auth/login',
            method='POST',
            payload={'username': username, 'password': password},
        )
        if status == 200 and payload.get('ok') is True:
            return status, payload
        last_status, last_payload = status, payload
        time.sleep(0.35 * (index + 1))
    return last_status, last_payload


def restore_db(db_backup_path: Path) -> None:
    if db_backup_path.exists():
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(db_backup_path, DB_PATH)


def main() -> None:
    port = find_free_port()
    base_url = f'http://127.0.0.1:{port}'
    env = os.environ.copy()
    env.setdefault('PYTHONPATH', str(ROOT))
    backup_dir = Path(tempfile.mkdtemp(prefix='legacy-smoke-'))
    db_backup_path = backup_dir / 'xingce.db.backup'
    if DB_PATH.exists():
        shutil.copy2(DB_PATH, db_backup_path)
    username = f'smoke_{uuid.uuid4().hex[:10]}'
    password = 'smoke-pass-123'
    ensure_test_user(username, password)
    server = subprocess.Popen(
        [sys.executable, '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', str(port)],
        cwd=ROOT,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        wait_for_server(base_url)
        cookie_jar = CookieJar()
        opener = build_opener(HTTPCookieProcessor(cookie_jar))

        status, public_entry = request_json(opener, f'{base_url}/api/public-entry')
        assert status == 200 and 'origin' in public_entry

        status, login_html = request_text(opener, f'{base_url}/login')
        assert status == 200
        assert 'Ashore' in login_html
        assert 'id="username"' in login_html
        assert 'id="password"' in login_html

        status, login_payload = login_with_retry(opener, base_url, username, password)
        assert status == 200 and login_payload.get('ok') is True

        status, me_payload = request_json(opener, f'{base_url}/api/me')
        assert status == 200 and me_payload.get('user', {}).get('username') == username

        status, runtime_html = request_text(opener, f'{base_url}/')
        assert status == 200
        assert '/v51-static/assets/v53-bootstrap.js' in runtime_html
        assert '/assets/styles/legacy-app.bundle.css' in runtime_html
        assert 'v53Boot' in runtime_html

        status, legacy_html = request_text(opener, f'{base_url}/legacy')
        assert status == 200
        assert '/assets/styles/legacy-app.bundle.css' in legacy_html
        assert '/assets/modules/legacy-app.bundle.js' in legacy_html
        assert not re.search(r'(?<!data-)onclick=', legacy_html)
        assert not re.search(r'(?<!data-)oninput=', legacy_html)
        assert not re.search(r'(?<!data-)onchange=', legacy_html)
        assert not re.search(r'(?<!data-)onkeydown=', legacy_html)
        assert 'mobileSidebarToggle' in legacy_html and 'mobileSidebarMask' in legacy_html

        for asset_url in [
            '/assets/styles/legacy-app.bundle.css',
            '/assets/modules/legacy-app.bundle.js',
            '/assets/modules/mathjax-config.js',
        ]:
            status, _ = request_text(opener, urljoin(base_url, asset_url))
            assert status == 200, asset_url

        status, runtime_info = request_json(opener, f'{base_url}/api/runtime-info')
        assert status == 200 and 'mode' in runtime_info

        status, backup_payload = request_json(opener, f'{base_url}/api/backup?meta=1')
        assert status == 200 and backup_payload.get('currentOrigin')

        status, origin_payload = request_json(
            opener,
            f'{base_url}/api/origin-status',
            method='POST',
            payload={
                'localChangedAt': '2026-04-02T10:00:00',
                'lastLoadedAt': '2026-04-02T10:01:00',
                'lastSavedAt': '2026-04-02T10:02:00',
            },
        )
        assert status == 200 and origin_payload.get('ok') is True

        status, sync_payload = request_json(opener, f'{base_url}/api/sync')
        assert status == 200 and 'ops' in sync_payload and 'serverTime' in sync_payload

        status, sync_push_payload = request_json(
            opener,
            f'{base_url}/api/sync',
            method='POST',
            payload={'ops': []},
        )
        assert status == 200 and sync_push_payload.get('ok') is True

        status, practice_log = request_json(
            opener,
            f'{base_url}/api/practice/log',
            method='POST',
            payload={
                'date': '2026-04-02',
                'mode': 'smoke',
                'weaknessTag': 'router-check',
                'total': 3,
                'correct': 2,
                'errorIds': [],
            },
        )
        assert status == 200 and practice_log.get('ok') is True

        status, attempts_save = request_json(
            opener,
            f'{base_url}/api/practice/attempts/batch',
            method='POST',
            payload={
                'items': [
                    {
                        'sessionMode': 'smoke',
                        'source': 'self-test',
                        'questionId': 'question-smoke-1',
                        'errorId': '',
                        'type': '数量关系',
                        'subtype': '工程问题',
                        'subSubtype': '',
                        'questionText': 'smoke question',
                        'myAnswer': 'A',
                        'correctAnswer': 'B',
                        'result': 'wrong',
                        'durationSec': 12,
                        'statusTag': 'review',
                        'confidence': 2,
                        'solvingNote': 'smoke note',
                        'scratchData': {'mode': 'smoke'},
                        'noteNodeId': '',
                        'meta': {'case': 'practice-attempts'},
                    }
                ]
            },
        )
        assert status == 200 and attempts_save.get('ok') is True and len(attempts_save.get('items', [])) == 1

        status, attempts_list = request_json(opener, f'{base_url}/api/practice/attempts?limit=5')
        assert status == 200 and attempts_list.get('ok') is True
        assert any(item.get('questionId') == 'question-smoke-1' for item in attempts_list.get('items', []))

        status, daily_payload = request_json(opener, f'{base_url}/api/practice/daily')
        assert status == 200 and daily_payload.get('ok') is True

        status, search_payload = request_json(opener, f'{base_url}/api/knowledge/search?q=smoke')
        assert status == 200 and search_payload.get('ok') is True

        status, thread_create = request_json(
            opener,
            f'{base_url}/api/codex/threads',
            method='POST',
            payload={'title': 'Smoke thread'},
        )
        assert status == 200 and thread_create.get('ok') is True
        thread_id = thread_create['thread']['id']

        status, thread_list = request_json(opener, f'{base_url}/api/codex/threads')
        assert status == 200 and any(item.get('id') == thread_id for item in thread_list.get('threads', []))

        status, message_create = request_json(
            opener,
            f'{base_url}/api/codex/threads/{thread_id}/messages',
            method='POST',
            payload={'content': 'smoke message', 'context': {'source': 'smoke'}},
        )
        assert status == 200 and message_create.get('ok') is True

        status, thread_detail = request_json(opener, f'{base_url}/api/codex/threads/{thread_id}')
        assert status == 200 and thread_detail.get('thread', {}).get('id') == thread_id
        assert any(item.get('content') == 'smoke message' for item in thread_detail.get('messages', []))

        print('Legacy app smoke test passed.')
        print(f'- Base URL: {base_url}')
        print(f'- Auth user: {username}')
        print(f'- Codex thread: {thread_id}')
    finally:
        server.terminate()
        try:
            server.wait(timeout=10)
        except subprocess.TimeoutExpired:
            server.kill()
            server.wait(timeout=5)
        restore_db(db_backup_path)
        shutil.rmtree(backup_dir, ignore_errors=True)


if __name__ == '__main__':
    main()
