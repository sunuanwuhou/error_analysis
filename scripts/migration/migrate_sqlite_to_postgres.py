from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any

from app.core import replace_workspace_entities_from_snapshot
from app.database import get_conn
from app.security import utcnow


BASE_DIR = Path(__file__).resolve().parents[2]
DEFAULT_SQLITE = BASE_DIR / "data" / "xingce.db.cleanup_20260411_174853.bak"
DEFAULT_USER_ID = "5759eb632cf113d6b9b47edd"
DEFAULT_SNAPSHOT = (
    BASE_DIR
    / "data"
    / "backups"
    / DEFAULT_USER_ID
    / "before_restore_20260411_201046"
    / "snapshot.json"
)
DEFAULT_IMAGE_ROWS = DEFAULT_SNAPSHOT.with_name("image_rows.json")
TABLES = [
    "users",
    "sessions",
    "user_backups",
    "user_origin_status",
    "user_images",
    "operations",
    "state_entities",
    "practice_log",
    "practice_attempts",
    "codex_threads",
    "codex_messages",
]


def pg_execute(conn, sql: str, params: tuple[Any, ...] = ()) -> None:
    conn.execute(sql, params)


def copy_table(sqlite_conn: sqlite3.Connection, pg_conn, table: str) -> int:
    rows = sqlite_conn.execute(f"SELECT * FROM {table}").fetchall()
    if not rows:
        return 0
    columns = [item[1] for item in sqlite_conn.execute(f"PRAGMA table_info({table})").fetchall()]
    placeholders = ", ".join(["%s"] * len(columns))
    col_sql = ", ".join(columns)
    pg_conn.executemany(
        f"INSERT INTO {table}({col_sql}) VALUES ({placeholders}) ON CONFLICT DO NOTHING",
        [[row[col] for col in columns] for row in rows],
    )
    return len(rows)


def restore_primary_snapshot(pg_conn, user_id: str, snapshot_path: Path) -> dict[str, int]:
    if not snapshot_path.exists():
        return {}
    snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
    updated_at = utcnow().isoformat()
    pg_conn.execute(
        """
        INSERT INTO user_backups(user_id, payload_json, updated_at)
        VALUES (%s, %s, %s)
        ON CONFLICT(user_id) DO UPDATE SET
          payload_json = excluded.payload_json,
          updated_at = excluded.updated_at
        """,
        (user_id, json.dumps(snapshot, ensure_ascii=False), updated_at),
    )
    entity_count = replace_workspace_entities_from_snapshot(user_id, snapshot, pg_conn, updated_at)
    image_rows_path = snapshot_path.with_name("image_rows.json")
    if image_rows_path.exists():
        pg_conn.execute("DELETE FROM user_images WHERE user_id = %s", (user_id,))
        image_rows = json.loads(image_rows_path.read_text(encoding="utf-8"))
        pg_conn.executemany(
            """
            INSERT INTO user_images(hash, user_id, content_type, size_bytes, ref_count, created_at)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT(hash, user_id) DO UPDATE SET
              content_type = excluded.content_type,
              size_bytes = excluded.size_bytes,
              ref_count = excluded.ref_count,
              created_at = excluded.created_at
            """,
            [
                (
                    str(row.get("hash") or ""),
                    user_id,
                    str(row.get("content_type") or "image/jpeg"),
                    int(row.get("size_bytes") or 0),
                    int(row.get("ref_count") or 1),
                    str(row.get("created_at") or updated_at),
                )
                for row in image_rows
            ],
        )
        image_count = len(image_rows)
    else:
        image_count = 0
    return {"entities": entity_count, "images": image_count}


def main() -> None:
    sqlite_path = Path(os.getenv("SQLITE_SOURCE", str(DEFAULT_SQLITE)))
    snapshot_path = Path(os.getenv("PRIMARY_SNAPSHOT", str(DEFAULT_SNAPSHOT)))
    user_id = os.getenv("PRIMARY_USER_ID", DEFAULT_USER_ID)
    if not sqlite_path.exists():
        raise SystemExit(f"SQLite source not found: {sqlite_path}")

    sqlite_conn = sqlite3.connect(str(sqlite_path))
    sqlite_conn.row_factory = sqlite3.Row
    check = sqlite_conn.execute("PRAGMA integrity_check").fetchone()[0]
    if check != "ok":
        raise SystemExit(f"SQLite source is not clean: {check}")

    with get_conn() as pg_conn:
        for table in reversed(TABLES):
            pg_execute(pg_conn, f"TRUNCATE TABLE {table} CASCADE")
        copied: dict[str, int] = {}
        for table in TABLES:
            copied[table] = copy_table(sqlite_conn, pg_conn, table)
        restored = restore_primary_snapshot(pg_conn, user_id, snapshot_path)
        pg_conn.commit()

    sqlite_conn.close()
    print("Migrated at", datetime.now().isoformat(timespec="seconds"))
    print("SQLite source:", sqlite_path)
    print("Snapshot:", snapshot_path)
    print("Copied:", copied)
    print("Restored:", restored)


if __name__ == "__main__":
    main()
