from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Optional

from app.core import summarize_error
from app.security import utcnow


@dataclass(frozen=True)
class TodayTrainingConfig:
    recent_cooldown_days: int = 2
    yesterday_repeat_penalty: float = 0.35
    recent_repeat_penalty: float = 0.25
    recent_correct_penalty: float = 0.15
    new_in_pool_bonus: float = 0.10
    focus_bonus: float = 0.05
    max_same_subtype_ratio: float = 0.35
    max_yesterday_ratio: float = 0.20
    max_wrong_score: int = 4


def _parse_iso_date(raw: Any) -> Optional[datetime]:
    text = str(raw or "").strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        short = text[:10]
        try:
            return datetime.fromisoformat(short)
        except ValueError:
            return None


def _days_since(raw: Any) -> Optional[int]:
    dt = _parse_iso_date(raw)
    if not dt:
        return None
    now = utcnow()
    delta = now.date() - dt.date()
    return max(delta.days, 0)


def _build_time_recency_score(last_wrong_at: Any) -> float:
    days = _days_since(last_wrong_at)
    if days is None:
        return 0.1
    if days <= 1:
        return 1.0
    if days <= 3:
        return 0.75
    if days <= 7:
        return 0.5
    if days <= 14:
        return 0.25
    return 0.1


def _normalize_wrong_count(value: int, max_score: int) -> float:
    if max_score <= 0:
        return 0.0
    return min(max(value, 0), max_score) / float(max_score)


def _error_key(error: dict[str, Any]) -> str:
    return str(error.get("id") or error.get("questionId") or "").strip()


def _key_from_attempt_row(row: dict[str, Any]) -> str:
    return str(row.get("error_id") or row.get("question_id") or "").strip()


def build_today_training_queue(
    errors: list[dict[str, Any]],
    behavior_map: dict[str, dict[str, Any]],
    attempt_rows: list[dict[str, Any]],
    limit: int,
    config: TodayTrainingConfig | None = None,
) -> list[dict[str, Any]]:
    cfg = config or TodayTrainingConfig()
    normalized_limit = max(1, min(int(limit or 1), 60))
    history_map: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in attempt_rows:
        key = _key_from_attempt_row(row)
        if not key:
            continue
        history_map[key].append(row)

    candidates: list[dict[str, Any]] = []
    for error in errors:
        key = _error_key(error)
        if not key:
            continue
        answer = str(error.get("answer") or "").strip()
        if not answer:
            continue
        status = str(error.get("status") or "").strip().lower()
        mastery = str(error.get("masteryLevel") or "").strip().lower()
        if status not in {"focus", "review"}:
            continue
        if mastery == "mastered":
            continue

        behavior = behavior_map.get(key) or behavior_map.get(str(error.get("questionId") or "").strip()) or {}
        wrong_count = int(behavior.get("recentWrongCount") or 0)
        last_wrong_at = behavior.get("lastTime") or ""
        attempts = history_map.get(key, [])
        if attempts:
            wrong_attempt_times = [
                str(item.get("updated_at") or item.get("created_at") or "")
                for item in attempts
                if str(item.get("result") or "") == "wrong"
            ]
            if wrong_attempt_times:
                wrong_count = max(wrong_count, len(wrong_attempt_times))
                last_wrong_at = max(wrong_attempt_times)

        wrong_score = _normalize_wrong_count(wrong_count, cfg.max_wrong_score)
        recency_score = _build_time_recency_score(last_wrong_at)
        final_score = 0.7 * wrong_score + 0.3 * recency_score

        latest_attempt_time = ""
        latest_attempt_result = ""
        if attempts:
            latest = max(
                attempts,
                key=lambda item: (
                    str(item.get("updated_at") or ""),
                    str(item.get("created_at") or ""),
                    str(item.get("id") or ""),
                ),
            )
            latest_attempt_time = str(latest.get("updated_at") or latest.get("created_at") or "")
            latest_attempt_result = str(latest.get("result") or "")

        days_since_latest = _days_since(latest_attempt_time)
        if days_since_latest is not None:
            if days_since_latest <= 1:
                final_score -= cfg.yesterday_repeat_penalty
            elif days_since_latest <= cfg.recent_cooldown_days:
                final_score -= cfg.recent_repeat_penalty
        if latest_attempt_result == "correct" and days_since_latest is not None and days_since_latest <= 7:
            final_score -= cfg.recent_correct_penalty

        added_days = _days_since(error.get("addDate") or error.get("updatedAt"))
        if added_days is not None and added_days <= 7:
            final_score += cfg.new_in_pool_bonus
        if status == "focus":
            final_score += cfg.focus_bonus

        priority_reasons = [f"wrong={wrong_count}", f"lastWrong={last_wrong_at or 'N/A'}"]
        if days_since_latest is not None and days_since_latest <= cfg.recent_cooldown_days:
            priority_reasons.append("cooldown_penalty")

        candidates.append(
            {
                "error": error,
                "score": round(final_score, 4),
                "wrongCount": wrong_count,
                "lastWrongAt": last_wrong_at,
                "recentAttemptDays": days_since_latest,
                "priorityReasons": priority_reasons,
            }
        )

    candidates.sort(
        key=lambda item: (
            -float(item["score"]),
            -int(item["wrongCount"]),
            str(item["lastWrongAt"] or ""),
            str(item["error"].get("updatedAt") or ""),
            str(item["error"].get("id") or ""),
        )
    )

    max_same_subtype = max(2, int(normalized_limit * cfg.max_same_subtype_ratio))
    max_yesterday_repeat = max(1, int(normalized_limit * cfg.max_yesterday_ratio))
    picked: list[dict[str, Any]] = []
    subtype_counter: dict[str, int] = defaultdict(int)
    yesterday_repeat_count = 0

    def _pick(stage: int) -> None:
        nonlocal yesterday_repeat_count
        for item in candidates:
            if len(picked) >= normalized_limit:
                return
            key = _error_key(item["error"])
            if any(_error_key(existing["error"]) == key for existing in picked):
                continue
            subtype = str(item["error"].get("subtype") or "unknown").strip() or "unknown"
            recent_days = item["recentAttemptDays"]
            is_yesterday = recent_days is not None and recent_days <= 1
            if stage == 0:
                if subtype_counter[subtype] >= max_same_subtype:
                    continue
                if is_yesterday and yesterday_repeat_count >= max_yesterday_repeat:
                    continue
            elif stage == 1:
                if is_yesterday and yesterday_repeat_count >= max_yesterday_repeat:
                    continue
            picked.append(item)
            subtype_counter[subtype] += 1
            if is_yesterday:
                yesterday_repeat_count += 1

    _pick(0)
    _pick(1)
    _pick(2)

    result: list[dict[str, Any]] = []
    for item in picked[:normalized_limit]:
        base = summarize_error(item["error"])
        behavior = behavior_map.get(base["id"]) or behavior_map.get(str(item["error"].get("questionId") or "").strip()) or {}
        result.append(
            base
            | {
                "practiceScore": int(round(float(item["score"]) * 100)),
                "wrongCount": int(item["wrongCount"]),
                "lastWrongAt": str(item["lastWrongAt"] or ""),
                "priorityReasons": item["priorityReasons"],
            }
            | behavior
        )
    return result
