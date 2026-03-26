from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import urllib.error
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional

from fastapi import Cookie, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "xingce.db"
IMAGES_DIR = DATA_DIR / "images"
HTML_PATH = BASE_DIR / "xingce_v3" / "xingce_v3.html"
LOGIN_HTML_PATH = BASE_DIR / "app" / "login.html"
RUNTIME_DIR = BASE_DIR / "runtime"
TUNNEL_LOG_PATH = RUNTIME_DIR / "cloudflared.log"
SESSION_COOKIE = "xingce_session"
SESSION_TTL_DAYS = 30
MINIMAX_API_URL = "https://api.minimaxi.com/v1/text/chatcompletion_v2"
DEFAULT_MINIMAX_MODEL = "MiniMax-M2.5"
DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"
DEEPSEEK_CHAT_MODEL = "deepseek-chat"
DEEPSEEK_REASONER_MODEL = "deepseek-reasoner"
TASK_ROUTING: dict[str, str] = {
    "analyze_entry": DEEPSEEK_CHAT_MODEL,
    "distill_to_node": DEEPSEEK_CHAT_MODEL,
    "synthesize_node": DEEPSEEK_CHAT_MODEL,
    "generate_question": DEEPSEEK_CHAT_MODEL,
    "suggest_restructure": DEEPSEEK_CHAT_MODEL,
    "chat": DEEPSEEK_CHAT_MODEL,
    "evaluate_answer": DEEPSEEK_REASONER_MODEL,
    "discover_patterns": DEEPSEEK_REASONER_MODEL,
    "diagnose": DEEPSEEK_REASONER_MODEL,
}
JSON_RESPONSE_TASKS = {
    "analyze_entry",
    "distill_to_node",
    "synthesize_node",
    "generate_question",
    "suggest_restructure",
    "evaluate_answer",
    "discover_patterns",
    "diagnose",
}
ALLOWED_ENTRY_TYPES = {
    "言语理解与表达",
    "数量关系",
    "判断推理",
    "资料分析",
    "常识判断",
    "其他",
}


def utcnow() -> datetime:
    return datetime.utcnow()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
    return base64.b64encode(salt + digest).decode("ascii")


def verify_password(password: str, encoded: str) -> bool:
    raw = base64.b64decode(encoded.encode("ascii"))
    salt, expected = raw[:16], raw[16:]
    actual = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
    return hmac.compare_digest(actual, expected)


