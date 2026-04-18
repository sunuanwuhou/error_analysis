from __future__ import annotations

import os
import re
from typing import Any, Iterable

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool


POSTGRES_DSN = os.getenv(
    "DATABASE_URL",
    "postgresql://xingce:xingce_password@postgres:5432/xingce",
)

_MIN_POOL_SIZE = max(1, int(os.getenv("DB_POOL_MIN_SIZE", "2")))
_MAX_POOL_SIZE = max(_MIN_POOL_SIZE, int(os.getenv("DB_POOL_MAX_SIZE", "12")))
_CONNECT_TIMEOUT = max(3, int(os.getenv("DB_CONNECT_TIMEOUT_SEC", "10")))
_POOL: ConnectionPool | None = None


def _get_pool() -> ConnectionPool:
    global _POOL
    if _POOL is None:
        _POOL = ConnectionPool(
            conninfo=POSTGRES_DSN,
            min_size=_MIN_POOL_SIZE,
            max_size=_MAX_POOL_SIZE,
            timeout=_CONNECT_TIMEOUT,
            kwargs={
                "row_factory": dict_row,
                "connect_timeout": _CONNECT_TIMEOUT,
            },
        )
        _POOL.open(wait=True, timeout=_CONNECT_TIMEOUT)
    return _POOL


def close_pool() -> None:
    global _POOL
    if _POOL is None:
        return
    _POOL.close()
    _POOL = None


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
    # Support SQLite-style named placeholders while preserving PostgreSQL casts like "::text".
    text = re.sub(r"(?<!:):([A-Za-z_][A-Za-z0-9_]*)", r"%(\1)s", text)
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
        self._ctx = _get_pool().connection()
        self._conn = self._ctx.__enter__()

    @staticmethod
    def _normalize_params(params: Any) -> Any:
        if params is None:
            return ()
        if isinstance(params, dict):
            return params
        if isinstance(params, tuple):
            return params
        if isinstance(params, list):
            return tuple(params)
        return tuple(params)

    def execute(self, sql: str, params: Iterable[Any] | dict[str, Any] | None = None):
        return self._conn.execute(_adapt_sql(sql), self._normalize_params(params))

    def executemany(self, sql: str, params_seq: Iterable[Iterable[Any] | dict[str, Any]]):
        with self._conn.cursor() as cur:
            normalized = [self._normalize_params(params) for params in params_seq]
            cur.executemany(_adapt_sql(sql), normalized)
            return cur

    def commit(self) -> None:
        self._conn.commit()

    def rollback(self) -> None:
        self._conn.rollback()

    def close(self) -> None:
        if self._ctx is not None:
            self._ctx.__exit__(None, None, None)
            self._ctx = None
            self._conn = None

    def __enter__(self) -> "PgConn":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        if exc_type is not None:
            self.rollback()
        else:
            self.commit()
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
            "CREATE INDEX IF NOT EXISTS idx_state_entities_user_type_deleted_time ON state_entities(user_id, entity_type, deleted_at, updated_at)"
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
            CREATE INDEX IF NOT EXISTS idx_practice_attempts_user_error_time
            ON practice_attempts(user_id, error_id, updated_at DESC, created_at DESC, id DESC)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_practice_attempts_user_question_time
            ON practice_attempts(user_id, question_id, updated_at DESC, created_at DESC, id DESC)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_ops_user_created_id
            ON operations(user_id, created_at, id)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_ops_user_type_created
            ON operations(user_id, op_type, created_at)
            """
        )
        conn.commit()

