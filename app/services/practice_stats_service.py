from __future__ import annotations

from collections import Counter
from typing import Any

from app.core import compute_daily_practice, summarize_error

_NOTE_FIRST_HINTS = (
    "不会",
    "没想到",
    "想不到",
    "题型",
    "识别",
    "概念",
    "公式",
    "方法",
    "语境",
    "理解偏差",
    "知识点",
)
_DIRECT_DO_HINTS = (
    "粗心",
    "看漏",
    "漏读",
    "审题",
    "顺序",
    "比较",
    "主语",
    "限定",
    "代入",
    "选项",
)
_SPEED_DRILL_HINTS = (
    "耗时",
    "拖慢",
    "犹豫",
    "时间",
    "来不及",
    "卡住",
    "速度",
    "超时",
)


def build_practice_insights(
    errors: list[dict[str, Any]],
    behavior_map: dict[str, dict[str, Any]],
    daily_limit: int = 12,
    review_limit: int = 6,
) -> dict[str, Any]:
    daily_queue = compute_daily_practice(errors, max(1, min(daily_limit, 30)), behavior_map)
    score_by_error_id = {str(item.get("id") or "").strip(): int(item.get("practiceScore") or 0) for item in daily_queue}
    review_candidates: list[tuple[int, dict[str, Any]]] = []
    retrain_candidates: list[tuple[int, dict[str, Any]]] = []
    reason_counter: Counter[str] = Counter()
    type_counter: Counter[str] = Counter()

    for error in errors:
        error_id = str(error.get("id") or "").strip()
        behavior = behavior_map.get(error_id) or {}
        reason_text = str(error.get("rootReason") or error.get("errorReason") or behavior.get("lastMistakeType") or "").strip()
        if reason_text:
            reason_counter[reason_text] += 1
        type_text = str(error.get("type") or "").strip()
        if type_text:
            type_counter[type_text] += 1

        has_reason = any(str(error.get(key) or "").strip() for key in ("rootReason", "errorReason", "analysis", "nextAction"))
        has_canvas = bool(str(error.get("processCanvas") or error.get("processImage") or "").strip())
        review_done = has_reason or behavior.get("closureDone") or has_canvas
        attempt_count = int(behavior.get("recentAttemptCount") or 0)
        wrong_count = int(behavior.get("recentWrongCount") or 0)
        confidence = int(behavior.get("lastConfidence") or 0)
        last_result = str(behavior.get("lastResult") or "")
        score = int(score_by_error_id.get(error_id) or 0)

        if attempt_count and not review_done:
            review_candidates.append((score + 15 + wrong_count * 2, error))
        elif review_done and attempt_count and (last_result == "wrong" or confidence <= 2 or wrong_count >= 2):
            retrain_candidates.append((score + 12 + wrong_count * 2, error))
        elif review_done and not attempt_count:
            retrain_candidates.append((score + 8, error))

    review_candidates.sort(key=lambda item: (-item[0], str(item[1].get("updatedAt") or ""), str(item[1].get("id") or "")))
    retrain_candidates.sort(key=lambda item: (-item[0], str(item[1].get("updatedAt") or ""), str(item[1].get("id") or "")))

    def _pack_queue(items: list[tuple[int, dict[str, Any]]], reason_label: str) -> list[dict[str, Any]]:
        packed: list[dict[str, Any]] = []
        for score, error in items[:review_limit]:
            error_id = str(error.get("id") or "").strip()
            packed.append(
                summarize_error(error)
                | {
                    "queueScore": score,
                    "queueReason": reason_label,
                }
                | (behavior_map.get(error_id) or {})
            )
        return packed

    review_queue = _pack_queue(review_candidates, "先补全复盘")
    retrain_queue = _pack_queue(retrain_candidates, "先做复训")

    advice: list[dict[str, Any]] = []
    behavior_total = len(behavior_map)
    if review_queue:
        advice.append(
            {
                "key": "review_queue",
                "title": f"先补完 {min(len(review_queue), review_limit)} 道待复盘题",
                "description": "这些题已经练过，但错因/总结/画布等复盘痕迹还不完整。",
                "targetIds": [str(item.get("id") or "") for item in review_queue[:review_limit]],
            }
        )
    if retrain_queue:
        advice.append(
            {
                "key": "retrain_queue",
                "title": f"优先复训 {min(len(retrain_queue), review_limit)} 道已复盘但不稳定题",
                "description": "这些题已经有复盘痕迹，但最近仍做错、低把握或高耗时。",
                "targetIds": [str(item.get("id") or "") for item in retrain_queue[:review_limit]],
            }
        )
    if daily_queue:
        weak_type = type_counter.most_common(1)[0][0] if type_counter else "当前弱项"
        advice.append(
            {
                "key": "daily_queue",
                "title": f"今天先练 {weak_type} 相关高风险题",
                "description": "daily practice 已优先按反复错、低把握、高耗时重新排序。",
                "targetIds": [str(item.get("id") or "") for item in daily_queue[:review_limit]],
            }
        )

    weakest_reasons = [{"name": name, "count": count} for name, count in reason_counter.most_common(5)]
    weakest_types = [{"name": name, "count": count} for name, count in type_counter.most_common(5)]

    mission = {
        "total": len(daily_queue),
        "reviewCount": len(review_queue),
        "retrainCount": len(retrain_queue),
        "suggestedDailyCount": min(max(8, len(review_queue) + len(retrain_queue)), max(len(daily_queue), 8)),
        "suggestedReviewCount": min(max(4, len(review_queue)), max(len(review_queue), 4)),
        "suggestedRetrainCount": min(max(4, len(retrain_queue)), max(len(retrain_queue), 4)),
    }

    behavior = {
        "recentTrackedCount": behavior_total,
        "lowConfidenceCount": sum(1 for item in behavior_map.values() if int(item.get("lastConfidence") or 0) and int(item.get("lastConfidence") or 0) <= 2),
        "recentWrongCount": sum(int(item.get("recentWrongCount") or 0) for item in behavior_map.values()),
    }
    return {
        "dailyQueue": daily_queue,
        "reviewQueue": review_queue,
        "retrainQueue": retrain_queue,
        "advice": advice[:3],
        "weakestReasons": weakest_reasons,
        "weakestTypes": weakest_types,
        "attemptSummaryCount": len(behavior_map),
        "mission": mission,
        "behavior": behavior,
    }


