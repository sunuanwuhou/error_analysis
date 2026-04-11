from __future__ import annotations

import base64
import hashlib
import json
import mimetypes
import os
import re
import secrets
import sqlite3
import urllib.error
import urllib.request
import uuid
from datetime import datetime
from typing import Any, Optional

from fastapi import Cookie, FastAPI, File, HTTPException, Query, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.config import (
    ALLOWED_ENTRY_TYPES,
    BASE_DIR,
    DEEPSEEK_API_URL,
    DEEPSEEK_CHAT_MODEL,
    DEFAULT_MINIMAX_MODEL,
    HTML_PATH,
    IMAGES_DIR,
    JSON_RESPONSE_TASKS,
    LOGIN_HTML_PATH,
    MINIMAX_API_URL,
    OCR_MAX_BYTES,
    RUNTIME_MODE,
    SELF_SERVICE_REGISTRATION_ENABLED,
    SESSION_COOKIE,
    SESSION_TTL_DAYS,
    SHENLUN_HTML_PATH,
    TASK_ROUTING,
)
from app.database import get_conn, init_db
from app.runtime import build_runtime_label, infer_request_origin, normalize_origin, read_tunnel_url, request_is_secure
from app.schemas import (
    AnalyzeEntryPayload,
    AuthPayload,
    BackupPayload,
    ChatPayload,
    CodexMessageCreatePayload,
    CodexThreadCreatePayload,
    DiscoverPatternsPayload,
    DistillPayload,
    EvaluateAnswerPayload,
    GenerateQuestionPayload,
    ModuleSummaryPayload,
    OriginStatusPayload,
    PracticeLogPayload,
    SuggestRestructurePayload,
    SyncPushPayload,
    SynthesizeNodePayload,
)
from app.security import clear_session, create_user_account, get_user_by_token, issue_session, parse_iso_datetime, utcnow, verify_password
from app.services.origin_status_service import list_origin_statuses, upsert_origin_status
from app.services.snapshot_service import (
    build_backup_summary,
    flatten_knowledge_tree,
    get_backup_errors,
    get_workspace_snapshot_updated_at,
    load_backup_payload,
    save_backup_payload,
)
from app.services.workspace_entity_service import (
    append_workspace_snapshot_ops,
    apply_sync_op_to_state_entity,
    build_workspace_snapshot_from_entities,
    cleanup_old_ops,
    ensure_workspace_entities_seeded,
    iter_backup_sync_entities,
    list_current_sync_ops,
    normalize_error_sync_record,
    normalize_knowledge_node_sync_record,
    normalize_note_image_sync_record,
    normalize_note_type_sync_record,
    normalize_setting_sync_record,
    replace_workspace_entities_from_snapshot,
)

def on_startup() -> None:
    init_db()
    with get_conn() as conn:
        count = conn.execute("SELECT COUNT(*) AS count FROM users").fetchone()["count"]
    if not count:
        default_username = os.getenv("DEFAULT_ADMIN_USERNAME", "admin")
        default_password = os.getenv("DEFAULT_ADMIN_PASSWORD", "admin123456")
        create_user_account(default_username, default_password)

def json_error(message: str, status_code: int) -> JSONResponse:
    return JSONResponse({"error": message}, status_code=status_code)

def require_user(token: Optional[str]) -> dict[str, Any]:
    user = get_user_by_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="unauthorized")
    return user

def parse_context_json(raw: str) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}

def normalize_codex_title(title: str) -> str:
    cleaned = re.sub(r"\s+", " ", (title or "").strip())
    return cleaned[:80] if cleaned else "Codex 收件箱"

