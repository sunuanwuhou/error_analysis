from __future__ import annotations

import hashlib
import json
import os
import re
import secrets
import sqlite3
import urllib.error
import urllib.request
import uuid
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Cookie, File, HTTPException, Query, Request, Response, UploadFile
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse

from app.config import (
    HTML_PATH,
    IMAGES_DIR,
    LOGIN_HTML_PATH,
    RUNTIME_MODE,
    SELF_SERVICE_REGISTRATION_ENABLED,
    SESSION_COOKIE,
    SESSION_TTL_DAYS,
    SHENLUN_HTML_PATH,
)
from app.core import *
from app.database import get_conn
from app.runtime import build_runtime_label, infer_request_origin, read_tunnel_url, request_is_secure
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
from app.security import clear_session, create_user_account, get_user_by_token, issue_session, utcnow, verify_password

router = APIRouter()


@router.post("/api/ai/analyze-entry")
def analyze_entry(payload: AnalyzeEntryPayload, xingce_session: Optional[str] = Cookie(default=None)) -> dict[str, Any]:
    require_user(xingce_session)
    return {"ok": True, "result": call_analyze_entry(payload)}

@router.post("/api/ai/ocr-image")
async def ocr_image(
    file: UploadFile = File(...),
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    require_user(xingce_session)
    image_bytes = await file.read()
    result = run_ocr_bytes(image_bytes)
    return {
        "ok": True,
        "filename": file.filename or "",
        "contentType": (file.content_type or "").strip(),
        "result": result,
    }

@router.post("/api/ai/evaluate-answer")
def evaluate_answer(
    payload: EvaluateAnswerPayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    require_user(xingce_session)
    messages = [
        {
            "role": "system",
            "content": (
                "Evaluate whether the learner answered correctly. "
                "Return JSON only with keys: isCorrect, analysis, thoughtProcess, masteryUpdate. "
                "masteryUpdate must be one of not_mastered, fuzzy, mastered."
            ),
        },
        {
            "role": "user",
            "content": json.dumps(payload.dict(), ensure_ascii=False),
        },
    ]
    content, model = call_ai(messages, task_type="evaluate_answer", temperature=0.1, max_tokens=800)
    parsed = extract_json_object(content)
    result = {
        "isCorrect": bool(parsed.get("isCorrect")),
        "analysis": clean_multiline_text(parsed.get("analysis"), 240),
        "thoughtProcess": clean_multiline_text(parsed.get("thoughtProcess"), 240),
        "masteryUpdate": clean_short_text(parsed.get("masteryUpdate") or "fuzzy", 20),
        "model": model,
    }
    if result["masteryUpdate"] not in {"not_mastered", "fuzzy", "mastered"}:
        result["masteryUpdate"] = "fuzzy"
    return {"ok": True, "result": result}

@router.post("/api/ai/generate-question")
def generate_question(
    payload: GenerateQuestionPayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    require_user(xingce_session)
    messages = [
        {
            "role": "system",
            "content": (
                "你是公务员行测出题专家。根据提供的知识点和参考错题，出原创练习题。"
                "只返回JSON数组，每项包含：question（题干）、options（选项，用|分隔，如A.xxx|B.xxx|C.xxx|D.xxx）、"
                "answer（正确答案字母，如B）、analysis（解析，先给解题思路再给正确答案原因，100字内）。"
                "难度比参考错题高一档，考查同一能力短板，不要重复参考题的内容。"
                "只返回JSON数组，不要任何其他文字。"
            ),
        },
        {
            "role": "user",
            "content": json.dumps(payload.dict(), ensure_ascii=False),
        },
    ]
    content, model = call_ai(messages, task_type="generate_question", temperature=0.7, max_tokens=1200)
    parsed = extract_json_value(content)
    if not isinstance(parsed, list):
        parsed = parsed.get("items") if isinstance(parsed, dict) else []
    items = []
    for item in parsed[: payload.count]:
        if not isinstance(item, dict):
            continue
        items.append(
            {
                "question": clean_multiline_text(item.get("question"), 400),
                "options": clean_multiline_text(item.get("options"), 400),
                "answer": clean_short_text(item.get("answer"), 40),
                "analysis": clean_multiline_text(item.get("analysis"), 220),
            }
        )
    return {"ok": True, "items": items, "model": model}

@router.post("/api/ai/diagnose")
def diagnose(
    payload: DiscoverPatternsPayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    errors = payload.errors or get_backup_errors(user["id"])
    if not errors:
        return {"ok": True, "result": build_local_diagnosis_safe([])}
    condensed = [summarize_error(item) for item in errors[:120]]
    messages = [
        {
            "role": "system",
            "content": (
                "你是公务员行测学习诊断专家。分析用户错题数据，找出真实短板。"
                "只返回JSON，格式：{summary: string, weakPoints: [{area, description, priority, suggestion}]}。"
                "summary：100字内，直接说最需要攻克的2-3个问题，数据支撑。"
                "weakPoints最多5条，每条：area=弱点名称，description=具体表现（引用数据），"
                "priority=high/medium，suggestion=本周可执行的具体行动（1-2句话）。"
                "不要废话，不要鼓励，只给诊断和行动。"
            ),
        },
        {"role": "user", "content": json.dumps({"errors": condensed}, ensure_ascii=False)},
    ]
    try:
        content, model = call_ai(messages, task_type="diagnose", temperature=0.1, max_tokens=1400)
        parsed = extract_json_object(content)
        weak_points = parsed.get("weakPoints") if isinstance(parsed.get("weakPoints"), list) else []
        return {
            "ok": True,
            "result": {
                "summary": clean_multiline_text(parsed.get("summary"), 600),
                "weakPoints": [
                    {
                        "area": clean_short_text(item.get("area"), 60),
                        "description": clean_multiline_text(item.get("description"), 180),
                        "priority": clean_short_text(item.get("priority"), 20),
                        "suggestion": clean_multiline_text(item.get("suggestion"), 180),
                    }
                    for item in weak_points[:10]
                    if isinstance(item, dict)
                ],
                "model": model,
            },
        }
    except Exception:
        return {"ok": True, "result": build_local_diagnosis_safe(errors)}

@router.post("/api/ai/chat")
def ai_chat(
    payload: ChatPayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    errors = get_backup_errors(user["id"])
    backup = load_backup_payload(user["id"])
    tree = flatten_knowledge_tree(backup.get("knowledgeTree") or [])
    context = {
        "errorCount": len(errors),
        "topRootReasons": {},
        "knowledgeNodes": [{"title": item["title"], "path": item["path"]} for item in tree[:40]],
    }
    for error in errors:
        reason = clean_short_text(error.get("rootReason"), 80)
        if reason:
            context["topRootReasons"][reason] = context["topRootReasons"].get(reason, 0) + 1
    top_roots = sorted(context["topRootReasons"].items(), key=lambda item: (-item[1], item[0]))[:8]
    # 取最近20条错题做上下文（只要关键字段）
    recent_errors = sorted(
        errors,
        key=lambda e: str(e.get("updatedAt") or e.get("addDate") or ""),
        reverse=True,
    )[:20]
    error_snippets = [
        {
            "type": e.get("type", ""),
            "subtype": e.get("subtype", ""),
            "rootReason": clean_short_text(e.get("rootReason"), 60),
            "errorReason": clean_short_text(e.get("errorReason"), 30),
            "status": e.get("status", ""),
            "question": clean_multiline_text(e.get("question"), 80),
        }
        for e in recent_errors
        if e.get("rootReason")
    ]
    messages = [
        {
            "role": "system",
            "content": (
                "你是公务员行测备考助手，用中文回答，简洁直接，300字以内。"
                "你能看到用户的真实错题数据（rootReason=深层原因，errorReason=表象原因，status=复习状态）。"
                "回答要基于数据，给出可操作的具体建议，不要泛泛而谈。"
                "格式：直接给结论，再给1-3个具体行动，不要废话。"
            ),
        },
        {
            "role": "user",
            "content": json.dumps(
                {
                    "总错题数": context["errorCount"],
                    "高频根因top8": top_roots,
                    "最近20条错题": error_snippets,
                    "知识节点": [item["title"] for item in tree[:20]],
                    "对话历史": payload.history[-4:],
                    "我的问题": payload.message,
                },
                ensure_ascii=False,
            ),
        },
    ]
    content, model = call_ai(messages, task_type="chat", temperature=0.3, max_tokens=1200)
    return {"ok": True, "reply": clean_multiline_text(content, 2000), "model": model}

@router.post("/api/ai/module-summary-for-claude")
def module_summary_for_claude(
    payload: ModuleSummaryPayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    filtered = filter_errors(get_backup_errors(user["id"]), payload)
    summary_input = [summarize_error(item) for item in filtered]
    messages = [
        {
            "role": "system",
            "content": (
                "Compress the module data for handoff into Claude. "
                "Return JSON only with keys: overview, weaknessTags, recommendedPrompt, items."
            ),
        },
        {"role": "user", "content": json.dumps({"errors": summary_input}, ensure_ascii=False)},
    ]
    content, model = call_ai(messages, task_type="chat", temperature=0.2, max_tokens=1400)
    parsed = extract_json_object(content)
    return {
        "ok": True,
        "result": {
            "overview": clean_multiline_text(parsed.get("overview"), 800),
            "weaknessTags": parsed.get("weaknessTags") if isinstance(parsed.get("weaknessTags"), list) else [],
            "recommendedPrompt": clean_multiline_text(parsed.get("recommendedPrompt"), 1200),
            "items": summary_input[: min(len(summary_input), payload.limit)],
            "model": model,
        },
    }

@router.post("/api/ai/distill-to-node")
def distill_to_node(
    payload: DistillPayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    require_user(xingce_session)
    messages = [
        {
            "role": "system",
            "content": (
                "Distill one reusable rule from the error. "
                "Return JSON only with keys: rule, shouldAppend, reason."
            ),
        },
        {"role": "user", "content": json.dumps(payload.dict(), ensure_ascii=False)},
    ]
    content, model = call_ai(messages, task_type="distill_to_node", temperature=0.2, max_tokens=700)
    parsed = extract_json_object(content)
    return {
        "ok": True,
        "result": {
            "rule": clean_multiline_text(parsed.get("rule"), 160),
            "shouldAppend": bool(parsed.get("shouldAppend")),
            "reason": clean_multiline_text(parsed.get("reason"), 180),
            "model": model,
        },
    }

@router.post("/api/ai/synthesize-node")
def synthesize_node(
    payload: SynthesizeNodePayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    require_user(xingce_session)
    condensed = [summarize_error(item) for item in payload.linkedErrors[:80]]
    messages = [
        {
            "role": "system",
            "content": (
                "Summarize the knowledge node from the linked errors. "
                "Return JSON only with keys: summary, pitfalls, drills."
            ),
        },
        {
            "role": "user",
            "content": json.dumps(
                {
                    "nodeTitle": payload.nodeTitle,
                    "nodeContent": payload.nodeContent,
                    "linkedErrors": condensed,
                },
                ensure_ascii=False,
            ),
        },
    ]
    content, model = call_ai(messages, task_type="synthesize_node", temperature=0.2, max_tokens=1200)
    parsed = extract_json_object(content)
    return {"ok": True, "result": parsed | {"model": model}}

@router.post("/api/ai/discover-patterns")
def discover_patterns(
    payload: DiscoverPatternsPayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    errors = payload.errors or get_backup_errors(user["id"])
    condensed = [summarize_error(item) for item in errors[:120]]
    messages = [
        {
            "role": "system",
            "content": (
                "Find cross-topic learning patterns. "
                "Return JSON only with keys: summary and patterns. "
                "patterns must be an array of {theme, evidence, impact, suggestion}."
            ),
        },
        {"role": "user", "content": json.dumps({"errors": condensed}, ensure_ascii=False)},
    ]
    content, model = call_ai(messages, task_type="discover_patterns", temperature=0.15, max_tokens=1400)
    parsed = extract_json_object(content)
    return {"ok": True, "result": parsed | {"model": model}}

@router.post("/api/ai/suggest-restructure")
def suggest_restructure(
    payload: SuggestRestructurePayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    require_user(xingce_session)
    tree = flatten_knowledge_tree(payload.tree or [])
    messages = [
        {
            "role": "system",
            "content": (
                "Review the knowledge tree structure. "
                "Return JSON only with keys: summary and suggestions. "
                "suggestions must be an array of {action, target, reason}."
            ),
        },
        {"role": "user", "content": json.dumps({"tree": tree[:200]}, ensure_ascii=False)},
    ]
    content, model = call_ai(messages, task_type="suggest_restructure", temperature=0.2, max_tokens=1200)
    parsed = extract_json_object(content)
    return {"ok": True, "result": parsed | {"model": model}}
