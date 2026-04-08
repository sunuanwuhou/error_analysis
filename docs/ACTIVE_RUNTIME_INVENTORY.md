# ACTIVE_RUNTIME_INVENTORY

## Purpose

This file is the current cleanup baseline for deciding what stays, what is active, and what has been retired.

Use this before making structural changes.

## Active delivery target

The active user-facing Docker runtime is:

1. `app/login.html`
2. authenticated `/` -> `v51_frontend/index.html`
3. `v51_frontend/assets/v53-bootstrap.js`
4. bundled assets and feature pages under `xingce_v3/`

## Confirmed active directories

### `app/`

- FastAPI app, auth, backup, sync, OCR, image, practice, codex, and runtime routes
- current entry routing is defined in `app/routers/web.py`

### `v51_frontend/`

- authenticated shell entry
- bootstrap and shell-specific assets
- partial bundles injected at runtime

### `xingce_v3/`

- bundled CSS and JS used by the active shell
- feature pages such as note editor, note viewer, process image editor, global search, and shenlun
- legacy fallback page at `/legacy`

### `scripts/`

- active build, packaging, and smoke/self-check scripts
- `build_legacy_assets.py` is part of the runtime asset pipeline

### `docs/`

- source of truth for project rules, runtime baseline, and delivery discipline

### `data/`

- active SQLite database and runtime persistence

## Confirmed active files

- `Dockerfile`
- `docker-compose.yml`
- `README.md`
- `requirements.txt`
- `app/login.html`
- `v51_frontend/index.html`
- `v51_frontend/assets/v53-bootstrap.js`
- `xingce_v3/xingce_v3.html`
- `xingce_v3/styles/legacy-app.bundle.css`
- `xingce_v3/modules/legacy-app.bundle.js`

## Retired from active baseline

### `frontend/`

This experimental Vite Vue workspace has been removed from the repo.

Why:

1. it was not copied into the Docker image
2. it was not served by the current FastAPI routes
3. it was not part of the runtime package baseline
4. it repeatedly caused planning and delivery to land on the wrong chain

## Structural decisions locked by this cleanup

1. future user-visible frontend work must land on the active runtime chain first
2. do not reintroduce a second frontend line unless the runtime switch plan is explicit and documented
3. if a new frontend rewrite is started later, it must come with:
   - a migration cutover plan
   - updated routing truth
   - updated Docker build truth
   - updated self-test coverage

## Safe cleanup rule

Before deleting anything else, prove all three:

1. Docker does not copy it
2. FastAPI does not route to it
3. active scripts and docs do not treat it as current runtime baseline
