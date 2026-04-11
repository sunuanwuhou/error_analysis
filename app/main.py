from __future__ import annotations

import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import BASE_DIR, V51_STATIC_DIR
from app.core import on_startup
from app.routers import ai, auth, backup, codex, images, knowledge, practice, sync, web


def create_app() -> FastAPI:
    app = FastAPI(title="xingce_v3_lab")
    _raw_origins = os.getenv(
        "ALLOWED_ORIGINS",
        "http://127.0.0.1:8000,http://localhost:8000",
    )
    allowed_origins = [origin.strip() for origin in _raw_origins.split(",") if origin.strip()]
    allowed_origin_regex = os.getenv("ALLOWED_ORIGIN_REGEX", r"https://([a-z0-9-]+\.)?qzz\.io")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_origin_regex=allowed_origin_regex,
        allow_methods=["*"],
        allow_headers=["*"],
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
    for router_module in (web, auth, backup, ai, images, sync, practice, knowledge, codex):
        app.include_router(router_module.router)
    return app


app = create_app()
