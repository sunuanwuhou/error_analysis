# Backend router refactor

## What changed

The original backend kept helper functions, app wiring, and all route handlers inside `app/main.py`.
This version splits that layout into:

- `app/main.py` — app factory, middleware, static mounts, router registration
- `app/core.py` — shared business helpers used by multiple routes
- `app/routers/web.py` — web entry pages and runtime info
- `app/routers/auth.py` — register / login / logout / me
- `app/routers/backup.py` — backup and origin status
- `app/routers/ai.py` — AI and OCR endpoints
- `app/routers/images.py` — image upload / fetch / unref
- `app/routers/sync.py` — sync pull / push
- `app/routers/practice.py` — practice log and daily selection
- `app/routers/knowledge.py` — knowledge search
- `app/routers/codex.py` — Codex inbox threads and messages

## Why this is safer

This refactor keeps the same HTTP paths, payload formats, and startup entry (`app.main:app`), but lowers maintenance risk:

- route wiring is now explicit and testable
- `scripts/check_router_layout.py` can detect route drift after future refactors
- smoke tests now touch representative routes across multiple routers instead of only checking the legacy page shell

## Current direction

This is still a transitional architecture. `app/core.py` still contains a large amount of shared logic. The next step, if needed, is to continue splitting `app/core.py` into domain services such as:

- `services/backup.py`
- `services/sync.py`
- `services/ai.py`
- `services/practice.py`
- `services/codex.py`

That second-stage split is lower risk now because the route boundary has already been isolated.
