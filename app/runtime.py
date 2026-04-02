from __future__ import annotations

import re
from typing import Optional

from fastapi import Request

from app.config import RUNTIME_LABEL, RUNTIME_MODE, TUNNEL_LOG_PATH


def normalize_origin(value: str) -> str:
    return value.rstrip("/")


def infer_request_origin(request: Request) -> str:
    forwarded_proto = request.headers.get("x-forwarded-proto")
    forwarded_host = request.headers.get("x-forwarded-host")
    host = forwarded_host or request.headers.get("host") or ""
    scheme = forwarded_proto or request.url.scheme
    return normalize_origin(f"{scheme}://{host}")


def request_is_secure(request: Request) -> bool:
    forwarded_proto = str(request.headers.get("x-forwarded-proto") or "").lower()
    if forwarded_proto:
        return forwarded_proto.split(",")[0].strip() == "https"
    return request.url.scheme == "https"


def build_runtime_label(request: Request) -> str:
    origin = infer_request_origin(request)
    if not origin:
        return RUNTIME_LABEL
    host = origin.split("://", 1)[-1]
    if RUNTIME_MODE == "docker":
        return f"Docker / {host}"
    if RUNTIME_MODE == "local":
        return f"Local / {host}"
    return f"{RUNTIME_MODE or 'Runtime'} / {host}"


def read_tunnel_url() -> Optional[str]:
    if not TUNNEL_LOG_PATH.exists():
        return None
    try:
        text = TUNNEL_LOG_PATH.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None

    matches = re.findall(r"https://[a-z0-9-]+\.trycloudflare\.com", text)
    return matches[-1] if matches else None
