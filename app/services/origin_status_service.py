from __future__ import annotations

from typing import Any

from app.database import get_conn
from app.runtime import normalize_origin
from app.security import utcnow


def upsert_origin_status(user_id: str, origin: str, **fields: str) -> None:
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

    with get_conn() as conn:
        conn.execute(
            f"""
            INSERT INTO user_origin_status({", ".join(columns)})
            VALUES ({", ".join("?" for _ in columns)})
            ON CONFLICT(user_id, origin) DO UPDATE SET
              {", ".join(updates)}
            """,
            values,
        )
        conn.commit()


def list_origin_statuses(user_id: str) -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT origin, last_local_change_at, last_loaded_at, last_saved_at,
                   last_backup_updated_at, updated_at
            FROM user_origin_status
            WHERE user_id = ?
            ORDER BY updated_at DESC, origin ASC
            """,
            (user_id,),
        ).fetchall()
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
