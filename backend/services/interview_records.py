"""面试练习记录：完整版口播稿与间隔复习。"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Literal

from backend.database import get_conn

ReviewRating = Literal["smooth", "ok", "forgot"]

# 复习间隔（天）：第 1～4 轮
REVIEW_INTERVALS_DAYS: tuple[int, ...] = (3, 7, 14, 30)
FORGOT_INTERVAL_DAYS = 1
MAX_REVIEW_STAGE = len(REVIEW_INTERVALS_DAYS)


def migrate_interview_practice_records_schema() -> None:
    with get_conn() as conn:
        conn.execute(
            "ALTER TABLE interview_practice_records ADD COLUMN IF NOT EXISTS polished_answer TEXT NOT NULL DEFAULT ''"
        )
        conn.execute(
            "ALTER TABLE interview_practice_records ADD COLUMN IF NOT EXISTS next_review_at TEXT NOT NULL DEFAULT ''"
        )
        conn.execute(
            "ALTER TABLE interview_practice_records ADD COLUMN IF NOT EXISTS review_stage INTEGER NOT NULL DEFAULT 0"
        )
        conn.execute(
            "ALTER TABLE interview_practice_records ADD COLUMN IF NOT EXISTS last_review_at TEXT NOT NULL DEFAULT ''"
        )
        try:
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_interview_records_user_review
                ON interview_practice_records(user_id, next_review_at)
                WHERE next_review_at <> ''
                """
            )
        except Exception:
            pass
        conn.commit()


def _parse_iso(text: str) -> datetime:
    raw = (text or "").strip()
    if not raw:
        return datetime.now(timezone.utc)
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(raw)
    except ValueError:
        return datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _iso_after_days(base_iso: str, days: int) -> str:
    base = _parse_iso(base_iso)
    return (base + timedelta(days=max(1, days))).isoformat()


def interval_days_for_stage(stage: int) -> int:
    if stage <= 0:
        return REVIEW_INTERVALS_DAYS[0]
    idx = min(stage - 1, len(REVIEW_INTERVALS_DAYS) - 1)
    return REVIEW_INTERVALS_DAYS[idx]


def schedule_initial_review(now_iso: str) -> tuple[int, str]:
    """写好完整版后：第 1 轮，3 天后复习。"""
    return 1, _iso_after_days(now_iso, REVIEW_INTERVALS_DAYS[0])


def apply_review_rating(
    *,
    review_stage: int,
    rating: ReviewRating,
    now_iso: str,
) -> tuple[int, str]:
    stage = max(0, int(review_stage or 0))
    if rating == "forgot":
        return 1, _iso_after_days(now_iso, FORGOT_INTERVAL_DAYS)
    if rating == "smooth":
        stage = min(stage + 1, MAX_REVIEW_STAGE) if stage > 0 else 1
    elif rating == "ok":
        stage = stage if stage > 0 else 1
    days = interval_days_for_stage(stage)
    return stage, _iso_after_days(now_iso, days)


def resolve_polished_schedule(
    *,
    old_polished: str,
    new_polished: str,
    old_stage: int,
    old_next_review: str,
    now_iso: str,
) -> tuple[int, str]:
    """保存完整版时更新复习计划（首次写入才自动排期）。"""
    old_text = (old_polished or "").strip()
    new_text = (new_polished or "").strip()
    if not new_text:
        return 0, ""
    if not old_text:
        return schedule_initial_review(now_iso)
    return max(0, int(old_stage or 0)), (old_next_review or "").strip()