def lane_text_blob(error: dict[str, Any], behavior: dict[str, Any]) -> str:
    return " ".join(
        str(error.get(key) or behavior.get(key) or "").strip()
        for key in (
            "rootReason",
            "errorReason",
            "analysis",
            "tip",
            "nextAction",
            "problemType",
            "subtype",
            "subSubtype",
            "lastMistakeType",
            "lastTriggerPoint",
            "lastCorrectModel",
            "lastNextAction",
        )
    ).lower()


def matches_any(text: str, keywords: tuple[str, ...]) -> bool:
    return any(keyword in text for keyword in keywords)


def build_flow_workbench(
    errors: list[dict[str, Any]],
    behavior_map: dict[str, dict[str, Any]],
    limit: int = 6,
) -> dict[str, Any]:
    normalized_limit = max(1, min(limit, 12))
    ranked_daily = compute_daily_practice(errors, max(normalized_limit * 3, 18), behavior_map)
    summary_by_id = {str(item.get("id") or ""): item for item in ranked_daily}

    note_first_candidates: list[tuple[int, dict[str, Any]]] = []
    direct_do_candidates: list[tuple[int, dict[str, Any]]] = []
    speed_drill_candidates: list[tuple[int, dict[str, Any]]] = []
    weakness_counter: Counter[str] = Counter()
    type_counter: Counter[str] = Counter()

    for error in errors:
        error_id = str(error.get("id") or "").strip()
        if not error_id:
            continue
        status = str(error.get("status") or "").strip().lower()
        mastery_level = str(error.get("masteryLevel") or "").strip().lower()
        if status == "mastered" or mastery_level == "mastered":
            continue

        behavior = behavior_map.get(error_id) or {}
        ranked_item = summary_by_id.get(error_id) or summarize_error(error)
        base_score = int(ranked_item.get("practiceScore") or 0)
        blob = lane_text_blob(error, behavior)
        problem_type = str(error.get("problemType") or "").strip().lower()
        target_duration = max(int(error.get("targetDurationSec") or 0), 1)
        actual_duration = max(
            int(error.get("actualDurationSec") or 0),
            int(behavior.get("lastDuration") or 0),
            int(behavior.get("avgDuration") or 0),
        )
        confidence = int(error.get("confidence") or behavior.get("lastConfidence") or 0)
        wrong_count = int(behavior.get("recentWrongCount") or 0)
        last_result = str(behavior.get("lastResult") or "")
        note_node_id = str(error.get("noteNodeId") or behavior.get("noteNodeId") or "").strip()
        note_ready = bool(note_node_id or str(error.get("tip") or "").strip() or str(error.get("analysis") or "").strip())

        weakness_name = str(error.get("rootReason") or error.get("errorReason") or behavior.get("lastMistakeType") or "").strip()
        if weakness_name:
            weakness_counter[weakness_name] += 1
        type_name = str(error.get("type") or "").strip()
        if type_name:
            type_counter[type_name] += 1

        is_speed_drill = (
            (actual_duration and actual_duration > target_duration and target_duration > 0)
            or (target_duration and actual_duration >= int(target_duration * 1.5))
            or matches_any(blob, _SPEED_DRILL_HINTS)
        )
        is_note_first = (
            problem_type == "cognition"
            or matches_any(blob, _NOTE_FIRST_HINTS)
            or (confidence and confidence <= 2 and note_ready and not is_speed_drill)
        )
        is_direct_do = (
            problem_type == "execution"
            or matches_any(blob, _DIRECT_DO_HINTS)
            or last_result == "wrong"
            or wrong_count >= 1
        )

        lane_reason = "优先处理"
        item = ranked_item | {
            "taskMode": "daily",
            "taskLane": "direct_do",
            "taskReason": lane_reason,
            "noteReady": note_ready,
            "noteNodeId": note_node_id,
            "recentWrongCount": wrong_count,
            "lastConfidence": int(behavior.get("lastConfidence") or 0),
            "lastDuration": int(behavior.get("lastDuration") or 0),
            "avgDuration": int(behavior.get("avgDuration") or 0),
            "lastResult": last_result,
        }

        if is_speed_drill:
            lane_reason = "超时或明显拖慢，先限时复训"
            item = item | {"taskMode": "speed", "taskLane": "speed_drill", "taskReason": lane_reason}
            speed_drill_candidates.append((base_score + 18 + min(actual_duration // max(target_duration, 1), 12), item))
            continue

        if is_note_first and note_ready:
            lane_reason = "方法未稳，先看笔记再做题"
            item = item | {"taskMode": "note", "taskLane": "note_first", "taskReason": lane_reason}
            note_first_candidates.append((base_score + 14 + max(0, 3 - confidence), item))
            continue

        if is_direct_do or not note_ready:
            lane_reason = "有基础但容易做错，先直接开做"
            item = item | {"taskMode": "direct", "taskLane": "direct_do", "taskReason": lane_reason}
            direct_do_candidates.append((base_score + 10 + wrong_count * 2, item))
            continue

        lane_reason = "先看短提示后进入练习"
        item = item | {"taskMode": "direct", "taskLane": "direct_do", "taskReason": lane_reason}
        direct_do_candidates.append((base_score + 8, item))

    def _top(items: list[tuple[int, dict[str, Any]]]) -> list[dict[str, Any]]:
        items.sort(key=lambda pair: (-pair[0], str(pair[1].get("updatedAt") or ""), str(pair[1].get("id") or "")))
        return [item | {"queueScore": score} for score, item in items[:normalized_limit]]

    note_first_queue = _top(note_first_candidates)
    direct_do_queue = _top(direct_do_candidates)
    speed_drill_queue = _top(speed_drill_candidates)

    advice: list[dict[str, Any]] = []
    if note_first_queue:
        advice.append(
            {
                "key": "note_first",
                "title": f"先补 {len(note_first_queue)} 道方法型题",
                "description": "这批题更像不会做或方法未稳，先看笔记摘要再进入题目。",
                "targetIds": [str(item.get("id") or "") for item in note_first_queue],
            }
        )
    if direct_do_queue:
        advice.append(
            {
                "key": "direct_do",
                "title": f"直接验证 {len(direct_do_queue)} 道易错题",
                "description": "这批题更像会做但容易失误，先看一句提醒再开做。",
                "targetIds": [str(item.get("id") or "") for item in direct_do_queue],
            }
        )
    if speed_drill_queue:
        advice.append(
            {
                "key": "speed_drill",
                "title": f"限时压缩 {len(speed_drill_queue)} 道慢题",
                "description": "这批题的主要问题是耗时，先做题再看摘要，重点压时间。",
                "targetIds": [str(item.get("id") or "") for item in speed_drill_queue],
            }
        )

    return {
        "overview": {
            "totalErrors": len(errors),
            "noteFirstCount": len(note_first_queue),
            "directDoCount": len(direct_do_queue),
            "speedDrillCount": len(speed_drill_queue),
            "attemptTrackedCount": len(behavior_map),
        },
        "noteFirstQueue": note_first_queue,
        "directDoQueue": direct_do_queue,
        "speedDrillQueue": speed_drill_queue,
        "weakestReasons": [{"name": name, "count": count} for name, count in weakness_counter.most_common(5)],
        "weakestTypes": [{"name": name, "count": count} for name, count in type_counter.most_common(5)],
        "advice": advice,
    }
