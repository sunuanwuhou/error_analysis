from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Cookie, HTTPException, Query

from backend.core import require_user
from backend.schemas import SuitePracticeRecordPayload
from backend.services.suite_bank_service import (
    append_suite_practice_record,
    get_paper_questions,
    list_papers,
    list_suite_practice_records,
    search_suite_papers,
    search_suite_questions,
)

router = APIRouter()


def _session_user_id(xingce_session: Optional[str]) -> str:
    return str(require_user(xingce_session)["id"])


@router.get("/api/suite-bank/papers")
def api_suite_bank_papers(xingce_session: Optional[str] = Cookie(default=None)) -> dict[str, Any]:
    _session_user_id(xingce_session)
    return {"papers": list_papers()}


@router.get("/api/suite-bank/papers/{paper_id}")
def api_suite_bank_paper_detail(paper_id: str, xingce_session: Optional[str] = Cookie(default=None)) -> dict[str, Any]:
    _session_user_id(xingce_session)
    row = get_paper_questions(paper_id)
    if not row:
        raise HTTPException(status_code=404, detail="paper not found")
    return row


@router.get("/api/suite-bank/search")
def api_suite_bank_search(
    q: str = Query("", description="关键词，空格分割 AND"),
    limit: int = Query(80, ge=1, le=200),
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    _session_user_id(xingce_session)
    paper_lim = max(1, min(limit // 2 + 20, 60))
    return {
        "items": search_suite_questions(q, limit=limit),
        "papers": search_suite_papers(q, limit=paper_lim),
    }


@router.post("/api/suite-bank/practice-records")
def api_suite_bank_practice_record_post(
    body: SuitePracticeRecordPayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    uid = _session_user_id(xingce_session)
    rid = append_suite_practice_record(uid, body=body.model_dump())
    return {"id": rid, "ok": True}


@router.get("/api/suite-bank/practice-records")
def api_suite_bank_practice_record_list(
    limit: int = Query(40, ge=1, le=200),
    paper_id: str = Query("", description="只看某套卷"),
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    uid = _session_user_id(xingce_session)
    pid = paper_id.strip() or None
    rows = list_suite_practice_records(uid, limit=limit, paper_id=pid)
    return {"records": rows}
