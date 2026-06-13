from __future__ import annotations

import json
import secrets
from typing import Any, Literal, Optional

from fastapi import APIRouter, Cookie, HTTPException, Query
from pydantic import BaseModel, Field

from backend.config import SESSION_COOKIE
from backend.core import require_module
from backend.database import get_conn
from backend.security import utcnow
from backend.services.interview_categories import (
    create_category,
    delete_category,
    ensure_valid_category_id,
    list_categories,
    resolve_category_id,
    update_category,
)
from backend.services.interview_import import parse_json_import, parse_markdown_import
from backend.services.interview_records import apply_review_rating, resolve_polished_schedule

router = APIRouter(prefix="/api/interview", tags=["interview"])


class QuestionPayload(BaseModel):
    category: str
    difficulty: int = Field(default=2, ge=1, le=3)
    question_text: str
    framework: str = ""
    sample_answer: str = ""
    source: str = ""


class UpsertRecordPayload(BaseModel):
    question_id: str
    my_answer: str = ""
    polished_answer: str = ""
    note: str = ""
    is_starred: bool = False


class ReviewRecordPayload(BaseModel):
    question_id: str
    rating: Literal["smooth", "ok", "forgot"]


class ImportQuestionsPayload(BaseModel):
    format: Literal["json", "markdown"] = "json"
    content: str = ""
    items: list[dict[str, Any]] | None = None


class CategoryPayload(BaseModel):
    label: str
    id: str = ""
    sort_order: int | None = None


class CategoryUpdatePayload(BaseModel):
    label: str
    sort_order: int | None = None


def _row_to_question(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "category": row["category"],
        "difficulty": int(row.get("difficulty") or 2),
        "question_text": row["question_text"],
        "framework": row.get("framework") or "",
        "sample_answer": row.get("sample_answer") or "",
        "source": row.get("source") or "",
        "created_at": row["created_at"],
    }


_RECORD_SELECT = """
    id, question_id, my_answer, polished_answer, note, is_starred,
    practiced_at, updated_at, next_review_at, review_stage, last_review_at
"""


def _row_to_record(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "question_id": row["question_id"],
        "my_answer": row.get("my_answer") or "",
        "polished_answer": row.get("polished_answer") or "",
        "note": row.get("note") or "",
        "is_starred": bool(row.get("is_starred")),
        "practiced_at": row["practiced_at"],
        "updated_at": row["updated_at"],
        "next_review_at": row.get("next_review_at") or "",
        "review_stage": int(row.get("review_stage") or 0),
        "last_review_at": row.get("last_review_at") or "",
    }


def _validate_category(cat: str) -> str:
    try:
        return ensure_valid_category_id(cat)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


def _validate_question_payload(payload: QuestionPayload) -> dict[str, Any]:
    qtext = payload.question_text.strip()
    if not qtext:
        raise HTTPException(status_code=400, detail="question_text_required")
    return {
        "category": _validate_category(payload.category),
        "difficulty": int(payload.difficulty),
        "question_text": qtext,
        "framework": payload.framework.strip(),
        "sample_answer": payload.sample_answer.strip(),
        "source": payload.source.strip(),
    }


def _new_question_id() -> str:
    return "iv-q-" + secrets.token_hex(8)


def _find_existing_question_id(conn: Any, item: dict[str, Any]) -> str | None:
    qid = str(item.get("id") or "").strip()
    if qid:
        row = conn.execute("SELECT id FROM interview_questions WHERE id = %s", (qid,)).fetchone()
        if row:
            return str(row["id"])
    qtext = str(item.get("question_text") or "").strip()
    if qtext:
        row = conn.execute(
            "SELECT id FROM interview_questions WHERE question_text = %s LIMIT 1",
            (qtext,),
        ).fetchone()
        if row:
            return str(row["id"])
    return None


