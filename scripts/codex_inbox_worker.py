import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from codex_inbox import fail, get_pending_messages, reply, set_processing


DEFAULT_INTERVAL_MINUTES = 30
DEFAULT_BATCH_SIZE = 5
DEFAULT_TIMEOUT_SECONDS = 90


def utcnow() -> str:
    return datetime.utcnow().isoformat(timespec="seconds")


def env_int(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        return default
    return value if value > 0 else default


def read_reply_text(payload: dict) -> str:
    if isinstance(payload, dict):
        for key in ("reply", "content", "text", "message"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    return ""


def call_webhook(message: dict, webhook_url: str, webhook_token: str, timeout_seconds: int) -> str:
    body = json.dumps(
        {
            "message": message,
            "requestedAt": utcnow(),
            "task": "Reply to a Codex Inbox user message using the provided thread history and context.",
        },
        ensure_ascii=False,
    ).encode("utf-8")
    headers = {
        "Content-Type": "application/json; charset=utf-8",
        "Accept": "application/json, text/plain",
    }
    if webhook_token:
        headers["Authorization"] = f"Bearer {webhook_token}"
    req = urllib.request.Request(webhook_url, data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=timeout_seconds) as resp:
        raw = resp.read().decode("utf-8")
        content_type = resp.headers.get("Content-Type", "")
    if "application/json" in content_type.lower():
        parsed = json.loads(raw or "{}")
        text = read_reply_text(parsed)
        if text:
            return text
        raise ValueError("webhook JSON response missing reply/content/text/message")
    text = raw.strip()
    if text:
        return text
    raise ValueError("webhook response body is empty")


def process_once(batch_size: int, timeout_seconds: int, webhook_url: str, webhook_token: str) -> int:
    pending = get_pending_messages(batch_size)
    if not pending:
        print(f"[{utcnow()}] codex-inbox-worker: no pending messages")
        return 0
    if not webhook_url:
        print(
            f"[{utcnow()}] codex-inbox-worker: found {len(pending)} pending message(s) "
            "but CODEX_INBOX_WEBHOOK_URL is not configured; leaving them pending"
        )
        return 0

    processed = 0
    for item in pending:
        message_id = item["messageId"]
        try:
            set_processing(message_id)
            answer = call_webhook(item, webhook_url, webhook_token, timeout_seconds)
            reply(message_id, answer)
            processed += 1
            print(f"[{utcnow()}] codex-inbox-worker: replied to {message_id}")
        except urllib.error.HTTPError as exc:
            error_text = f"webhook http {exc.code}"
            fail(message_id, error_text)
            print(f"[{utcnow()}] codex-inbox-worker: failed {message_id}: {error_text}")
        except urllib.error.URLError as exc:
            error_text = f"webhook unavailable: {exc.reason}"
            fail(message_id, error_text)
            print(f"[{utcnow()}] codex-inbox-worker: failed {message_id}: {error_text}")
        except Exception as exc:  # noqa: BLE001
            error_text = str(exc)[:400] or "unknown error"
            fail(message_id, error_text)
            print(f"[{utcnow()}] codex-inbox-worker: failed {message_id}: {error_text}")
    return processed


def main() -> None:
    parser = argparse.ArgumentParser(description="Looping worker for Codex Inbox messages.")
    parser.add_argument("--once", action="store_true", help="Run one scan cycle and exit.")
    args = parser.parse_args()

    interval_minutes = env_int("CODEX_INBOX_INTERVAL_MINUTES", DEFAULT_INTERVAL_MINUTES)
    batch_size = env_int("CODEX_INBOX_BATCH_SIZE", DEFAULT_BATCH_SIZE)
    timeout_seconds = env_int("CODEX_INBOX_TIMEOUT_SECONDS", DEFAULT_TIMEOUT_SECONDS)
    webhook_url = os.getenv("CODEX_INBOX_WEBHOOK_URL", "").strip()
    webhook_token = os.getenv("CODEX_INBOX_WEBHOOK_TOKEN", "").strip()

    print(
        f"[{utcnow()}] codex-inbox-worker: start "
        f"(interval={interval_minutes}m, batch={batch_size}, webhook={'set' if webhook_url else 'unset'})"
    )
    if args.once:
        process_once(batch_size, timeout_seconds, webhook_url, webhook_token)
        return

    sleep_seconds = max(60, interval_minutes * 60)
    while True:
        process_once(batch_size, timeout_seconds, webhook_url, webhook_token)
        time.sleep(sleep_seconds)


if __name__ == "__main__":
    main()
