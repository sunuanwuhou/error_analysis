from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Cookie, Query

from app.core import read_recent_practice_logs, require_user, write_practice_log
from app.schemas import PracticeAttemptsBatchPayload, PracticeLogPayload
from app.services.practice_query_service import (
    build_attempt_summary_map,
    build_practice_daily_response,
    build_practice_insights_response,
    build_practice_workbench_response,
    read_practice_attempts,
)
from app.services.practice_write_service import write_practice_attempts

router = APIRouter()


@router.post("/api/practice/log")
def create_practice_log(
    payload: PracticeLogPayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    entry = write_practice_log(user["id"], payload)
    return {"ok": True, "entry": entry, "recent": read_recent_practice_logs(user["id"], 14)}


@router.post("/api/practice/attempts/batch")
def save_practice_attempts(
    payload: PracticeAttemptsBatchPayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    saved = write_practice_attempts(user["id"], [item.model_dump() for item in payload.items])
    return {"ok": True, "items": saved}


@router.get("/api/practice/attempts")
def list_practice_attempts(
    limit: int = 120,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    return {"ok": True, "items": read_practice_attempts(user["id"], limit)}


@router.get("/api/practice/attempts/summary")
def list_practice_attempt_summaries(
    error_ids: str = Query(default=""),
    question_ids: str = Query(default=""),
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    normalized_error_ids = [item.strip() for item in str(error_ids or "").split(",") if item.strip()]
    normalized_question_ids = [item.strip() for item in str(question_ids or "").split(",") if item.strip()]
    summary_map = build_attempt_summary_map(
        user["id"],
        error_ids=normalized_error_ids,
        question_ids=normalized_question_ids,
        limit=max(len(normalized_error_ids) + len(normalized_question_ids), 50),
    )
    return {"ok": True, "items": summary_map}


@router.get("/api/practice/daily")
def get_practice_daily(
    limit: int = 12,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    return build_practice_daily_response(user["id"], limit)


@router.get("/api/practice/workbench")
def get_practice_workbench(
    limit: int = 6,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    return build_practice_workbench_response(user["id"], limit)


@router.get("/api/practice/insights")
def get_practice_insights(
    limit: int = 6,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    return build_practice_insights_response(user["id"], limit)
