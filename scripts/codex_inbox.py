import argparse
import json
import secrets
import sqlite3
import sys
from datetime import datetime
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[1]
DB_PATH = BASE_DIR / "data" / "xingce.db"


def utcnow_iso() -> str:
    return datetime.utcnow().isoformat()


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def parse_context_json(raw: str) -> dict:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def get_pending_messages(limit: int) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT
              m.id,
              m.thread_id,
              m.user_id,
              u.username,
              t.title,
              m.content,
              m.context_json,
              m.status,
              m.error_text,
              m.created_at
            FROM codex_messages m
            JOIN codex_threads t ON t.id = m.thread_id
            JOIN users u ON u.id = m.user_id
            WHERE m.role = 'user' AND m.status = 'pending'
            ORDER BY m.created_at ASC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        payload = []
        for row in rows:
            history_rows = conn.execute(
                """
                SELECT id, role, content, status, error_text, created_at, replied_at
                FROM codex_messages
                WHERE thread_id = ?
                ORDER BY created_at ASC
                LIMIT 40
                """,
                (row["thread_id"],),
            ).fetchall()
            payload.append(
                {
                    "messageId": row["id"],
                    "threadId": row["thread_id"],
                    "userId": row["user_id"],
                    "username": row["username"],
                    "threadTitle": row["title"],
                    "content": row["content"],
                    "context": parse_context_json(row["context_json"]),
                    "status": row["status"],
                    "errorText": row["error_text"],
                    "createdAt": row["created_at"],
                    "history": [
                        {
                            "id": item["id"],
                            "role": item["role"],
                            "content": item["content"],
                            "status": item["status"],
                            "errorText": item["error_text"],
                            "createdAt": item["created_at"],
                            "repliedAt": item["replied_at"],
                        }
                        for item in history_rows
                    ],
                }
            )
    return payload


def list_pending(limit: int) -> None:
    payload = get_pending_messages(limit)
    json.dump(payload, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")


def set_processing(message_id: str) -> None:
    with get_conn() as conn:
        updated = conn.execute(
            """
            UPDATE codex_messages
            SET status = 'processing', error_text = ''
            WHERE id = ? AND role = 'user' AND status = 'pending'
            """,
            (message_id,),
        )
        conn.commit()
    if updated.rowcount <= 0:
        raise SystemExit(f"message not marked processing: {message_id}")


def reply(message_id: str, content: str) -> None:
    content = (content or "").strip()
    if not content:
        raise SystemExit("reply content is empty")
    now = utcnow_iso()
    assistant_id = f"ca_{secrets.token_hex(10)}"
    with get_conn() as conn:
        source = conn.execute(
            """
            SELECT id, thread_id, user_id
            FROM codex_messages
            WHERE id = ? AND role = 'user'
            """,
            (message_id,),
        ).fetchone()
        if not source:
            raise SystemExit(f"source message not found: {message_id}")
        conn.execute(
            """
            INSERT INTO codex_messages(
              id, thread_id, user_id, role, content, context_json, status, error_text, created_at, replied_at
            )
            VALUES (?, ?, ?, 'assistant', ?, '{}', 'done', '', ?, '')
            """,
            (assistant_id, source["thread_id"], source["user_id"], content, now),
        )
        conn.execute(
            """
            UPDATE codex_messages
            SET status = 'done', error_text = '', replied_at = ?
            WHERE id = ?
            """,
            (now, message_id),
        )
        conn.execute(
            "UPDATE codex_threads SET updated_at = ? WHERE id = ?",
            (now, source["thread_id"]),
        )
        conn.commit()


def fail(message_id: str, error_text: str) -> None:
    with get_conn() as conn:
        updated = conn.execute(
            """
            UPDATE codex_messages
            SET status = 'failed', error_text = ?, replied_at = ''
            WHERE id = ? AND role = 'user'
            """,
            ((error_text or "").strip()[:400], message_id),
        )
        conn.commit()
    if updated.rowcount <= 0:
        raise SystemExit(f"message not marked failed: {message_id}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Codex inbox helper for pending messages.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    list_parser = subparsers.add_parser("list-pending", help="Print pending user messages as JSON.")
    list_parser.add_argument("--limit", type=int, default=10)

    processing_parser = subparsers.add_parser("set-processing", help="Mark a pending user message as processing.")
    processing_parser.add_argument("--message-id", required=True)

    reply_parser = subparsers.add_parser("reply", help="Write an assistant reply and mark the user message done.")
    reply_parser.add_argument("--message-id", required=True)
    reply_parser.add_argument("--stdin", action="store_true", help="Read reply content from stdin.")
    reply_parser.add_argument("--content", default="", help="Reply content when not using --stdin.")

    fail_parser = subparsers.add_parser("fail", help="Mark a user message as failed.")
    fail_parser.add_argument("--message-id", required=True)
    fail_parser.add_argument("--error", required=True)

    args = parser.parse_args()
    if args.command == "list-pending":
        list_pending(args.limit)
        return
    if args.command == "set-processing":
        set_processing(args.message_id)
        return
    if args.command == "reply":
        content = sys.stdin.read() if args.stdin else args.content
        reply(args.message_id, content)
        return
    if args.command == "fail":
        fail(args.message_id, args.error)
        return


if __name__ == "__main__":
    main()