def get_conn() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
              id TEXT PRIMARY KEY,
              username TEXT NOT NULL UNIQUE,
              password_hash TEXT NOT NULL,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
              token TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              expires_at TEXT NOT NULL,
              created_at TEXT NOT NULL,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS user_backups (
              user_id TEXT PRIMARY KEY,
              payload_json TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS user_origin_status (
              user_id TEXT NOT NULL,
              origin TEXT NOT NULL,
              last_local_change_at TEXT NOT NULL DEFAULT '',
              last_loaded_at TEXT NOT NULL DEFAULT '',
              last_saved_at TEXT NOT NULL DEFAULT '',
              last_backup_updated_at TEXT NOT NULL DEFAULT '',
              updated_at TEXT NOT NULL,
              PRIMARY KEY (user_id, origin),
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS user_images (
              hash TEXT NOT NULL,
              user_id TEXT NOT NULL,
              content_type TEXT NOT NULL DEFAULT 'image/jpeg',
              size_bytes INTEGER NOT NULL DEFAULT 0,
              ref_count INTEGER NOT NULL DEFAULT 1,
              created_at TEXT NOT NULL,
              PRIMARY KEY (hash, user_id),
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS operations (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              op_type TEXT NOT NULL,
              entity_id TEXT NOT NULL,
              payload TEXT NOT NULL,
              created_at TEXT NOT NULL,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_ops_user_time
              ON operations(user_id, created_at);

            CREATE TABLE IF NOT EXISTS practice_log (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              date TEXT NOT NULL,
              mode TEXT NOT NULL,
              weakness_tag TEXT NOT NULL DEFAULT '',
              total INTEGER NOT NULL DEFAULT 0,
              correct INTEGER NOT NULL DEFAULT 0,
              error_ids TEXT NOT NULL DEFAULT '[]',
              created_at TEXT NOT NULL,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_plog_user_date
              ON practice_log(user_id, date);
            """
        )


def get_user_by_token(token: Optional[str]) -> Optional[dict[str, Any]]:
    if not token:
        return None

    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT u.id, u.username, s.expires_at
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token = ?
            """,
            (token,),
        ).fetchone()

        if not row:
            return None

        expires_at = datetime.fromisoformat(row["expires_at"])
        if expires_at <= utcnow():
            conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
            conn.commit()
            return None

        return {"id": row["id"], "username": row["username"]}


def issue_session(user_id: str) -> tuple[str, str]:
    token = secrets.token_urlsafe(32)
    expires_at = utcnow() + timedelta(days=SESSION_TTL_DAYS)
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO sessions(token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
            (token, user_id, expires_at.isoformat(), utcnow().isoformat()),
        )
        conn.commit()
    return token, expires_at.isoformat()


def clear_session(token: Optional[str]) -> None:
    if not token:
        return
    with get_conn() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()


def normalize_origin(value: str) -> str:
    return value.rstrip("/")


def infer_request_origin(request: Request) -> str:
    forwarded_proto = request.headers.get("x-forwarded-proto")
    forwarded_host = request.headers.get("x-forwarded-host")
    host = forwarded_host or request.headers.get("host") or ""
    scheme = forwarded_proto or request.url.scheme
    return normalize_origin(f"{scheme}://{host}")


def read_tunnel_url() -> Optional[str]:
    if not TUNNEL_LOG_PATH.exists():
      return None
    try:
        text = TUNNEL_LOG_PATH.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None

    matches = re.findall(r"https://[a-z0-9-]+\.trycloudflare\.com", text)
    return matches[-1] if matches else None


class AuthPayload(BaseModel):
    username: str = Field(min_length=2, max_length=32)
    password: str = Field(min_length=6, max_length=128)


class BackupPayload(BaseModel):
    xc_version: int = 2
    exportTime: Optional[str] = None
    baseUpdatedAt: Optional[str] = None
    forceOverwrite: bool = False
    errors: list[dict[str, Any]] = Field(default_factory=list)
    notesByType: dict[str, Any] = Field(default_factory=dict)
    noteImages: dict[str, Any] = Field(default_factory=dict)
    typeRules: Any = None
    dirTree: Any = None
    globalNote: str = ""
    knowledgeTree: Any = None
    knowledgeNotes: dict[str, Any] = Field(default_factory=dict)


class OriginStatusPayload(BaseModel):
    localChangedAt: Optional[str] = None
    lastLoadedAt: Optional[str] = None
    lastSavedAt: Optional[str] = None
    lastBackupUpdatedAt: Optional[str] = None


class AnalyzeEntryPayload(BaseModel):
    type: str = ""
    subtype: str = ""
    subSubtype: str = ""
    question: str = ""
    options: str = ""
    answer: str = ""
    myAnswer: str = ""
    rootReason: str = ""
    errorReason: str = ""
    analysis: str = ""
    availableSubtypes: list[str] = Field(default_factory=list)
    availableSubSubtypes: list[str] = Field(default_factory=list)


class SyncPushPayload(BaseModel):
    ops: list[dict[str, Any]] = Field(default_factory=list)


class EvaluateAnswerPayload(BaseModel):
    question: str = ""
    options: str = ""
    correctAnswer: str = ""
    myAnswer: str = ""
    originalErrorReason: str = ""
    rootReason: str = ""


class GenerateQuestionPayload(BaseModel):
    nodeTitle: str = ""
    nodeSummary: str = ""
    referenceError: dict[str, Any] = Field(default_factory=dict)
    count: int = Field(default=1, ge=1, le=5)


class PracticeLogPayload(BaseModel):
    date: str
    mode: str
    weaknessTag: str = ""
    total: int = Field(ge=0)
    correct: int = Field(ge=0)
    errorIds: list[str] = Field(default_factory=list)


class ChatPayload(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: list[dict[str, str]] = Field(default_factory=list)


class ModuleSummaryPayload(BaseModel):
    type: str = ""
    subtype: str = ""
    rootReason: str = ""
    status: str = ""
    masteryLevel: str = ""
    dateFrom: str = ""
    dateTo: str = ""
    limit: int = Field(default=80, ge=10, le=200)


class DistillPayload(BaseModel):
    nodeTitle: str = ""
    nodeContent: str = ""
    error: dict[str, Any] = Field(default_factory=dict)


class SynthesizeNodePayload(BaseModel):
    nodeTitle: str = ""
    nodeContent: str = ""
    linkedErrors: list[dict[str, Any]] = Field(default_factory=list)


class DiscoverPatternsPayload(BaseModel):
    errors: list[dict[str, Any]] = Field(default_factory=list)


class SuggestRestructurePayload(BaseModel):
    tree: Any = None
    notes: dict[str, Any] = Field(default_factory=dict)


app = FastAPI(title="xingce_v3_lab")
_raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://127.0.0.1:8000,http://localhost:8000",
)
ALLOWED_ORIGINS = [origin.strip() for origin in _raw_origins.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)
app.mount("/assets", StaticFiles(directory=str(BASE_DIR / "xingce_v3")), name="assets")


@app.middleware("http")
async def disable_static_cache_for_local_debug(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path or ""
    if path == "/" or path == "/login" or path.startswith("/assets/"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response


@app.on_event("startup")
def on_startup() -> None:
    init_db()


def json_error(message: str, status_code: int) -> JSONResponse:
    return JSONResponse({"error": message}, status_code=status_code)


def require_user(token: Optional[str]) -> dict[str, Any]:
    user = get_user_by_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="unauthorized")
    return user


def upsert_origin_status(user_id: str, origin: str, **fields: str) -> None:
    origin = normalize_origin(origin or "")
    if not origin:
        return

    allowed = {
        "last_local_change_at",
        "last_loaded_at",
        "last_saved_at",
        "last_backup_updated_at",
    }
    payload = {key: value for key, value in fields.items() if key in allowed and value is not None}
    now = utcnow().isoformat()
    columns = ["user_id", "origin", "updated_at", *payload.keys()]
    values = [user_id, origin, now, *payload.values()]
    updates = ["updated_at = excluded.updated_at", *[f"{key} = excluded.{key}" for key in payload.keys()]]

    with get_conn() as conn:
        conn.execute(
            f"""
            INSERT INTO user_origin_status({", ".join(columns)})
            VALUES ({", ".join("?" for _ in columns)})
            ON CONFLICT(user_id, origin) DO UPDATE SET
              {", ".join(updates)}
            """,
            values,
        )
        conn.commit()


def list_origin_statuses(user_id: str) -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT origin, last_local_change_at, last_loaded_at, last_saved_at,
                   last_backup_updated_at, updated_at
            FROM user_origin_status
            WHERE user_id = ?
            ORDER BY updated_at DESC, origin ASC
            """,
            (user_id,),
        ).fetchall()
    return [
        {
            "origin": row["origin"],
            "lastLocalChangeAt": row["last_local_change_at"],
            "lastLoadedAt": row["last_loaded_at"],
            "lastSavedAt": row["last_saved_at"],
            "lastBackupUpdatedAt": row["last_backup_updated_at"],
            "updatedAt": row["updated_at"],
        }
        for row in rows
    ]


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


def cleanup_old_ops(user_id: str, conn: sqlite3.Connection) -> None:
    conn.execute(
        "DELETE FROM operations WHERE user_id = ? AND created_at < datetime('now', '-30 days')",
        (user_id,),
    )


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


def load_backup_payload(user_id: str) -> dict[str, Any]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT payload_json FROM user_backups WHERE user_id = ?",
            (user_id,),
        ).fetchone()
    if not row:
        return {}
    try:
        data = json.loads(row["payload_json"])
        return data if isinstance(data, dict) else {}
    except json.JSONDecodeError:
        return {}


def save_backup_payload(user_id: str, payload: dict[str, Any]) -> None:
    updated_at = utcnow().isoformat()
    body = dict(payload or {})
    body["exportTime"] = body.get("exportTime") or updated_at
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO user_backups(user_id, payload_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              payload_json = excluded.payload_json,
              updated_at = excluded.updated_at
            """,
            (user_id, json.dumps(body, ensure_ascii=False), updated_at),
        )
        conn.commit()


def get_backup_errors(user_id: str) -> list[dict[str, Any]]:
    payload = load_backup_payload(user_id)
    errors = payload.get("errors") or []
    return [item for item in errors if isinstance(item, dict)]


def flatten_knowledge_tree(nodes: Any, path: Optional[list[str]] = None) -> list[dict[str, Any]]:
    path = path or []
    if not isinstance(nodes, list):
        return []
    flat: list[dict[str, Any]] = []
    for node in nodes:
        if not isinstance(node, dict):
            continue
        title = str(node.get("title") or "").strip()
        node_id = str(node.get("id") or "").strip()
        current_path = [*path, title] if title else list(path)
        flat.append(
            {
                "id": node_id,
                "title": title,
                "path": current_path,
                "contentMd": str(node.get("contentMd") or ""),
                "isLeaf": bool(node.get("isLeaf")),
                "childCount": len(node.get("children") or []),
            }
        )
        flat.extend(flatten_knowledge_tree(node.get("children") or [], current_path))
    return flat


def summarize_error(error: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(error.get("id") or ""),
        "type": str(error.get("type") or ""),
        "subtype": str(error.get("subtype") or ""),
        "subSubtype": str(error.get("subSubtype") or ""),
        "question": clean_multiline_text(error.get("question"), 280),
        "answer": clean_short_text(error.get("answer"), 20),
        "myAnswer": clean_short_text(error.get("myAnswer"), 20),
        "status": clean_short_text(error.get("status"), 20),
        "difficulty": int(error.get("difficulty") or 2),
        "errorReason": clean_short_text(error.get("errorReason"), 40),
        "rootReason": clean_short_text(error.get("rootReason"), 80),
        "analysis": clean_multiline_text(error.get("analysis"), 320),
        "masteryLevel": clean_short_text(error.get("masteryLevel"), 30),
        "updatedAt": clean_short_text(error.get("updatedAt") or error.get("addDate"), 40),
        "noteNodeId": clean_short_text(error.get("noteNodeId"), 60),
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


def compute_daily_practice(errors: list[dict[str, Any]], limit: int = 12) -> list[dict[str, Any]]:
    now = utcnow().date()
    ranked: list[tuple[int, dict[str, Any]]] = []
    for error in errors:
        answer = str(error.get("answer") or "").strip()
        if not answer:
            continue
        score = 0
        mastery = str(error.get("masteryLevel") or "not_mastered")
        if mastery == "not_mastered":
            score += 30
        elif mastery == "fuzzy":
            score += 20
        elif mastery == "mastered":
            score += 8
        status = str(error.get("status") or "")
        if status == "focus":
            score += 18
        elif status == "review":
            score += 10
        try:
            date_text = str(error.get("lastPracticedAt") or error.get("updatedAt") or error.get("addDate") or "")[:10]
            if date_text:
                delta = (now - datetime.fromisoformat(date_text).date()).days
                score += min(max(delta, 0), 20)
        except ValueError:
            score += 5
        if str(error.get("addDate") or "")[:10]:
            try:
                recent = (now - datetime.fromisoformat(str(error.get("addDate"))[:10]).date()).days
                if recent <= 7:
                    score += 10
            except ValueError:
                pass
        ranked.append((score, error))
    ranked.sort(key=lambda item: (-item[0], str(item[1].get("updatedAt") or ""), str(item[1].get("id") or "")))
    return [summarize_error(error) | {"practiceScore": score} for score, error in ranked[:limit]]


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


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "time": utcnow().isoformat()}


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


@app.get("/")
def root(xingce_session: Optional[str] = Cookie(default=None)) -> Response:
    user = get_user_by_token(xingce_session)
    if not user:
        return RedirectResponse(url="/login", status_code=302)
    return FileResponse(
        HTML_PATH,
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


@app.get("/login")
def login_page(request: Request, xingce_session: Optional[str] = Cookie(default=None)) -> Response:
    user = get_user_by_token(xingce_session)
    if user:
        return RedirectResponse(url="/", status_code=302)
    return FileResponse(
        LOGIN_HTML_PATH,
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


@app.get("/api/public-entry")
def public_entry(request: Request) -> dict[str, Any]:
    return {
        "origin": infer_request_origin(request),
        "tunnelUrl": read_tunnel_url(),
    }


@app.post("/api/auth/register")
def register(payload: AuthPayload, response: Response) -> dict[str, Any]:
    user_id = secrets.token_hex(12)
    with get_conn() as conn:
        existing = conn.execute("SELECT id FROM users WHERE username = ?", (payload.username.strip(),)).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="username already exists")

        conn.execute(
            "INSERT INTO users(id, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
            (user_id, payload.username.strip(), hash_password(payload.password), utcnow().isoformat()),
        )
        conn.commit()

    token, _ = issue_session(user_id)
    response.set_cookie(
        SESSION_COOKIE,
        token,
        httponly=True,
        samesite="lax",
        max_age=SESSION_TTL_DAYS * 24 * 3600,
    )
    return {"ok": True, "user": {"id": user_id, "username": payload.username.strip()}}


@app.post("/api/auth/login")
def login(payload: AuthPayload, response: Response) -> dict[str, Any]:
    with get_conn() as conn:
        user = conn.execute(
            "SELECT id, username, password_hash FROM users WHERE username = ?",
            (payload.username.strip(),),
        ).fetchone()
        if not user or not verify_password(payload.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="invalid credentials")

    token, _ = issue_session(user["id"])
    response.set_cookie(
        SESSION_COOKIE,
        token,
        httponly=True,
        samesite="lax",
        max_age=SESSION_TTL_DAYS * 24 * 3600,
    )
    return {"ok": True, "user": {"id": user["id"], "username": user["username"]}}


@app.post("/api/auth/logout")
def logout(response: Response, xingce_session: Optional[str] = Cookie(default=None)) -> dict[str, Any]:
    clear_session(xingce_session)
    response.delete_cookie(SESSION_COOKIE)
    return {"ok": True}


@app.get("/api/me")
def me(xingce_session: Optional[str] = Cookie(default=None)) -> dict[str, Any]:
    user = get_user_by_token(xingce_session)
    if not user:
        return {"authenticated": False}
    return {"authenticated": True, "user": user}


@app.get("/api/backup")
def get_backup(request: Request, xingce_session: Optional[str] = Cookie(default=None)) -> dict[str, Any]:
    user = require_user(xingce_session)
    current_origin = infer_request_origin(request)
    with get_conn() as conn:
        row = conn.execute(
            "SELECT payload_json, updated_at FROM user_backups WHERE user_id = ?",
            (user["id"],),
        ).fetchone()
    if not row:
        return {
            "exists": False,
            "currentOrigin": current_origin,
            "payload": None,
            "backup": None,
            "origins": list_origin_statuses(user["id"]),
        }
    backup = json.loads(row["payload_json"])
    return {
        "exists": True,
        "currentOrigin": current_origin,
        "updatedAt": row["updated_at"],
        "payload": backup,
        "backup": backup,
        "origins": list_origin_statuses(user["id"]),
    }


@app.put("/api/backup")
def put_backup(payload: BackupPayload, request: Request, xingce_session: Optional[str] = Cookie(default=None)) -> dict[str, Any]:
    user = require_user(xingce_session)
    current_origin = infer_request_origin(request)
    updated_at = utcnow().isoformat()
    body = payload.dict()
    if not body.get("exportTime"):
        body["exportTime"] = updated_at

    with get_conn() as conn:
        existing = conn.execute(
            "SELECT updated_at FROM user_backups WHERE user_id = ?",
            (user["id"],),
        ).fetchone()
        existing_updated_at = existing["updated_at"] if existing else ""
        base_updated_at = (payload.baseUpdatedAt or "").strip()

        if existing_updated_at and not payload.forceOverwrite:
            if not base_updated_at:
                return JSONResponse(
                    {
                        "error": "cloud backup changed; reload latest backup before saving",
                        "currentUpdatedAt": existing_updated_at,
                        "currentOrigin": current_origin,
                        "origins": list_origin_statuses(user["id"]),
                    },
                    status_code=409,
                )
            try:
                base_dt = datetime.fromisoformat(base_updated_at)
                existing_dt = datetime.fromisoformat(existing_updated_at)
            except ValueError:
                return JSONResponse(
                    {
                        "error": "cloud backup version is invalid; reload latest backup before saving",
                        "currentUpdatedAt": existing_updated_at,
                        "currentOrigin": current_origin,
                        "origins": list_origin_statuses(user["id"]),
                    },
                    status_code=409,
                )
            if existing_dt > base_dt:
                return JSONResponse(
                    {
                        "error": "cloud backup is newer than your local base version",
                        "currentUpdatedAt": existing_updated_at,
                        "currentOrigin": current_origin,
                        "origins": list_origin_statuses(user["id"]),
                    },
                    status_code=409,
                )

        conn.execute(
            """
            INSERT INTO user_backups(user_id, payload_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              payload_json = excluded.payload_json,
              updated_at = excluded.updated_at
            """,
            (user["id"], json.dumps(body, ensure_ascii=False), updated_at),
        )
        conn.commit()

    upsert_origin_status(
        user["id"],
        current_origin,
        last_local_change_at=updated_at,
        last_saved_at=updated_at,
        last_backup_updated_at=updated_at,
    )

    return {
        "ok": True,
        "updatedAt": updated_at,
        "currentOrigin": current_origin,
        "origins": list_origin_statuses(user["id"]),
    }


@app.post("/api/origin-status")
def put_origin_status(
    payload: OriginStatusPayload,
    request: Request,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    current_origin = infer_request_origin(request)
    upsert_origin_status(
        user["id"],
        current_origin,
        last_local_change_at=payload.localChangedAt,
        last_loaded_at=payload.lastLoadedAt,
        last_saved_at=payload.lastSavedAt,
        last_backup_updated_at=payload.lastBackupUpdatedAt,
    )
    return {
        "ok": True,
        "currentOrigin": current_origin,
        "origins": list_origin_statuses(user["id"]),
    }


@app.post("/api/ai/analyze-entry")
def analyze_entry(payload: AnalyzeEntryPayload, xingce_session: Optional[str] = Cookie(default=None)) -> dict[str, Any]:
    require_user(xingce_session)
    return {"ok": True, "result": call_analyze_entry(payload)}


@app.post("/api/images")
async def upload_image(
    request: Request,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    body = await request.body()
    if not body:
        raise HTTPException(status_code=400, detail="empty image body")
    if len(body) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="image too large (max 5MB)")

    content_type = request.headers.get("content-type", "image/jpeg").strip() or "image/jpeg"
    sha256 = hashlib.sha256(body).hexdigest()
    user_img_dir = IMAGES_DIR / user["id"]
    user_img_dir.mkdir(parents=True, exist_ok=True)
    img_path = user_img_dir / sha256
    if not img_path.exists():
        img_path.write_bytes(body)

    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO user_images(hash, user_id, content_type, size_bytes, ref_count, created_at)
            VALUES(?, ?, ?, ?, 1, ?)
            ON CONFLICT(hash, user_id) DO UPDATE SET
              ref_count = ref_count + 1,
              content_type = excluded.content_type,
              size_bytes = excluded.size_bytes
            """,
            (sha256, user["id"], content_type, len(body), utcnow().isoformat()),
        )
        conn.commit()

    return {"ok": True, "hash": sha256, "url": f"/api/images/{sha256}"}


@app.get("/api/images/{sha256}")
def get_image(
    sha256: str,
    xingce_session: Optional[str] = Cookie(default=None),
) -> Response:
    user = require_user(xingce_session)
    with get_conn() as conn:
        row = conn.execute(
            "SELECT content_type FROM user_images WHERE hash = ? AND user_id = ?",
            (sha256, user["id"]),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="image not found")

    img_path = IMAGES_DIR / user["id"] / sha256
    if not img_path.exists():
        raise HTTPException(status_code=404, detail="image file missing")

    return Response(
        content=img_path.read_bytes(),
        media_type=row["content_type"],
        headers={"Cache-Control": "max-age=31536000, immutable"},
    )


@app.delete("/api/images/{sha256}/unref")
def unref_image(
    sha256: str,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    img_path = IMAGES_DIR / user["id"] / sha256

    with get_conn() as conn:
        row = conn.execute(
            "SELECT ref_count FROM user_images WHERE hash = ? AND user_id = ?",
            (sha256, user["id"]),
        ).fetchone()
        if not row:
            return {"ok": True, "deleted": False}

        next_ref_count = row["ref_count"] - 1
        if next_ref_count <= 0:
            conn.execute(
                "DELETE FROM user_images WHERE hash = ? AND user_id = ?",
                (sha256, user["id"]),
            )
            if img_path.exists():
                img_path.unlink()
            deleted = True
        else:
            conn.execute(
                "UPDATE user_images SET ref_count = ? WHERE hash = ? AND user_id = ?",
                (next_ref_count, sha256, user["id"]),
            )
            deleted = False
        conn.commit()

    return {"ok": True, "deleted": deleted}


@app.get("/api/sync")
def sync_pull(
    since: str = "",
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT id, op_type, entity_id, payload, created_at
            FROM operations
            WHERE user_id = ? AND created_at > ?
            ORDER BY created_at ASC
            LIMIT 500
            """,
            (user["id"], since or ""),
        ).fetchall()
    return {
        "ops": [dict(row) for row in rows],
        "serverTime": utcnow().isoformat(),
        "hasMore": len(rows) == 500,
    }


@app.post("/api/sync")
def sync_push(
    body: SyncPushPayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    with get_conn() as conn:
        for op in body.ops:
            conn.execute(
                """
                INSERT OR IGNORE INTO operations(id, user_id, op_type, entity_id, payload, created_at)
                VALUES(?, ?, ?, ?, ?, ?)
                """,
                (
                    op["id"],
                    user["id"],
                    op["op_type"],
                    str(op["entity_id"]),
                    json.dumps(op.get("payload") or {}, ensure_ascii=False),
                    op["created_at"],
                ),
            )
        cleanup_old_ops(user["id"], conn)
        conn.commit()

    return {"ok": True, "serverTime": utcnow().isoformat()}


@app.post("/api/practice/log")
def create_practice_log(
    payload: PracticeLogPayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    entry = write_practice_log(user["id"], payload)
    return {"ok": True, "entry": entry, "recent": read_recent_practice_logs(user["id"], 14)}


@app.get("/api/practice/daily")
def get_practice_daily(
    limit: int = 12,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    errors = get_backup_errors(user["id"])
    queue = compute_daily_practice(errors, max(1, min(limit, 30)))
    return {"ok": True, "items": queue, "recentLogs": read_recent_practice_logs(user["id"], 14)}


@app.post("/api/ai/evaluate-answer")
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


@app.post("/api/ai/generate-question")
def generate_question(
    payload: GenerateQuestionPayload,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    require_user(xingce_session)
    messages = [
        {
            "role": "system",
            "content": (
                "Generate similar practice questions. "
                "Return JSON only as an array. "
                "Each item must contain question, options, answer, analysis."
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


@app.post("/api/ai/diagnose")
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
                "You are a study diagnosis assistant. "
                "Return JSON only with keys: summary and weakPoints. "
                "weakPoints must be an array of {area, description, priority, suggestion}."
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


@app.post("/api/ai/chat")
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
    messages = [
        {
            "role": "system",
            "content": (
                "You are a study copilot for a Chinese error-analysis notebook. "
                "Answer concisely, ground advice in the provided user data, and avoid invented claims."
            ),
        },
        {
            "role": "user",
            "content": json.dumps(
                {
                    "context": {
                        "errorCount": context["errorCount"],
                        "topRootReasons": top_roots,
                        "knowledgeNodes": context["knowledgeNodes"],
                    },
                    "history": payload.history[-6:],
                    "message": payload.message,
                },
                ensure_ascii=False,
            ),
        },
    ]
    content, model = call_ai(messages, task_type="chat", temperature=0.3, max_tokens=1200)
    return {"ok": True, "reply": clean_multiline_text(content, 2000), "model": model}


@app.post("/api/ai/module-summary-for-claude")
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


@app.post("/api/ai/distill-to-node")
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


@app.post("/api/ai/synthesize-node")
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


@app.post("/api/ai/discover-patterns")
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


@app.post("/api/ai/suggest-restructure")
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


@app.get("/api/knowledge/search")
def knowledge_search(
    q: str,
    limit: int = 10,
    xingce_session: Optional[str] = Cookie(default=None),
) -> dict[str, Any]:
    user = require_user(xingce_session)
    keyword = q.strip().lower()
    if not keyword:
        return {"ok": True, "nodes": [], "errors": []}
    payload = load_backup_payload(user["id"])
    nodes = flatten_knowledge_tree(payload.get("knowledgeTree") or [])
    node_hits = []
    for node in nodes:
        haystack = " ".join(
            [
                str(node.get("title") or ""),
                " / ".join(node.get("path") or []),
                str(node.get("contentMd") or ""),
            ]
        ).lower()
        if keyword in haystack:
            node_hits.append(
                {
                    "id": node["id"],
                    "title": node["title"],
                    "path": node["path"],
                    "excerpt": clean_multiline_text(node.get("contentMd"), 180),
                }
            )
            if len(node_hits) >= limit:
                break

    error_hits = []
    for error in get_backup_errors(user["id"]):
        haystack = " ".join(
            [
                str(error.get("question") or ""),
                str(error.get("analysis") or ""),
                str(error.get("rootReason") or ""),
                str(error.get("errorReason") or ""),
            ]
        ).lower()
        if keyword in haystack:
            error_hits.append(summarize_error(error))
            if len(error_hits) >= limit:
                break

    return {"ok": True, "nodes": node_hits, "errors": error_hits}