def _upsert_import_items(items: list[dict[str, Any]]) -> dict[str, Any]:
    now = utcnow().isoformat()
    added = 0
    updated = 0
    saved: list[dict[str, Any]] = []
    with get_conn() as conn:
        for item in items:
            try:
                item["category"] = resolve_category_id(
                    str(item.get("category") or "综合分析"),
                    conn=conn,
                    auto_create=True,
                )
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e)) from e
            existing_id = _find_existing_question_id(conn, item)
            if existing_id:
                conn.execute(
                    """
                    UPDATE interview_questions
                    SET category = %s, difficulty = %s, question_text = %s,
                        framework = %s, sample_answer = %s, source = %s
                    WHERE id = %s
                    """,
                    (
                        item["category"],
                        item["difficulty"],
                        item["question_text"],
                        item["framework"],
                        item["sample_answer"],
                        item["source"],
                        existing_id,
                    ),
                )
                qid = existing_id
                updated += 1
            else:
                qid = str(item.get("id") or "").strip() or _new_question_id()
                conn.execute(
                    """
                    INSERT INTO interview_questions (
                      id, category, difficulty, question_text, framework, sample_answer, source, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        qid,
                        item["category"],
                        item["difficulty"],
                        item["question_text"],
                        item["framework"],
                        item["sample_answer"],
                        item["source"],
                        now,
                    ),
                )
                added += 1
            row = conn.execute(
                """
                SELECT id, category, difficulty, question_text, framework, sample_answer, source, created_at
                FROM interview_questions WHERE id = %s
                """,
                (qid,),
            ).fetchone()
            if row:
                saved.append(_row_to_question(dict(row)))
        conn.commit()
    return {"added": added, "updated": updated, "items": saved}


@router.get("/categories")
def get_categories(
    xingce_session: Optional[str] = Cookie(default=None, alias=SESSION_COOKIE),
) -> dict[str, Any]:
    require_module(xingce_session, "interview")
    return {"items": list_categories()}


@router.post("/categories")
def post_category(
    payload: CategoryPayload,
    xingce_session: Optional[str] = Cookie(default=None, alias=SESSION_COOKIE),
) -> dict[str, Any]:
    require_module(xingce_session, "interview")
    try:
        cat = create_category(payload.label, payload.id, payload.sort_order)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {"category": cat}


@router.put("/categories/{category_id}")
def put_category(
    category_id: str,
    payload: CategoryUpdatePayload,
    xingce_session: Optional[str] = Cookie(default=None, alias=SESSION_COOKIE),
) -> dict[str, Any]:
    require_module(xingce_session, "interview")
    try:
        cat = update_category(category_id, payload.label, payload.sort_order)
    except ValueError as e:
        code = 404 if str(e) == "category_not_found" else 400
        raise HTTPException(status_code=code, detail=str(e)) from e
    return {"category": cat}


@router.delete("/categories/{category_id}")
def remove_category(
    category_id: str,
    xingce_session: Optional[str] = Cookie(default=None, alias=SESSION_COOKIE),
) -> dict[str, Any]:
    require_module(xingce_session, "interview")
    try:
        delete_category(category_id)
    except ValueError as e:
        code = 404 if str(e) == "category_not_found" else 400
        raise HTTPException(status_code=code, detail=str(e)) from e
    return {"ok": True, "id": category_id.strip()}


@router.get("/questions")
def list_questions(
    category: Optional[str] = Query(default=None),
    xingce_session: Optional[str] = Cookie(default=None, alias=SESSION_COOKIE),
) -> dict[str, Any]:
    require_module(xingce_session, "interview")
    cat = (category or "").strip()
    if cat:
        try:
            cat = ensure_valid_category_id(cat)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
    with get_conn() as conn:
        if cat:
            rows = conn.execute(
                """
                SELECT id, category, difficulty, question_text, framework, sample_answer, source, created_at
                FROM interview_questions
                WHERE category = %s
                ORDER BY created_at ASC, id ASC
                """,
                (cat,),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT id, category, difficulty, question_text, framework, sample_answer, source, created_at
                FROM interview_questions
                ORDER BY category ASC, created_at ASC, id ASC
                """
            ).fetchall()
    return {"items": [_row_to_question(dict(r)) for r in rows]}