def build_codex_thread_summary(conn: sqlite3.Connection, row: sqlite3.Row) -> dict[str, Any]:
    last_message = conn.execute(
        """
        SELECT role, content, created_at, status
        FROM codex_messages
        WHERE thread_id = ?
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (row["id"],),
    ).fetchone()
    counts = conn.execute(
        """
        SELECT
          COUNT(*) AS total_count,
          SUM(CASE WHEN role = 'user' AND status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
          SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) AS reply_count
        FROM codex_messages
        WHERE thread_id = ?
        """,
        (row["id"],),
    ).fetchone()
    return {
        "id": row["id"],
        "title": row["title"],
        "archived": bool(row["archived"]),
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "lastMessagePreview": clean_multiline_text(last_message["content"], 120) if last_message else "",
        "lastMessageRole": last_message["role"] if last_message else "",
        "lastMessageAt": last_message["created_at"] if last_message else "",
        "lastMessageStatus": last_message["status"] if last_message else "",
        "messageCount": int(counts["total_count"] or 0),
        "pendingCount": int(counts["pending_count"] or 0),
        "replyCount": int(counts["reply_count"] or 0),
    }

def ensure_codex_thread_owner(conn: sqlite3.Connection, thread_id: str, user_id: str) -> sqlite3.Row:
    row = conn.execute(
        """
        SELECT id, user_id, title, archived, created_at, updated_at
        FROM codex_threads
        WHERE id = ? AND user_id = ?
        """,
        (thread_id, user_id),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="codex thread not found")
    return row

def extract_json_object(text: str) -> dict[str, Any]:
    cleaned = (text or "").strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{[\s\S]*\}", cleaned)
    if not match:
        raise ValueError("model did not return JSON object")
    parsed = json.loads(match.group(0))
    if not isinstance(parsed, dict):
        raise ValueError("model did not return JSON object")
    return parsed

def get_minimax_settings() -> tuple[str, str]:
    api_key = os.getenv("MINIMAX_API_KEY", "").strip()
    model = os.getenv("MINIMAX_MODEL", "").strip() or DEFAULT_MINIMAX_MODEL
    if not api_key:
        raise HTTPException(status_code=503, detail="MINIMAX_API_KEY not configured")
    return api_key, model

def clean_short_text(value: Any, limit: int) -> str:
    text = str(value or "").strip()
    text = re.sub(r"\s+", " ", text)
    return text[:limit]

def clean_multiline_text(value: Any, limit: int) -> str:
    text = str(value or "").strip()
    text = re.sub(r"\r\n?", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text[:limit]

def validate_analyze_result(parsed: dict[str, Any], payload: AnalyzeEntryPayload) -> dict[str, Any]:
    entry_type = clean_short_text(parsed.get("type") or payload.type or "其他", 20)
    if entry_type not in ALLOWED_ENTRY_TYPES:
        entry_type = payload.type if payload.type in ALLOWED_ENTRY_TYPES else "其他"

    subtype = clean_short_text(parsed.get("subtype") or payload.subtype, 30)
    sub_subtype = clean_short_text(parsed.get("subSubtype") or payload.subSubtype, 30)
    root_reason = clean_short_text(parsed.get("rootReason") or payload.rootReason, 20)
    error_reason = clean_short_text(parsed.get("errorReason") or payload.errorReason, 8)
    analysis = clean_multiline_text(parsed.get("analysis") or payload.analysis, 300)

    candidates = []
    for item in parsed.get("knowledgeCandidates") or []:
        text = clean_short_text(item, 80)
        if text and text not in candidates:
            candidates.append(text)
        if len(candidates) >= 3:
            break

    return {
        "type": entry_type,
        "subtype": subtype,
        "subSubtype": sub_subtype,
        "rootReason": root_reason,
        "errorReason": error_reason,
        "analysis": analysis,
        "knowledgeCandidates": candidates,
    }

def build_ai_messages(payload: AnalyzeEntryPayload) -> list[dict[str, str]]:
    system_prompt = (
        "你是公务员行测错题录入助手。"
        "你必须只返回一个 JSON 对象。"
        "不要返回 markdown，不要返回解释，不要返回代码块，不要返回 JSON 之外的任何字符。"
        "字段固定为 type, subtype, subSubtype, rootReason, errorReason, analysis, knowledgeCandidates。"
        "knowledgeCandidates 必须是字符串数组，最多 3 项。"
        "type 只能从以下值中选一个：言语理解与表达、数量关系、判断推理、资料分析、常识判断、其他。"
        "subtype 和 subSubtype 要尽量简洁，适合直接回填表单。"
        "\n"
        "rootReason：20 字以内，写深层能力短板，不复述题面，不照抄 errorReason。"
        "\n"
        "errorReason：8 字以内。优先从以下参考词中选择；若均不贴切，可自由填写但不超过 8 字：\n"
        "审题类：粗心看错题目/题目没读完/选项没看全/关键词漏看\n"
        "知识类：公式/方法不会/知识点遗忘/概念理解错误/概念混淆/常识知识空白\n"
        "言语类：词义/语义理解偏差/主旨提炼失误/过度推断/绝对化/语境分析错误/近义词辨析失误\n"
        "推理类：逻辑推理出错/充分必要条件混淆/矛盾/反对关系混淆/论证结构误判/加强/削弱方向判反/图形规律识别失误/类比关系判断错误/定义关键要素未抓住\n"
        "资料分析类：读数/找数出错/增长率与增长量混淆/倍数与百分比混淆/计算量大估算偏差\n"
        "计算类：粗心计算错误/方程列错\n"
        "方法类：方法不熟练/解题思路错误/题型识别错误/代入排除法未用\n"
        "状态类：没时间/蒙的/会做但慌了\n"
        "\n"
        "analysis：先写【根本主因分析】，再写【解题思路】，用 \\n\\n 分隔，总计 150 字以内。"
        "如果信息不足，也要给出最稳妥的短答案，但仍然只能返回 JSON 对象。"
    )
    user_prompt = {
        "entry": {
            "type": payload.type,
            "subtype": payload.subtype,
            "subSubtype": payload.subSubtype,
            "question": payload.question,
            "options": payload.options,
            "answer": payload.answer,
            "myAnswer": payload.myAnswer,
            "rootReason": payload.rootReason,
            "errorReason": payload.errorReason,
            "analysis": payload.analysis,
        },
        "context": {
            "availableSubtypes": payload.availableSubtypes[:30],
            "availableSubSubtypes": payload.availableSubSubtypes[:30],
        },
        "output_example": {
            "type": "判断推理",
            "subtype": "逻辑判断",
            "subSubtype": "条件推理",
            "rootReason": "条件推理规则不稳，无法稳定写出条件链",
            "errorReason": "把逆命题当成可推出结论",
            "analysis": "先整理条件链，再只验证原命题与逆否命题，排除主客体混淆。",
            "knowledgeCandidates": ["判断推理 > 逻辑判断 > 条件推理"]
        }
    }
    return [
        {"role": "system", "name": "AI", "content": system_prompt},
        {"role": "user", "name": "用户", "content": json.dumps(user_prompt, ensure_ascii=False)},
    ]

def call_ai(
    messages: list[dict[str, str]],
    task_type: str = "general",
    temperature: float = 0.2,
    max_tokens: int = 1200,
) -> tuple[str, str]:
    api_key = os.getenv("DEEPSEEK_API_KEY", "").strip()
    deepseek_error: Optional[str] = None
    if api_key:
        model = TASK_ROUTING.get(task_type, DEEPSEEK_CHAT_MODEL)
        body: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if task_type in JSON_RESPONSE_TASKS and "reasoner" not in model:
            body["response_format"] = {"type": "json_object"}

        request = urllib.request.Request(
            DEEPSEEK_API_URL,
            data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                raw = response.read().decode("utf-8")
            data = json.loads(raw)
            content = (((data.get("choices") or [{}])[0].get("message") or {}).get("content") or "")
            if content:
                return content, data.get("model") or model
            deepseek_error = "deepseek returned empty content"
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            deepseek_error = f"deepseek request failed: {detail}"
        except urllib.error.URLError as exc:
            deepseek_error = f"deepseek unavailable: {exc.reason}"
        except Exception as exc:
            deepseek_error = f"deepseek request failed: {exc}"

    if not os.getenv("MINIMAX_API_KEY", "").strip() and deepseek_error:
        raise HTTPException(status_code=502, detail=deepseek_error)

    return call_minimax_raw(messages)

def call_minimax_raw(messages: list[dict[str, str]]) -> tuple[str, str]:
    api_key, model = get_minimax_settings()
    body = {
        "model": model,
        "messages": messages,
        "temperature": 0.2,
        "top_p": 0.95,
        "max_completion_tokens": 1200,
    }
    request = urllib.request.Request(
        MINIMAX_API_URL,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise HTTPException(status_code=502, detail=f"minimax request failed: {detail}") from exc
    except urllib.error.URLError as exc:
        raise HTTPException(status_code=502, detail=f"minimax unavailable: {exc.reason}") from exc

    data = json.loads(raw)
    base_resp = data.get("base_resp") or {}
    if base_resp.get("status_code") not in (None, 0):
        raise HTTPException(status_code=502, detail=base_resp.get("status_msg") or "minimax error")

    content = (((data.get("choices") or [{}])[0].get("message") or {}).get("content") or "")
    return content, data.get("model") or model

def call_analyze_entry(payload: AnalyzeEntryPayload) -> dict[str, Any]:
    content, model = call_ai(build_ai_messages(payload), task_type="analyze_entry")
    parsed = extract_json_object(content)
    cleaned = validate_analyze_result(parsed, payload)
    cleaned["model"] = model
    return cleaned

def run_ocr_bytes(image_bytes: bytes) -> dict[str, Any]:
    if not image_bytes:
        raise HTTPException(status_code=400, detail="empty image body")
    if len(image_bytes) > OCR_MAX_BYTES:
        raise HTTPException(status_code=413, detail="image too large (max 5MB)")

    try:
        import io
        from PIL import Image
        from PIL import ImageFilter
        from PIL import ImageOps
        import pytesseract
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"ocr dependencies unavailable: {exc}") from exc

    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("L")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"unsupported image content: {exc}") from exc

    def collect_line_items(ocr_data: dict[str, Any]) -> list[dict[str, Any]]:
        groups: dict[tuple[int, int, int], dict[str, Any]] = {}
        total_items = len(ocr_data.get("text") or [])
        for idx in range(total_items):
            text = str((ocr_data.get("text") or [""])[idx] or "").strip()
            if not text:
                continue
            try:
                raw_score = float((ocr_data.get("conf") or [0])[idx])
            except Exception:
                raw_score = 0.0
            confidence = round(max(raw_score, 0.0) / 100.0, 4)
            left = int((ocr_data.get("left") or [0])[idx] or 0)
            top = int((ocr_data.get("top") or [0])[idx] or 0)
            width = int((ocr_data.get("width") or [0])[idx] or 0)
            height = int((ocr_data.get("height") or [0])[idx] or 0)
            block_num = int((ocr_data.get("block_num") or [0])[idx] or 0)
            par_num = int((ocr_data.get("par_num") or [0])[idx] or 0)
            line_num = int((ocr_data.get("line_num") or [0])[idx] or 0)
            key = (block_num, par_num, line_num)
            group = groups.setdefault(
                key,
                {
                    "items": [],
                    "top": top,
                    "left": left,
                    "right": left + width,
                    "bottom": top + height,
                    "score_sum": 0.0,
                    "char_count": 0,
                },
            )
            group["items"].append((left, text))
            group["top"] = min(group["top"], top)
            group["left"] = min(group["left"], left)
            group["right"] = max(group["right"], left + width)
            group["bottom"] = max(group["bottom"], top + height)
            group["score_sum"] += confidence * max(len(text), 1)
            group["char_count"] += max(len(text), 1)

        line_items: list[dict[str, Any]] = []
        for group in groups.values():
            ordered = [text for _, text in sorted(group["items"], key=lambda item: item[0])]
            merged = " ".join(ordered).strip()
            if not merged:
                continue
            avg_score = round(group["score_sum"] / max(group["char_count"], 1), 4)
            line_items.append(
                {
                    "text": merged,
                    "score": avg_score,
                    "box": [
                        [group["left"], group["top"]],
                        [group["right"], group["top"]],
                        [group["right"], group["bottom"]],
                        [group["left"], group["bottom"]],
                    ],
                }
            )
        return sorted(line_items, key=lambda item: (item["box"][0][1], item["box"][0][0]))

    def normalize_numeric_line(text: str) -> str:
        cleaned = (text or "").strip()
        if not cleaned:
            return ""
        cleaned = cleaned.replace(" ", "")
        cleaned = cleaned.replace("O", "0").replace("o", "0")
        cleaned = re.sub(r"^[A-D](?=-?\d)", "", cleaned)
        cleaned = re.sub(r"^[=._:;]+", "", cleaned)
        cleaned = re.sub(r"[^\dA-D,\.\(\)\-]+", "", cleaned)
        cleaned = cleaned.replace("B", "8")
        cleaned = re.sub(r"\(\)$", "()", cleaned)
        return cleaned.strip(".,")

    def count_numeric_tokens(text: str) -> int:
        return len(re.findall(r"-?\d+(?:\.\d+)?", text or ""))

    def count_cjk_tokens(text: str) -> int:
        return len(re.findall(r"[\u4e00-\u9fff]", text or ""))

    def build_quality(text: str, weighted_score: float, numeric_mode: bool) -> float:
        digit_weight = count_numeric_tokens(text) * 0.9
        cjk_weight = count_cjk_tokens(text) * (0.12 if not numeric_mode else 0.02)
        option_weight = len(re.findall(r"(?:^|\n)(?:[A-D][\.\u3001]|-?\d[\d\-,\.()]*)", text or "", re.M)) * 0.8
        blank_weight = 1.8 if "()" in (text or "") else 0.0
        stray_letter_penalty = 0.0
        if numeric_mode:
            stray_letter_penalty = len(re.findall(r"[EFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz]", text or "")) * 0.5
        return round(weighted_score + digit_weight + cjk_weight + option_weight + blank_weight - stray_letter_penalty, 4)

    def extract_numeric_option_lines(candidate: dict[str, Any]) -> list[str]:
        numeric_lines = [str(line.get("text") or "").strip() for line in candidate.get("lines") or []]
        numeric_lines = [line for line in numeric_lines if line]
        option_lines = [line for line in numeric_lines[1:] if re.fullmatch(r"-?\d+(?:\.\d+)?", line)]
        if not option_lines:
            return []
        digit_lengths = [len(re.sub(r"^-?", "", line)) for line in option_lines]
        sorted_lengths = sorted(digit_lengths)
        median_len = sorted_lengths[len(sorted_lengths) // 2] if sorted_lengths else 0
        if median_len >= 3:
            filtered = [
                line
                for line in option_lines
                if len(re.sub(r"^-?", "", line)) >= max(2, median_len - 1)
            ]
            if len(filtered) >= 3:
                option_lines = filtered
        compacted: list[str] = []
        for line in option_lines:
            if compacted and compacted[-1] == line:
                continue
            compacted.append(line)
        return compacted

    def extract_short_option_column(source_image: Any) -> list[str]:
        region_top = int(source_image.height * 0.18)
        if source_image.width < 120 or source_image.height - region_top < 120:
            return []
        lower = source_image.crop((0, region_top, source_image.width, source_image.height))
        binary = lower.point(lambda p: 0 if p > 185 else 1)
        col_counts = [sum(binary.getpixel((x, y)) for y in range(binary.height)) for x in range(binary.width)]
        col_threshold = max(8, int(binary.height * 0.05))
        spans: list[list[int]] = []
        start: Optional[int] = None
        prev: Optional[int] = None
        peak_x = 0
        peak_val = 0
        for x, value in enumerate(col_counts):
            if value >= col_threshold:
                if start is None:
                    start = x
                    prev = x
                    peak_x = x
                    peak_val = value
                elif prev is not None and x - prev <= 2:
                    prev = x
                    if value > peak_val:
                        peak_x = x
                        peak_val = value
                else:
                    spans.append([start, prev or start, peak_x, peak_val])
                    start = x
                    prev = x
                    peak_x = x
                    peak_val = value
        if start is not None:
            spans.append([start, prev or start, peak_x, peak_val])

        merged_spans: list[list[int]] = []
        for span in spans:
            if not merged_spans or span[0] - merged_spans[-1][1] > 6:
                merged_spans.append(span)
            else:
                merged_spans[-1][1] = span[1]
                if span[3] > merged_spans[-1][3]:
                    merged_spans[-1][2] = span[2]
                    merged_spans[-1][3] = span[3]

        valid_spans = []
        for start_x, end_x, peak_col, peak_value in merged_spans:
            span_width = end_x - start_x + 1
            center_x = (start_x + end_x) / 2
            if span_width < 6 or span_width > max(int(source_image.width * 0.18), 55):
                continue
            if center_x < source_image.width * 0.15 or center_x > source_image.width * 0.7:
                continue
            valid_spans.append((start_x, end_x, peak_col, peak_value, span_width))
        if not valid_spans:
            return []

        start_x, end_x, _, _, _ = max(valid_spans, key=lambda item: (item[0], item[3]))
        option_region = source_image.crop((max(start_x - 14, 0), region_top, min(end_x + 14, source_image.width), source_image.height))
        option_binary = option_region.point(lambda p: 0 if p > 185 else 1)
        row_counts = [sum(option_binary.getpixel((x, y)) for x in range(option_binary.width)) for y in range(option_binary.height)]
        smoothed_rows: list[float] = []
        for y in range(option_region.height):
            values = row_counts[max(0, y - 4):min(option_region.height, y + 5)]
            smoothed_rows.append(sum(values) / max(len(values), 1))

        row_peaks: list[list[float]] = []
        row_threshold = max(2.5, option_region.width * 0.03)
        merge_gap = max(int(option_region.height * 0.12), 24)
        for y in range(1, option_region.height - 1):
            value = smoothed_rows[y]
            if value < row_threshold or value < smoothed_rows[y - 1] or value < smoothed_rows[y + 1]:
                continue
            if not row_peaks or y - row_peaks[-1][0] > merge_gap:
                row_peaks.append([y, value])
            elif value > row_peaks[-1][1]:
                row_peaks[-1] = [y, value]
        if not row_peaks:
            return []

        results: list[str] = []
        for center_y, _ in row_peaks[:6]:
            row_image = option_region.crop((0, max(0, int(center_y) - 28), option_region.width, min(option_region.height, int(center_y) + 28)))
            vote_scores: dict[str, float] = {}
            for invert in (False, True):
                working_row = ImageOps.invert(row_image) if invert else row_image
                for threshold in (170, 180, 190, 200):
                    prepared = working_row.point(lambda p, t=threshold: 255 if p > t else 0).resize(
                        (max(row_image.width * 18, 1), max(row_image.height * 18, 1)),
                        Image.Resampling.NEAREST,
                    )
                    for psm in (10, 13, 6):
                        raw_text = pytesseract.image_to_string(
                            prepared,
                            lang="eng",
                            config="--oem 3 --psm %d -c tessedit_char_whitelist=0123456789ABCD-" % psm,
                        )
                        cleaned = normalize_numeric_line(raw_text)
                        if not re.fullmatch(r"-?\d+", cleaned):
                            continue
                        weight = 1.0
                        if psm == 13:
                            weight += 0.4
                        if invert:
                            weight += 0.2
                        if len(cleaned) >= 2:
                            weight += 0.2
                        vote_scores[cleaned] = vote_scores.get(cleaned, 0.0) + weight
            if not vote_scores:
                continue
            chosen = max(vote_scores.items(), key=lambda item: (item[1], len(item[0]), item[0]))[0]
            results.append(chosen)
        compacted: list[str] = []
        for value in results:
            if compacted and compacted[-1] == value:
                continue
            compacted.append(value)
        return compacted

    def run_variant(
        name: str,
        candidate: Any,
        psm: int,
        *,
        lang: str,
        extra_config: str = "",
        numeric_mode: bool = False,
    ) -> dict[str, Any]:
        ocr_data = pytesseract.image_to_data(
            candidate,
            lang=lang,
            config=f"--oem 3 --psm {psm} {extra_config}".strip(),
            output_type=pytesseract.Output.DICT,
        )
        raw_lines = collect_line_items(ocr_data)
        lines: list[dict[str, Any]] = []
        line_texts: list[str] = []
        weighted_score = 0.0
        for raw_line in raw_lines:
            text = normalize_numeric_line(raw_line["text"]) if numeric_mode else str(raw_line["text"] or "").strip()
            if not text:
                continue
            score = float(raw_line.get("score") or 0.0)
            weighted_score += score * max(len(text), 1)
            lines.append({**raw_line, "text": text, "score": round(score, 4)})
            line_texts.append(text)
        joined = "\n".join(line_texts).strip()
        return {
            "name": name,
            "text": joined,
            "lines": lines,
            "lineCount": len(lines),
            "quality": build_quality(joined, weighted_score, numeric_mode),
            "numericTokens": count_numeric_tokens(joined),
            "numericMode": numeric_mode,
        }

    base_auto = ImageOps.autocontrast(image)
    width, height = image.size
    safe_left_trim = min(max(int(width * 0.08), 0), max(width - 12, 0))
    trimmed = base_auto.crop((safe_left_trim, 0, width, height)) if safe_left_trim > 0 else base_auto
    lower_crop_top = min(max(int(height * 0.22), 0), max(height - 10, 0))
    lower_crop = base_auto.crop((0, lower_crop_top, width, height)) if lower_crop_top > 0 else base_auto
    numeric_whitelist = "-c tessedit_char_whitelist=0123456789ABCD.,()=-"
    variants = [
        {
            "name": "general_auto_up2_psm11",
            "image": base_auto.resize((max(width * 2, 1), max(height * 2, 1))),
            "psm": 11,
            "lang": "chi_sim+eng",
        },
        {
            "name": "general_sharp_nearest3_psm6",
            "image": base_auto.resize((max(width * 3, 1), max(height * 3, 1)), Image.Resampling.NEAREST).filter(ImageFilter.SHARPEN),
            "psm": 6,
            "lang": "chi_sim+eng",
        },
        {
            "name": "general_trim_sharp3_psm6",
            "image": trimmed.resize((max(trimmed.width * 3, 1), max(trimmed.height * 3, 1)), Image.Resampling.NEAREST).filter(ImageFilter.SHARPEN),
            "psm": 6,
            "lang": "chi_sim+eng",
        },
        {
            "name": "numeric_sharp_nearest4_psm6",
            "image": base_auto.resize((max(width * 4, 1), max(height * 4, 1)), Image.Resampling.NEAREST).filter(ImageFilter.SHARPEN),
            "psm": 6,
            "lang": "eng",
            "extra_config": numeric_whitelist,
            "numeric_mode": True,
        },
        {
            "name": "numeric_bin_nearest4_psm6",
            "image": base_auto.point(lambda p: 255 if p > 180 else 0).resize((max(width * 4, 1), max(height * 4, 1)), Image.Resampling.NEAREST),
            "psm": 6,
            "lang": "eng",
            "extra_config": numeric_whitelist,
            "numeric_mode": True,
        },
        {
            "name": "numeric_bin_nearest5_psm6",
            "image": base_auto.point(lambda p: 255 if p > 180 else 0).resize((max(width * 5, 1), max(height * 5, 1)), Image.Resampling.NEAREST),
            "psm": 6,
            "lang": "eng",
            "extra_config": numeric_whitelist,
            "numeric_mode": True,
        },
        {
            "name": "numeric_lower_bin_nearest4_psm6",
            "image": lower_crop.point(lambda p: 255 if p > 180 else 0).resize((max(lower_crop.width * 4, 1), max(lower_crop.height * 4, 1)), Image.Resampling.NEAREST),
            "psm": 6,
            "lang": "eng",
            "extra_config": numeric_whitelist,
            "numeric_mode": True,
        },
    ]
    candidates: list[dict[str, Any]] = []
    try:
        for variant in variants:
            candidates.append(
                run_variant(
                    variant["name"],
                    variant["image"],
                    variant["psm"],
                    lang=str(variant.get("lang") or "chi_sim+eng"),
                    extra_config=str(variant.get("extra_config") or ""),
                    numeric_mode=bool(variant.get("numeric_mode")),
                )
            )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"ocr failed: {exc}") from exc

    general_candidates = [item for item in candidates if not item.get("numericMode")]
    numeric_candidates = [item for item in candidates if item.get("numericMode")]
    best_general = max(general_candidates, key=lambda item: (item["quality"], item["lineCount"], len(item["text"])))
    best_numeric = max(
        numeric_candidates,
        key=lambda item: (
            len(extract_numeric_option_lines(item)),
            len(set(extract_numeric_option_lines(item))),
            item["quality"],
            item["numericTokens"],
            len(item["text"]),
        ),
    )
    best_numeric_option_lines = extract_numeric_option_lines(best_numeric)
    use_numeric = len(best_numeric_option_lines) >= 3 or best_numeric["numericTokens"] >= max(best_general["numericTokens"] + 2, 6)
    selected = best_numeric if use_numeric else best_general

    if use_numeric:
        numeric_lines = [line["text"] for line in best_numeric["lines"] if str(line.get("text") or "").strip()]
        stem_line = numeric_lines[0] if numeric_lines else ""
        option_lines = [line for line in best_numeric_option_lines if 0 < len(line) <= 12]
        short_option_candidates = [line for line in option_lines if len(re.sub(r"^-?", "", line)) <= 2]
        if len(short_option_candidates) >= 3 or (stem_line and len(re.findall(r"-?\d+", stem_line)) >= 4 and option_lines and max(len(re.sub(r"^-?", "", line)) for line in option_lines) <= 2):
            column_option_lines = extract_short_option_column(base_auto)
            if len(column_option_lines) >= 3:
                normalized_column_lines = [line for line in column_option_lines if 0 < len(line) <= 3]
                if normalized_column_lines:
                    option_lines = normalized_column_lines
        if not stem_line and best_general["lines"]:
            stem_line = str(best_general["lines"][0]["text"] or "").strip()
        merged_lines = [line for line in [stem_line, *option_lines] if line]
        if merged_lines:
            selected = {
                **best_numeric,
                "name": f"{best_numeric['name']}+merge",
                "text": "\n".join(merged_lines).strip(),
                "lines": [
                    {"text": text, "score": 0.0, "box": [[0, 0], [0, 0], [0, 0], [0, 0]]}
                    for text in merged_lines
                ],
                "lineCount": len(merged_lines),
            }

    alternative_items: list[dict[str, Any]] = []
    seen_variants: set[str] = set()
    for item in [selected, best_numeric, best_general, *sorted(numeric_candidates, key=lambda entry: (entry["quality"], entry["numericTokens"], len(entry["text"])), reverse=True), *sorted(general_candidates, key=lambda entry: (entry["quality"], entry["lineCount"], len(entry["text"])), reverse=True)]:
        name = str(item.get("name") or "")
        if not name or name in seen_variants:
            continue
        seen_variants.add(name)
        alternative_items.append(
            {
                "variant": name,
                "text": item["text"],
                "lineCount": item["lineCount"],
                "quality": item["quality"],
            }
        )
        if len(alternative_items) >= 5:
            break

    low_text_hint = ""
    selected_text = str(selected.get("text") or "").strip()
    text_token_count = count_numeric_tokens(selected_text) + count_cjk_tokens(selected_text)
    if text_token_count <= 6 and len(selected_text) <= 24:
        low_text_hint = "检测到图片里的可识别文字较少，像图形推理或纯图题这类内容更适合保留题图并手动补题干。"

    return {
        "engine": "tesseract",
        "variant": selected["name"],
        "lineCount": selected["lineCount"],
        "text": selected["text"],
        "lines": selected["lines"],
        "alternatives": alternative_items,
        "hint": low_text_hint,
    }

def extract_json_value(text: str) -> Any:
    cleaned = (text or "").strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    for pattern in (r"\{[\s\S]*\}", r"\[[\s\S]*\]"):
        match = re.search(pattern, cleaned)
        if match:
            return json.loads(match.group(0))
    raise ValueError("model did not return JSON payload")

def summarize_error(error: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(error.get("id") or ""),
        "type": str(error.get("type") or ""),
        "subtype": str(error.get("subtype") or ""),
        "subSubtype": str(error.get("subSubtype") or ""),
        "question": clean_multiline_text(error.get("question"), 280),
        "options": clean_multiline_text(error.get("options"), 400),
        "answer": clean_short_text(error.get("answer"), 20),
        "myAnswer": clean_short_text(error.get("myAnswer"), 20),
        "status": clean_short_text(error.get("status"), 20),
        "workflowStage": clean_short_text(error.get("workflowStage"), 30),
        "problemType": clean_short_text(error.get("problemType"), 30),
        "nextActionType": clean_short_text(error.get("nextActionType"), 30),
        "confidence": max(0, min(5, int(error.get("confidence") or 0))),
        "isClassic": bool(error.get("isClassic")),
        "difficulty": int(error.get("difficulty") or 2),
        "actualDurationSec": max(0, int(error.get("actualDurationSec") or 0)),
        "targetDurationSec": max(0, int(error.get("targetDurationSec") or 0)),
        "errorReason": clean_short_text(error.get("errorReason"), 40),
        "rootReason": clean_short_text(error.get("rootReason"), 80),
        "analysis": clean_multiline_text(error.get("analysis"), 320),
        "tip": clean_multiline_text(error.get("tip") or error.get("nextAction"), 160),
        "masteryLevel": clean_short_text(error.get("masteryLevel"), 30),
        "updatedAt": clean_short_text(error.get("updatedAt") or error.get("addDate"), 40),
        "noteNodeId": clean_short_text(error.get("noteNodeId"), 60),
        "imgData": str(error["imgData"]) if error.get("imgData") else None,
    }

def filter_errors(errors: list[dict[str, Any]], payload: ModuleSummaryPayload) -> list[dict[str, Any]]:
    result = []
    for error in errors:
        if payload.type and error.get("type") != payload.type:
            continue
        if payload.subtype and error.get("subtype") != payload.subtype:
            continue
        if payload.rootReason and payload.rootReason not in str(error.get("rootReason") or ""):
            continue
        if payload.status and error.get("status") != payload.status:
            continue
        if payload.masteryLevel and error.get("masteryLevel") != payload.masteryLevel:
            continue
        add_date = str(error.get("addDate") or "")
        if payload.dateFrom and add_date and add_date < payload.dateFrom:
            continue
        if payload.dateTo and add_date and add_date > payload.dateTo:
            continue
        result.append(error)
        if len(result) >= payload.limit:
            break
    return result

def compute_daily_practice(
    errors: list[dict[str, Any]],
    limit: int = 12,
    behavior_map: Optional[dict[str, dict[str, Any]]] = None,
) -> list[dict[str, Any]]:
    now = utcnow().date()
    behavior_map = behavior_map or {}
    ranked: list[tuple[int, dict[str, Any], dict[str, Any]]] = []

    def _safe_days_between(value: Any) -> Optional[int]:
        text = str(value or "").strip()[:10]
        if not text:
            return None
        try:
            return max((now - datetime.fromisoformat(text).date()).days, 0)
        except ValueError:
            return None

    for error in errors:
        answer = str(error.get("answer") or "").strip()
        if not answer:
            continue

        error_id = str(error.get("id") or "").strip()
        behavior = behavior_map.get(error_id) or behavior_map.get(str(error.get("questionId") or "").strip()) or {}

        score = 0
        reasons: list[str] = []

        mastery = str(error.get("masteryLevel") or "not_mastered")
        if mastery == "not_mastered":
            score += 28
            reasons.append("未掌握")
        elif mastery == "fuzzy":
            score += 18
            reasons.append("掌握模糊")
        elif mastery == "mastered":
            score += 6

        status = str(error.get("status") or "")
        if status == "focus":
            score += 16
            reasons.append("重点复习")
        elif status == "review":
            score += 10
            reasons.append("待复习")

        stale_days = _safe_days_between(error.get("lastPracticedAt") or error.get("updatedAt") or error.get("addDate"))
        if stale_days is None:
            score += 4
        else:
            score += min(stale_days, 18)
            if stale_days >= 10:
                reasons.append("长期未练")

        recent_days = _safe_days_between(error.get("addDate"))
        if recent_days is not None and recent_days <= 7:
            score += 8
            reasons.append("新近错题")

        attempt_count = int(behavior.get("recentAttemptCount") or 0)
        wrong_count = int(behavior.get("recentWrongCount") or 0)
        correct_count = int(behavior.get("recentCorrectCount") or 0)
        confidence = int(behavior.get("lastConfidence") or 0)
        duration = int(behavior.get("lastDuration") or 0)
        avg_duration = int(behavior.get("avgDuration") or 0)
        closure_done = bool(behavior.get("closureDone"))
        last_result = str(behavior.get("lastResult") or "")
        solved_but_unstable = bool(behavior.get("solvedButUnstable"))
        review_gap_days = _safe_days_between(behavior.get("lastTime"))

        if wrong_count >= 2:
            score += 18 + min(wrong_count * 2, 8)
            reasons.append("近期反复做错")
        elif last_result == "wrong":
            score += 12
            reasons.append("最近一次做错")

        if confidence and confidence <= 2:
            score += 10
            reasons.append("把握度低")
        elif confidence == 3:
            score += 4

        duration_threshold = max(avg_duration, duration)
        if duration_threshold >= 180:
            score += 10
            reasons.append("高耗时")
        elif duration_threshold >= 90:
            score += 6

        if attempt_count and not closure_done:
            score += 12
            reasons.append("已练未补全")
        if closure_done and wrong_count == 0 and correct_count > 0 and status != "mastered":
            score += 8
            reasons.append("已复盘待复训")
        if solved_but_unstable:
            score += 8
            reasons.append("做对但不稳")
        if review_gap_days is not None and review_gap_days >= 5 and attempt_count:
            score += 6
            reasons.append("复训间隔过长")

        if not reasons:
            reasons.append("基础兜底排序")

        ranked.append((score, error, {
            "recentAttemptCount": attempt_count,
            "recentWrongCount": wrong_count,
            "recentCorrectCount": correct_count,
            "lastConfidence": confidence,
            "lastDuration": duration,
            "avgDuration": avg_duration,
            "lastResult": last_result,
            "lastTime": behavior.get("lastTime") or "",
            "closureDone": closure_done,
            "solvedButUnstable": solved_but_unstable,
            "priorityReasons": reasons[:3],
        }))

    ranked.sort(key=lambda item: (-item[0], str(item[2].get("lastTime") or item[1].get("updatedAt") or ""), str(item[1].get("id") or "")))
    result: list[dict[str, Any]] = []
    for score, error, behavior in ranked[:limit]:
        result.append(summarize_error(error) | {"practiceScore": score} | behavior)
    return result

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

def build_local_diagnosis(errors: list[dict[str, Any]]) -> dict[str, Any]:
    reason_counts: dict[str, int] = {}
    subtype_counts: dict[str, int] = {}
    for error in errors:
        reason = clean_short_text(error.get("rootReason"), 80)
        subtype = clean_short_text(error.get("subtype"), 40)
        if reason:
            reason_counts[reason] = reason_counts.get(reason, 0) + 1
        if subtype:
            subtype_counts[subtype] = subtype_counts.get(subtype, 0) + 1
    top_reasons = sorted(reason_counts.items(), key=lambda item: (-item[1], item[0]))[:5]
    top_subtypes = sorted(subtype_counts.items(), key=lambda item: (-item[1], item[0]))[:5]
    summary_parts = []
    if top_reasons:
        summary_parts.append("高频根因：" + "；".join(f"{name}({count})" for name, count in top_reasons))
    if top_subtypes:
        summary_parts.append("高频题型：" + "；".join(f"{name}({count})" for name, count in top_subtypes))
    weak_points = [
        {
            "area": name,
            "description": f"最近累计出现 {count} 次，建议优先复盘同类题目的分析与正确思路。",
            "priority": "high" if idx == 0 else "medium",
            "suggestion": "先做 3-5 题同类题，再回看错因和知识点笔记。",
        }
        for idx, (name, count) in enumerate(top_reasons[:3])
    ]
    return {
        "summary": "；".join(summary_parts) if summary_parts else "当前数据量较少，建议继续积累错题后再做 AI 诊断。",
        "weakPoints": weak_points,
        "model": "local-fallback",
    }

def build_local_diagnosis_safe(errors: list[dict[str, Any]]) -> dict[str, Any]:
    reason_counts: dict[str, int] = {}
    subtype_counts: dict[str, int] = {}
    for error in errors:
        reason = clean_short_text(error.get("rootReason"), 80)
        subtype = clean_short_text(error.get("subtype"), 40)
        if reason:
            reason_counts[reason] = reason_counts.get(reason, 0) + 1
        if subtype:
            subtype_counts[subtype] = subtype_counts.get(subtype, 0) + 1
    top_reasons = sorted(reason_counts.items(), key=lambda item: (-item[1], item[0]))[:5]
    top_subtypes = sorted(subtype_counts.items(), key=lambda item: (-item[1], item[0]))[:5]
    summary_parts = []
    if top_reasons:
        summary_parts.append("Top root causes: " + ", ".join(f"{name}({count})" for name, count in top_reasons))
    if top_subtypes:
        summary_parts.append("Top question types: " + ", ".join(f"{name}({count})" for name, count in top_subtypes))
    weak_points = [
        {
            "area": name,
            "description": f"Seen {count} times recently. Review similar mistakes and the correct solving path first.",
            "priority": "high" if idx == 0 else "medium",
            "suggestion": "Practice 3-5 similar questions, then revisit the mistake reason and note.",
        }
        for idx, (name, count) in enumerate(top_reasons[:3])
    ]
    return {
        "summary": " | ".join(summary_parts) if summary_parts else "Not enough data yet. Add more mistakes and run diagnosis again.",
        "weakPoints": weak_points,
        "model": "local-fallback",
    }
