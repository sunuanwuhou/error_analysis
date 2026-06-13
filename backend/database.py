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
            """
            CREATE TABLE IF NOT EXISTS today_training_sessions (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              session_date TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'in_progress',
              total_count INTEGER NOT NULL DEFAULT 0,
              completed_count INTEGER NOT NULL DEFAULT 0,
              current_index INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              paused_at TEXT NOT NULL DEFAULT '',
              finished_at TEXT NOT NULL DEFAULT '',
              meta_json TEXT NOT NULL DEFAULT '{}'
            )
            """
        )
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_today_session_user_date ON today_training_sessions(user_id, session_date)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_today_session_user_status ON today_training_sessions(user_id, status, session_date)"
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS today_training_session_items (
              id TEXT PRIMARY KEY,
              session_id TEXT NOT NULL REFERENCES today_training_sessions(id) ON DELETE CASCADE,
              user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              seq_no INTEGER NOT NULL,
              error_id TEXT NOT NULL DEFAULT '',
              question_id TEXT NOT NULL DEFAULT '',
              status TEXT NOT NULL DEFAULT 'pending',
              queue_score INTEGER NOT NULL DEFAULT 0,
              payload_json TEXT NOT NULL DEFAULT '{}',
              answered_at TEXT NOT NULL DEFAULT '',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_today_items_session_seq ON today_training_session_items(session_id, seq_no)"
        )
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_today_items_session_error ON today_training_session_items(session_id, error_id)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_today_items_user_status ON today_training_session_items(user_id, status, updated_at)"
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
        init_user_access_tables()


def init_user_access_tables() -> None:
    with get_conn() as conn:
        conn.execute(
            """
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
            """
        )
        conn.execute(
            """
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS is_active INTEGER NOT NULL DEFAULT 1
            """
        )
        conn.execute(
            """
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS updated_at TEXT NOT NULL DEFAULT ''
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS user_module_grants (
              user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              module_key TEXT NOT NULL,
              granted_at TEXT NOT NULL,
              granted_by TEXT NOT NULL DEFAULT '',
              PRIMARY KEY (user_id, module_key)
            )
            """
        )
        conn.commit()

    from backend.services.user_access_service import backfill_legacy_user_grants, ensure_wesly_super_admin

    ensure_wesly_super_admin()
    backfill_legacy_user_grants()


def init_shenlun_tables() -> None:
    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS shenlun_sources (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              source_key TEXT NOT NULL,
              question_text_raw TEXT NOT NULL DEFAULT '',
              material_text_raw TEXT NOT NULL DEFAULT '',
              status TEXT NOT NULL DEFAULT 'raw_draft',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_sl_sources_user_key ON shenlun_sources(user_id, source_key)"
        )
        conn.execute(
            """
            ALTER TABLE shenlun_sources
            ADD COLUMN IF NOT EXISTS node_id TEXT NOT NULL DEFAULT ''
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_sl_sources_user_node_updated
            ON shenlun_sources(user_id, node_id, updated_at DESC)
            """
        )
        conn.execute(
            """
            ALTER TABLE shenlun_sources
            ADD COLUMN IF NOT EXISTS paper_year TEXT NOT NULL DEFAULT ''
            """
        )
        conn.execute(
            """
            ALTER TABLE shenlun_sources
            ADD COLUMN IF NOT EXISTS paper_province TEXT NOT NULL DEFAULT ''
            """
        )
        conn.execute(
            """
            ALTER TABLE shenlun_sources
            ADD COLUMN IF NOT EXISTS paper_suite_type TEXT NOT NULL DEFAULT ''
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS shenlun_attempts (
              id TEXT PRIMARY KEY,
              source_id TEXT NOT NULL REFERENCES shenlun_sources(id) ON DELETE CASCADE,
              user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              attempt_no INTEGER NOT NULL DEFAULT 1,
              segments_json TEXT NOT NULL DEFAULT '[]',
              my_final_summary TEXT NOT NULL DEFAULT '',
              cc_status TEXT NOT NULL DEFAULT 'none',
              cc_result_json TEXT NOT NULL DEFAULT '',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_sl_attempts_source ON shenlun_attempts(source_id)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_sl_attempts_user_time ON shenlun_attempts(user_id, updated_at DESC)"
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS shenlun_hub_notes (
              user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              node_id TEXT NOT NULL DEFAULT '',
              body_md TEXT NOT NULL DEFAULT '',
              updated_at TEXT NOT NULL,
              PRIMARY KEY (user_id, node_id)
            )
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_sl_hub_notes_user_updated
            ON shenlun_hub_notes(user_id, updated_at DESC)
            """
        )
        conn.commit()