@router.post("/questions")
def create_question(
    payload: QuestionPayload,
    xingce_session: Optional[str] = Cookie(default=None, alias=SESSION_COOKIE),
) -> dict[str, Any]:
    require_module(xingce_session, "interview")
    data = _validate_question_payload(payload)
    qid = _new_question_id()
    now = utcnow().isoformat()
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO interview_questions (
              id, category, difficulty, question_text, framework, sample_answer, source, created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                qid,
                data["category"],
                data["difficulty"],
                data["question_text"],
                data["framework"],
                data["sample_answer"],
                data["source"],
                now,
            ),
        )
        conn.commit()
        row = conn.execute(
            """
            SELECT id, category, difficulty, question_text, framework, sample_answer, source, created_at
            FROM interview_questions WHERE id = %s
            """,
            (qid,),
        ).fetchone()
    return {"question": _row_to_question(dict(row))}


@router.post("/questions/import")
def import_questions(
    payload: ImportQuestionsPayload,
    xingce_session: Optional[str] = Cookie(default=None, alias=SESSION_COOKIE),
) -> dict[str, Any]:
    require_module(xingce_session, "interview")
    try:
        if payload.items is not None:
            from backend.services.interview_import import normalize_question_item

            items = [normalize_question_item(dict(x)) for x in payload.items]
        elif payload.format == "markdown":
            items = parse_markdown_import(payload.content)
        else:
            items = parse_json_import(payload.content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail="json_parse_failed") from e

    if not items:
        raise HTTPException(status_code=400, detail="no_items_to_import")

    result = _upsert_import_items(items)
    return {"ok": True, **result}


@router.get("/questions/{question_id}")
def get_question(
    question_id: str,
    xingce_session: Optional[str] = Cookie(default=None, alias=SESSION_COOKIE),
) -> dict[str, Any]:
    require_module(xingce_session, "interview")
    qid = question_id.strip()
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT id, category, difficulty, question_text, framework, sample_answer, source, created_at
            FROM interview_questions
            WHERE id = %s
            """,
            (qid,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="question_not_found")
    return {"question": _row_to_question(dict(row))}


@router.put("/questions/{question_id}")
def update_question(
    question_id: str,
    payload: QuestionPayload,
    xingce_session: Optional[str] = Cookie(default=None, alias=SESSION_COOKIE),
) -> dict[str, Any]:
    require_module(xingce_session, "interview")
    qid = question_id.strip()
    data = _validate_question_payload(payload)
    with get_conn() as conn:
        row = conn.execute("SELECT id FROM interview_questions WHERE id = %s", (qid,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="question_not_found")
        conn.execute(
            """
            UPDATE interview_questions
            SET category = %s, difficulty = %s, question_text = %s,
                framework = %s, sample_answer = %s, source = %s
            WHERE id = %s
            """,
            (
                data["category"],
                data["difficulty"],
                data["question_text"],
                data["framework"],
                data["sample_answer"],
                data["source"],
                qid,
            ),
        )
        conn.commit()
        updated = conn.execute(
            """
            SELECT id, category, difficulty, question_text, framework, sample_answer, source, created_at
            FROM interview_questions WHERE id = %s
            """,
            (qid,),
        ).fetchone()
    return {"question": _row_to_question(dict(updated))}


@router.delete("/questions/{question_id}")
def delete_question(
    question_id: str,
    xingce_session: Optional[str] = Cookie(default=None, alias=SESSION_COOKIE),
) -> dict[str, Any]:
    require_module(xingce_session, "interview")
    qid = question_id.strip()
    with get_conn() as conn:
        row = conn.execute("SELECT id FROM interview_questions WHERE id = %s", (qid,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="question_not_found")
        conn.execute("DELETE FROM interview_questions WHERE id = %s", (qid,))
        conn.commit()
    return {"ok": True, "id": qid}


@router.get("/records")
def list_records(
    xingce_session: Optional[str] = Cookie(default=None, alias=SESSION_COOKIE),
) -> dict[str, Any]:
    user = require_module(xingce_session, "interview")
    uid = str(user["id"])
    with get_conn() as conn:
        rows = conn.execute(
            f"""
            SELECT {_RECORD_SELECT}
            FROM interview_practice_records
            WHERE user_id = %s
            ORDER BY updated_at DESC
            """,
            (uid,),
        ).fetchall()
    return {"items": [_row_to_record(dict(r)) for r in rows]}


@router.post("/records")
def upsert_record(
    payload: UpsertRecordPayload,
    xingce_session: Optional[str] = Cookie(default=None, alias=SESSION_COOKIE),
) -> dict[str, Any]:
    user = require_module(xingce_session, "interview")
    uid = str(user["id"])
    qid = payload.question_id.strip()
    if not qid:
        raise HTTPException(status_code=400, detail="question_id_required")
    now = utcnow().isoformat()
    with get_conn() as conn:
        qrow = conn.execute(
            "SELECT id FROM interview_questions WHERE id = %s",
            (qid,),
        ).fetchone()
        if not qrow:
            raise HTTPException(status_code=404, detail="question_not_found")
        existing = conn.execute(
            f"""
            SELECT id, practiced_at, polished_answer, review_stage, next_review_at
            FROM interview_practice_records
            WHERE user_id = %s AND question_id = %s
            """,
            (uid, qid),
        ).fetchone()
        review_stage, next_review_at = resolve_polished_schedule(
            old_polished=str(existing["polished_answer"] if existing else ""),
            new_polished=payload.polished_answer,
            old_stage=int(existing["review_stage"] if existing else 0),
            old_next_review=str(existing["next_review_at"] if existing else ""),
            now_iso=now,
        )
        if existing:
            rec_id = existing["id"]
            practiced_at = existing["practiced_at"]
            conn.execute(
                """
                UPDATE interview_practice_records
                SET my_answer = %s, polished_answer = %s, note = %s, is_starred = %s,
                    review_stage = %s, next_review_at = %s, updated_at = %s
                WHERE id = %s AND user_id = %s
                """,
                (
                    payload.my_answer,
                    payload.polished_answer,
                    payload.note,
                    payload.is_starred,
                    review_stage,
                    next_review_at,
                    now,
                    rec_id,
                    uid,
                ),
            )
        else:
            rec_id = "iv-rec-" + secrets.token_hex(8)
            practiced_at = now
            conn.execute(
                """
                INSERT INTO interview_practice_records (
                  id, user_id, question_id, my_answer, polished_answer, note, is_starred,
                  practiced_at, updated_at, next_review_at, review_stage, last_review_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    rec_id,
                    uid,
                    qid,
                    payload.my_answer,
                    payload.polished_answer,
                    payload.note,
                    payload.is_starred,
                    practiced_at,
                    now,
                    next_review_at,
                    review_stage,
                    "",
                ),
            )
        conn.commit()
        row = conn.execute(
            f"""
            SELECT {_RECORD_SELECT}
            FROM interview_practice_records
            WHERE id = %s
            """,
            (rec_id,),
        ).fetchone()
    return {"record": _row_to_record(dict(row))}


