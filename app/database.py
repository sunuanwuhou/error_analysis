from __future__ import annotations

import os
import re
from typing import Any, Iterable

import psycopg
from psycopg.rows import dict_row


POSTGRES_DSN = os.getenv(
    "DATABASE_URL",
    "postgresql://xingce:xingce_password@postgres:5432/xingce",
)


def _adapt_sql(sql: str) -> str:
    text = str(sql)
    had_insert_or_ignore = bool(re.search(r"\bINSERT\s+OR\s+IGNORE\s+INTO\b", text, flags=re.IGNORECASE))
    text = re.sub(r"\bINSERT\s+OR\s+IGNORE\s+INTO\b", "INSERT INTO", text, flags=re.IGNORECASE)
    # SQLite accepts datetime(column) in ORDER BY; PostgreSQL does not have datetime().
    text = re.sub(r"datetime\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\)", r"\1", text, flags=re.IGNORECASE)
    text = re.sub(
        r"datetime\('now'\s*,\s*'-([0-9]+)\s+days?'\)",
        lambda m: f"(CURRENT_TIMESTAMP - INTERVAL '{m.group(1)} days')::text",
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(
        r"date\('now'\s*,\s*'-([0-9]+)\s+days?'\)",
        lambda m: f"(CURRENT_DATE - INTERVAL '{m.group(1)} days')::text",
        text,
        flags=re.IGNORECASE,
    )
    text = text.replace("?", "%s")
    if had_insert_or_ignore and "ON CONFLICT" not in text.upper():
        stripped = text.rstrip()
        trailing_semicolon = stripped.endswith(";")
        if trailing_semicolon:
            stripped = stripped[:-1].rstrip()
        text = stripped + "\nON CONFLICT DO NOTHING"
        if trailing_semicolon:
            text += ";"
    return text


class PgConn:
    def __init__(self) -> None:
        self._conn = psycopg.connect(POSTGRES_DSN, row_factory=dict_row, connect_timeout=10)

    def execute(self, sql: str, params: Iterable[Any] | None = None):
        return self._conn.execute(_adapt_sql(sql), tuple(params or ()))

    def executemany(self, sql: str, params_seq: Iterable[Iterable[Any]]):
        with self._conn.cursor() as cur:
            cur.executemany(_adapt_sql(sql), [tuple(params) for params in params_seq])
            return cur

    def commit(self) -> None:
        self._conn.commit()

    def rollback(self) -> None:
        self._conn.rollback()

    def close(self) -> None:
        self._conn.close()

    def __enter__(self) -> "PgConn":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        if exc_type is not None:
            self.rollback()
        self.close()


def get_conn() -> PgConn:
    return PgConn()


def init_db() -> None:
    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
              id TEXT PRIMARY KEY,
              username TEXT NOT NULL UNIQUE,
              password_hash TEXT NOT NULL,
              created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
              token TEXT PRIMARY KEY,
              user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              expires_at TEXT NOT NULL,
              created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS user_backups (
              user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
              payload_json TEXT NOT NULL,
              updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS user_origin_status (
              user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              origin TEXT NOT NULL,
              last_local_change_at TEXT NOT NULL DEFAULT '',
              last_loaded_at TEXT NOT NULL DEFAULT '',
              last_saved_at TEXT NOT NULL DEFAULT '',
              last_backup_updated_at TEXT NOT NULL DEFAULT '',
              updated_at TEXT NOT NULL,
              PRIMARY KEY (user_id, origin)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS user_images (
              hash TEXT NOT NULL,
              user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              content_type TEXT NOT NULL DEFAULT 'image/jpeg',
              size_bytes INTEGER NOT NULL DEFAULT 0,
              ref_count INTEGER NOT NULL DEFAULT 1,
              created_at TEXT NOT NULL,
              PRIMARY KEY (hash, user_id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS operations (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              op_type TEXT NOT NULL,
              entity_id TEXT NOT NULL,
              payload TEXT NOT NULL,
              created_at TEXT NOT NULL
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_ops_user_time ON operations(user_id, created_at)")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS state_entities (
              user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              entity_type TEXT NOT NULL,
              entity_id TEXT NOT NULL,
              payload_json TEXT NOT NULL DEFAULT '{}',
              updated_at TEXT NOT NULL,
              deleted_at TEXT NOT NULL DEFAULT '',
              PRIMARY KEY (user_id, entity_type, entity_id)
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_state_entities_user_type_time ON state_entities(user_id, entity_type, updated_at)"
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS practice_log (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              date TEXT NOT NULL,
              mode TEXT NOT NULL,
              weakness_tag TEXT NOT NULL DEFAULT '',
              total INTEGER NOT NULL DEFAULT 0,
              correct INTEGER NOT NULL DEFAULT 0,
              error_ids TEXT NOT NULL DEFAULT '[]',
              created_at TEXT NOT NULL
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_plog_user_date ON practice_log(user_id, date)")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS practice_attempts (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              session_mode TEXT NOT NULL DEFAULT '',
              source TEXT NOT NULL DEFAULT '',
              question_id TEXT NOT NULL DEFAULT '',
              error_id TEXT NOT NULL DEFAULT '',
              type TEXT NOT NULL DEFAULT '',
              subtype TEXT NOT NULL DEFAULT '',
              sub_subtype TEXT NOT NULL DEFAULT '',
              question_text TEXT NOT NULL DEFAULT '',
              my_answer TEXT NOT NULL DEFAULT '',
              correct_answer TEXT NOT NULL DEFAULT '',
              result TEXT NOT NULL DEFAULT '',
              duration_sec INTEGER NOT NULL DEFAULT 0,
              status_tag TEXT NOT NULL DEFAULT '',
              confidence INTEGER NOT NULL DEFAULT 0,
              solving_note TEXT NOT NULL DEFAULT '',
              scratch_data_json TEXT NOT NULL DEFAULT '{}',
              note_node_id TEXT NOT NULL DEFAULT '',
              meta_json TEXT NOT NULL DEFAULT '{}'
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_practice_attempts_user_time ON practice_attempts(user_id, updated_at DESC)"
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS codex_threads (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              title TEXT NOT NULL DEFAULT '',
              archived INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_codex_threads_user_updated ON codex_threads(user_id, updated_at DESC)")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS codex_messages (
              id TEXT PRIMARY KEY,
              thread_id TEXT NOT NULL REFERENCES codex_threads(id) ON DELETE CASCADE,
              user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              role TEXT NOT NULL,
              content TEXT NOT NULL,
              context_json TEXT NOT NULL DEFAULT '{}',
              status TEXT NOT NULL DEFAULT 'done',
              error_text TEXT NOT NULL DEFAULT '',
              created_at TEXT NOT NULL,
              replied_at TEXT NOT NULL DEFAULT ''
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_codex_messages_thread_time ON codex_messages(thread_id, created_at)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_codex_messages_pending ON codex_messages(status, created_at)")
        conn.commit()
