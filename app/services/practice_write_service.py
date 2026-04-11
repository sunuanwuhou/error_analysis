from __future__ import annotations

import json
import uuid
from typing import Any

from app.database import get_conn
from app.security import utcnow


def write_practice_attempts(user_id: str, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    saved: list[dict[str, Any]] = []
    sql = (
        "INSERT INTO practice_attempts ("
        "id, user_id, created_at, updated_at, session_mode, source, question_id, error_id, "
        "type, subtype, sub_subtype, question_text, my_answer, correct_answer, result, "
        "duration_sec, status_tag, confidence, solving_note, scratch_data_json, note_node_id, meta_json"
        ") VALUES ("
        ":id, :user_id, :created_at, :updated_at, :session_mode, :source, :question_id, :error_id, "
        ":type, :subtype, :sub_subtype, :question_text, :my_answer, :correct_answer, :result, "
        ":duration_sec, :status_tag, :confidence, :solving_note, :scratch_data_json, :note_node_id, :meta_json"
        ") ON CONFLICT(id) DO UPDATE SET "
        "updated_at=excluded.updated_at, session_mode=excluded.session_mode, source=excluded.source, "
        "question_id=excluded.question_id, error_id=excluded.error_id, type=excluded.type, subtype=excluded.subtype, "
        "sub_subtype=excluded.sub_subtype, question_text=excluded.question_text, my_answer=excluded.my_answer, "
        "correct_answer=excluded.correct_answer, result=excluded.result, duration_sec=excluded.duration_sec, "
        "status_tag=excluded.status_tag, confidence=excluded.confidence, solving_note=excluded.solving_note, "
        "scratch_data_json=excluded.scratch_data_json, note_node_id=excluded.note_node_id, meta_json=excluded.meta_json"
    )
    with get_conn() as conn:
        for raw in items:
            attempt_id = str(raw.get("id") or uuid.uuid4().hex)
            created_at = str(raw.get("createdAt") or utcnow().isoformat())
            updated_at = str(raw.get("updatedAt") or created_at)
            payload = {
                "id": attempt_id,
                "user_id": user_id,
                "created_at": created_at,
                "updated_at": updated_at,
                "session_mode": str(raw.get("sessionMode") or ""),
                "source": str(raw.get("source") or ""),
                "question_id": str(raw.get("questionId") or ""),
                "error_id": str(raw.get("errorId") or ""),
                "type": str(raw.get("type") or ""),
                "subtype": str(raw.get("subtype") or ""),
                "sub_subtype": str(raw.get("subSubtype") or ""),
                "question_text": str(raw.get("questionText") or ""),
                "my_answer": str(raw.get("myAnswer") or ""),
                "correct_answer": str(raw.get("correctAnswer") or ""),
                "result": str(raw.get("result") or ""),
                "duration_sec": int(raw.get("durationSec") or 0),
                "status_tag": str(raw.get("statusTag") or ""),
                "confidence": int(raw.get("confidence") or 0),
                "solving_note": str(raw.get("solvingNote") or ""),
                "scratch_data_json": json.dumps(raw.get("scratchData") or {}, ensure_ascii=False),
                "note_node_id": str(raw.get("noteNodeId") or ""),
                "meta_json": json.dumps(raw.get("meta") or {}, ensure_ascii=False),
            }
            conn.execute(sql, payload)
            saved.append(
                {
                    "id": attempt_id,
                    "createdAt": created_at,
                    "updatedAt": updated_at,
                    "sessionMode": payload["session_mode"],
                    "source": payload["source"],
                    "questionId": payload["question_id"],
                    "errorId": payload["error_id"],
                    "type": payload["type"],
                    "subtype": payload["subtype"],
                    "subSubtype": payload["sub_subtype"],
                    "questionText": payload["question_text"],
                    "myAnswer": payload["my_answer"],
                    "correctAnswer": payload["correct_answer"],
                    "result": payload["result"],
                    "durationSec": payload["duration_sec"],
                    "statusTag": payload["status_tag"],
                    "confidence": payload["confidence"],
                    "solvingNote": payload["solving_note"],
                    "scratchData": raw.get("scratchData") or {},
                    "noteNodeId": payload["note_node_id"],
                    "meta": raw.get("meta") or {},
                }
            )
    return saved
