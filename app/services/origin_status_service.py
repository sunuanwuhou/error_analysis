from __future__ import annotations

from typing import Any, Optional

from app.database import get_conn
from app.runtime import normalize_origin
from app.security import utcnow


def upsert_origin_status(user_id: str, origin: str, conn: Optional[Any] = None, **fields: str) -> None:
    origin = normalize_origin(origin or "")
    if not origin:
        return

    allowed = {
        "last_local_change_at",
        "last_loaded_at",
        "last_saved_at",
        "last_backup_updated_at",
    }
    payload = {key: value for key, value in fields.items() if key in allowed and value is not None}
    now = utcnow().isoformat()
    columns = ["user_id", "origin", "updated_at", *payload.keys()]
    values = [user_id, origin, now, *payload.values()]
    updates = ["updated_at = excluded.updated_at", *[f"{key} = excluded.{key}" for key in payload.keys()]]

    sql = f"""
        INSERT INTO user_origin_status({", ".join(columns)})
        VALUES ({", ".join("?" for _ in columns)})
        ON CONFLICT(user_id, origin) DO UPDATE SET
          {", ".join(updates)}
    """
    if conn is not None:
        conn.execute(sql, values)
        return
    with get_conn() as managed_conn:
        managed_conn.execute(sql, values)
        managed_conn.commit()


def list_origin_statuses(user_id: str, conn: Optional[Any] = None) -> list[dict[str, Any]]:
    sql = """
        SELECT origin, last_local_change_at, last_loaded_at, last_saved_at,
               last_backup_updated_at, updated_at
        FROM user_origin_status
        WHERE user_id = ?
        ORDER BY updated_at DESC, origin ASC
    """
    if conn is not None:
        rows = conn.execute(sql, (user_id,)).fetchall()
    else:
        with get_conn() as managed_conn:
            rows = managed_conn.execute(sql, (user_id,)).fetchall()
    return [
        {
            "origin": row["origin"],
            "lastLocalChangeAt": row["last_local_change_at"],
            "lastLoadedAt": row["last_loaded_at"],
            "lastSavedAt": row["last_saved_at"],
            "lastBackupUpdatedAt": row["last_backup_updated_at"],
            "updatedAt": row["updated_at"],
        }
        for row in rows
    ]
