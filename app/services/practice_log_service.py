from __future__ import annotations

import json
import secrets
from typing import Any

from app.database import get_conn
from app.schemas import PracticeLogPayload
from app.security import utcnow


def write_practice_log(user_id: str, payload: PracticeLogPayload) -> dict[str, Any]:
    entry = {
        "id": secrets.token_hex(12),
        "date": payload.date,
        "mode": payload.mode,
        "weakness_tag": payload.weaknessTag,
        "total": payload.total,
        "correct": payload.correct,
        "error_ids": payload.errorIds,
    }
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO practice_log(id, user_id, date, mode, weakness_tag, total, correct, error_ids, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                entry["id"],
                user_id,
                entry["date"],
                entry["mode"],
                entry["weakness_tag"],
                entry["total"],
                entry["correct"],
                json.dumps(entry["error_ids"], ensure_ascii=False),
                utcnow().isoformat(),
            ),
        )
        conn.execute(
            "DELETE FROM practice_log WHERE user_id = ? AND date < date('now', '-180 days')",
            (user_id,),
        )
        conn.commit()
    from app.services.practice_query_service import invalidate_practice_cache

    invalidate_practice_cache(user_id)
    return entry


def read_recent_practice_logs(user_id: str, limit: int = 30) -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT id, date, mode, weakness_tag, total, correct, error_ids, created_at
            FROM practice_log
            WHERE user_id = ?
            ORDER BY date DESC, created_at DESC
            LIMIT ?
            """,
            (user_id, limit),
        ).fetchall()
    return [
        {
            "id": row["id"],
            "date": row["date"],
            "mode": row["mode"],
            "weaknessTag": row["weakness_tag"],
            "total": row["total"],
            "correct": row["correct"],
            "errorIds": json.loads(row["error_ids"] or "[]"),
            "createdAt": row["created_at"],
        }
        for row in rows
    ]