@router.post("/records/review")
def submit_review(
    payload: ReviewRecordPayload,
    xingce_session: Optional[str] = Cookie(default=None, alias=SESSION_COOKIE),
) -> dict[str, Any]:
    user = require_module(xingce_session, "interview")
    uid = str(user["id"])
    qid = payload.question_id.strip()
    if not qid:
        raise HTTPException(status_code=400, detail="question_id_required")
    now = utcnow().isoformat()
    with get_conn() as conn:
        existing = conn.execute(
            f"""
            SELECT id, polished_answer, review_stage
            FROM interview_practice_records
            WHERE user_id = %s AND question_id = %s
            """,
            (uid, qid),
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="record_not_found")
        if not str(existing.get("polished_answer") or "").strip():
            raise HTTPException(status_code=400, detail="polished_answer_required")
        review_stage, next_review_at = apply_review_rating(
            review_stage=int(existing.get("review_stage") or 0),
            rating=payload.rating,
            now_iso=now,
        )
        rec_id = existing["id"]
        conn.execute(
            """
            UPDATE interview_practice_records
            SET review_stage = %s, next_review_at = %s, last_review_at = %s, updated_at = %s
            WHERE id = %s AND user_id = %s
            """,
            (review_stage, next_review_at, now, now, rec_id, uid),
        )
        conn.commit()
        row = conn.execute(
            f"""
            SELECT {_RECORD_SELECT}
            FROM interview_practice_records
            WHERE id = %s
            """,
            (rec_id,),
        ).fetchone()
    return {"record": _row_to_record(dict(row))}
