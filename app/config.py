from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "xingce.db"
IMAGES_DIR = DATA_DIR / "images"
HTML_PATH = BASE_DIR / "xingce_v3" / "xingce_v3.html"
V51_DIR = BASE_DIR / "v51_frontend"
V51_INDEX_PATH = V51_DIR / "index.html"
V51_STATIC_DIR = V51_DIR
SHENLUN_HTML_PATH = BASE_DIR / "xingce_v3" / "shenlun.html"
LOGIN_HTML_PATH = BASE_DIR / "app" / "login.html"
RUNTIME_DIR = BASE_DIR / "runtime"
TUNNEL_LOG_PATH = RUNTIME_DIR / "cloudflared.log"
SESSION_COOKIE = "xingce_session"
SESSION_TTL_DAYS = 30
SELF_SERVICE_REGISTRATION_ENABLED = os.getenv("SELF_SERVICE_REGISTRATION_ENABLED", "").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}
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
OCR_MAX_BYTES = 5 * 1024 * 1024
RUNTIME_MODE = os.getenv("XINGCE_RUNTIME_MODE", "").strip().lower() or "local"
RUNTIME_LABEL = os.getenv("XINGCE_RUNTIME_LABEL", "").strip() or (
    "Docker App" if RUNTIME_MODE == "docker" else "Local Python"
)
