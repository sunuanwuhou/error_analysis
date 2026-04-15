from __future__ import annotations

import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import BASE_DIR, V51_STATIC_DIR
from app.core import on_startup
from app.routers import ai, auth, backup, images, knowledge, practice, sync, web


def _parse_csv_env(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def create_app() -> FastAPI:
    app = FastAPI(title="xingce_v3_lab")
    environment = os.getenv("XINGCE_ENV", "development").strip().lower()
    runtime_mode = os.getenv("XINGCE_RUNTIME_MODE", "").strip().lower()
    is_production = environment in {"prod", "production"} or runtime_mode == "production"

    _raw_origins = os.getenv(
        "ALLOWED_ORIGINS",
        "https://erroranaly.qzz.io" if is_production else "http://127.0.0.1:8080,http://localhost:8080,http://127.0.0.1:8000,http://localhost:8000",
    )
    allowed_origins = _parse_csv_env(_raw_origins)

    _raw_allowed_methods = os.getenv(
        "ALLOWED_METHODS",
        "GET,POST,PUT,DELETE,OPTIONS" if is_production else "*",
    )
    allowed_methods = ["*"] if _raw_allowed_methods.strip() == "*" else _parse_csv_env(_raw_allowed_methods)

    _raw_allowed_headers = os.getenv(
        "ALLOWED_HEADERS",
        "Accept,Accept-Language,Authorization,Content-Language,Content-Type,Origin,X-Requested-With"
        if is_production
        else "*",
    )
    allowed_headers = ["*"] if _raw_allowed_headers.strip() == "*" else _parse_csv_env(_raw_allowed_headers)

    allowed_origin_regex = os.getenv(
        "ALLOWED_ORIGIN_REGEX",
        r"https://([a-z0-9-]+\.)?qzz\.io" if is_production else "",
    ).strip()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_origin_regex=allowed_origin_regex or None,
        allow_methods=allowed_methods,
        allow_headers=allowed_headers,
        allow_credentials=True,
    )
    app.mount("/assets", StaticFiles(directory=str(BASE_DIR / "xingce_v3")), name="assets")
    if V51_STATIC_DIR.exists():
        app.mount("/v51-static", StaticFiles(directory=str(V51_STATIC_DIR)), name="v51-static")
    @app.middleware("http")
    async def disable_static_cache_for_local_debug(request: Request, call_next):
        response = await call_next(request)
        path = request.url.path or ""
        if path.startswith("/assets/") or path.startswith("/v51-static/assets/") or path in {"/v51-static/partials.bundle.html", "/v51-static/deferred-partials.bundle.html"}:
            # Bundle filenames are stable in this project; avoid stale CDN/browser cache after deploy.
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0, s-maxage=0"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
            return response
        if path in {"/", "/legacy", "/v51", "/v53", "/login"} or path.startswith("/v51/") or path.startswith("/v53/"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        return response

    app.add_event_handler("startup", on_startup)
    for router_module in (web, auth, backup, ai, images, sync, practice, knowledge):
        app.include_router(router_module.router)
    return app


app = create_app()