def init_suite_bank_tables() -> None:
    """Standalone 套卷题库（与错题备份 user_backups 独立）."""
    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS suite_papers (
              id TEXT PRIMARY KEY,
              source_rel_path TEXT NOT NULL UNIQUE,
              title TEXT NOT NULL DEFAULT '',
              folder TEXT NOT NULL DEFAULT '',
              created_at TEXT NOT NULL,
              meta_json TEXT NOT NULL DEFAULT '{}'
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS suite_questions (
              id TEXT PRIMARY KEY,
              paper_id TEXT NOT NULL REFERENCES suite_papers(id) ON DELETE CASCADE,
              seq_no INTEGER NOT NULL,
              question_no TEXT NOT NULL DEFAULT '',
              stem TEXT NOT NULL DEFAULT '',
              options TEXT NOT NULL DEFAULT '',
              answer TEXT NOT NULL DEFAULT '',
              analysis TEXT NOT NULL DEFAULT '',
              type_label TEXT NOT NULL DEFAULT '',
              img_data TEXT NOT NULL DEFAULT '',
              meta_json TEXT NOT NULL DEFAULT '{}'
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_suite_q_paper ON suite_questions(paper_id, seq_no)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_suite_paper_folder ON suite_papers(folder)"
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS suite_practice_records (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              paper_id TEXT NOT NULL,
              paper_title TEXT NOT NULL DEFAULT '',
              paper_folder TEXT NOT NULL DEFAULT '',
              mode TEXT NOT NULL DEFAULT 'exam',
              created_at TEXT NOT NULL,
              duration_sec INTEGER NOT NULL DEFAULT 0,
              correct_count INTEGER NOT NULL DEFAULT 0,
              wrong_count INTEGER NOT NULL DEFAULT 0,
              unanswered_count INTEGER NOT NULL DEFAULT 0,
              submitted_count INTEGER NOT NULL DEFAULT 0,
              payload_json TEXT NOT NULL DEFAULT '{}'
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_suite_practice_user_time ON suite_practice_records(user_id, created_at DESC)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_suite_practice_user_paper ON suite_practice_records(user_id, paper_id)"
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS suite_bank_drill_history (
              user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              question_id TEXT NOT NULL REFERENCES suite_questions(id) ON DELETE CASCADE,
              first_source_type TEXT NOT NULL DEFAULT '',
              last_source_type TEXT NOT NULL DEFAULT '',
              first_used_at TEXT NOT NULL DEFAULT '',
              last_used_at TEXT NOT NULL DEFAULT '',
              exam_track TEXT NOT NULL DEFAULT '',
              major_module TEXT NOT NULL DEFAULT '',
              years_json TEXT NOT NULL DEFAULT '[]',
              created_at TEXT NOT NULL DEFAULT '',
              updated_at TEXT NOT NULL DEFAULT '',
              PRIMARY KEY (user_id, question_id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS suite_bank_drill_exports (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              file_name TEXT NOT NULL DEFAULT '',
              exam_track TEXT NOT NULL DEFAULT '',
              years_csv TEXT NOT NULL DEFAULT '',
              modules_csv TEXT NOT NULL DEFAULT '',
              count INTEGER NOT NULL DEFAULT 0,
              question_ids_json TEXT NOT NULL DEFAULT '[]',
              title_text TEXT NOT NULL DEFAULT '',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_suite_drill_hist_user_time
            ON suite_bank_drill_history(user_id, updated_at DESC)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_suite_drill_hist_user_track_module
            ON suite_bank_drill_history(user_id, exam_track, major_module, updated_at DESC)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_suite_drill_exports_user_time
            ON suite_bank_drill_exports(user_id, updated_at DESC)
            """
        )
        conn.commit()
    from backend.services.suite_bank_drill import (
        migrate_suite_drill_columns,
        migrate_suite_drill_exports,
        migrate_suite_drill_history,
    )
    from backend.services.suite_bank_service import migrate_suite_papers_schema, migrate_suite_practice_records_schema

    migrate_suite_papers_schema()
    migrate_suite_drill_columns()
    migrate_suite_practice_records_schema()
    migrate_suite_drill_history()
    migrate_suite_drill_exports()


def init_interview_tables() -> None:
    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS interview_questions (
              id TEXT PRIMARY KEY,
              category TEXT NOT NULL,
              difficulty INTEGER NOT NULL DEFAULT 2,
              question_text TEXT NOT NULL,
              framework TEXT NOT NULL DEFAULT '',
              sample_answer TEXT NOT NULL DEFAULT '',
              source TEXT NOT NULL DEFAULT '',
              created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_interview_questions_category
            ON interview_questions(category, created_at DESC)
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS interview_practice_records (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              question_id TEXT NOT NULL REFERENCES interview_questions(id) ON DELETE CASCADE,
              my_answer TEXT NOT NULL DEFAULT '',
              note TEXT NOT NULL DEFAULT '',
              is_starred BOOLEAN NOT NULL DEFAULT FALSE,
              practiced_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              UNIQUE (user_id, question_id)
            )
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_interview_records_user_time
            ON interview_practice_records(user_id, updated_at DESC)
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS interview_categories (
              id TEXT PRIMARY KEY,
              label TEXT NOT NULL UNIQUE,
              sort_order INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_interview_categories_sort
            ON interview_categories(sort_order ASC, created_at ASC)
            """
        )
        conn.commit()

    from backend.services.interview_categories import seed_interview_categories_if_empty
    from backend.services.interview_records import migrate_interview_practice_records_schema

    migrate_interview_practice_records_schema()
    seed_interview_categories_if_empty()

