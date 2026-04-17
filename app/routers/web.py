from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Cookie, Request, Response
from fastapi.responses import FileResponse, RedirectResponse

from app.config import (
    FRONTEND_DIST_INDEX_PATH,
    LOGIN_HTML_PATH,
    NEW_FRONTEND_ENABLED,
    RUNTIME_MODE,
    SESSION_COOKIE,
    SHENLUN_HTML_PATH,
    V51_INDEX_PATH,
)
from app.runtime import build_runtime_label, infer_request_origin, read_tunnel_url
from app.security import get_user_by_token, utcnow

router = APIRouter()

def _redirect_login_with_cookie_cleanup() -> Response:
    response = RedirectResponse(url="/login", status_code=302)
    response.delete_cookie(SESSION_COOKIE, path="/")
    return response


def _new_frontend_ready() -> bool:
    return NEW_FRONTEND_ENABLED and FRONTEND_DIST_INDEX_PATH.exists()


def _serve_new_frontend_or_fallback() -> Response:
    if _new_frontend_ready():
        return FileResponse(
            FRONTEND_DIST_INDEX_PATH,
            headers={
                "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
                "Pragma": "no-cache",
                "Expires": "0",
            },
        )
    return RedirectResponse(url="/", status_code=302)


@router.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "time": utcnow().isoformat()}

@router.get("/")
def root(xingce_session: Optional[str] = Cookie(default=None)) -> Response:
    user = get_user_by_token(xingce_session)
    if not user:
        return _redirect_login_with_cookie_cleanup()
    return FileResponse(
        V51_INDEX_PATH,
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )

@router.get("/legacy")
def legacy_root() -> Response:
    # Legacy entry is soft-deprecated; keep URL but route to the active shell.
    return RedirectResponse(url="/", status_code=302)

@router.get("/shenlun")
def shenlun_root(xingce_session: Optional[str] = Cookie(default=None)) -> Response:
    user = get_user_by_token(xingce_session)
    if not user:
        return _redirect_login_with_cookie_cleanup()
    return FileResponse(
        SHENLUN_HTML_PATH,
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )

@router.get("/v51")
@router.get("/v53")
def new_frontend_root(xingce_session: Optional[str] = Cookie(default=None)) -> Response:
    user = get_user_by_token(xingce_session)
    if not user:
        return _redirect_login_with_cookie_cleanup()
    return RedirectResponse(url="/", status_code=302)

@router.get("/v51/{path:path}")
@router.get("/v53/{path:path}")
def new_frontend_spa(path: str, xingce_session: Optional[str] = Cookie(default=None)) -> Response:
    user = get_user_by_token(xingce_session)
    if not user:
        return _redirect_login_with_cookie_cleanup()
    return RedirectResponse(url="/", status_code=302)


@router.get("/new")
def migration_frontend_root(xingce_session: Optional[str] = Cookie(default=None)) -> Response:
    user = get_user_by_token(xingce_session)
    if not user:
        return _redirect_login_with_cookie_cleanup()
    return _serve_new_frontend_or_fallback()


@router.get("/new/{path:path}")
def migration_frontend_spa(path: str, xingce_session: Optional[str] = Cookie(default=None)) -> Response:
    user = get_user_by_token(xingce_session)
    if not user:
        return _redirect_login_with_cookie_cleanup()
    return _serve_new_frontend_or_fallback()

@router.get("/login")
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

@router.get("/api/public-entry")
def public_entry(request: Request) -> dict[str, Any]:
    return {
        "origin": infer_request_origin(request),
        "tunnelUrl": read_tunnel_url(),
    }

@router.get("/api/runtime-info")
def runtime_info(request: Request) -> dict[str, Any]:
    return {
        "mode": RUNTIME_MODE,
        "label": build_runtime_label(request),
        "origin": infer_request_origin(request),
    }
