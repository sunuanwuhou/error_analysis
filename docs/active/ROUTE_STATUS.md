# ROUTE_STATUS

## Purpose

This document defines which routes are active, which are compatibility paths, and which are migration-only paths.
It is the source-of-truth for runtime route behavior and should be updated when route intent changes.

## Runtime route map (current)

### Web entry routes

#### Active in current runtime

1. `/`  
   - authenticated app entry
   - serves `v51_frontend/index.html`
2. `/login`  
   - unauthenticated login entry
3. `/health`  
   - health probe
4. `/api/public-entry`
5. `/api/runtime-info`

#### Compatibility redirects (still wired, not primary product entry)

1. `/legacy` -> redirects to `/`
2. `/v51` -> redirects to `/`
3. `/v53` -> redirects to `/`
4. `/v51/{path:path}` -> redirects to `/`
5. `/v53/{path:path}` -> redirects to `/`

#### Migration-only path (not current primary entry)

1. `/new`
2. `/new/{path:path}`

Behavior:

- if `NEW_FRONTEND_ENABLED` and frontend dist exists, serves new frontend index
- otherwise redirects to `/`
- this path is shadow/migration entry and not the main authenticated runtime today

## Static assets route map

#### Active

1. `/assets/*` -> serves `xingce_v3/`
2. `/v51-static/*` -> serves `v51_frontend/`

#### Runtime contract

`/` -> `v51_frontend/index.html` -> `/v51-static/assets/v53-bootstrap.js` -> `/assets/legacy-app.bundle.manifest.json` -> split legacy bundles under `/assets/modules/*.bundle.js`.

## API route status

All routes under included routers in `app.main` are active:

1. auth: `/api/auth/*`, `/api/me`
2. backup: `/api/backup*`, `/api/local-backups*`, `/api/origin-status`
3. ai: `/api/ai/*`
4. images: `/api/images*`
5. sync: `/api/sync`
6. practice: `/api/practice/*`
7. knowledge: `/api/knowledge/search`

### Explicitly not active now

`/api/codex/*` is not part of current router registration and should not be used as active-runtime expectation.

## Validation commands

Use WSL-first checks:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\wsl.ps1 -Action sh -Cmd "docker compose exec -T app python scripts/check/check_router_layout.py"
powershell -ExecutionPolicy Bypass -File .\scripts\wsl.ps1 -Action sh -Cmd "docker compose exec -T app python scripts/check/check_legacy_entry.py"
```

## Update rule

When changing route intent:

1. update backend router code
2. update `scripts/check/check_router_layout.py`
3. update this `docs/active/ROUTE_STATUS.md`
4. run checks and record result in `docs/active/SELF_TEST_REPORT.md`
