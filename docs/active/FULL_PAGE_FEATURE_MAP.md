# FULL_PAGE_FEATURE_MAP

## Purpose

This document is the single source of truth for:

1. all user-facing pages/routes
2. their frontend ownership (legacy vs vue)
3. primary feature domains
4. key backend API dependencies
5. key code entry files

## Runtime entry overview

1. Active authenticated root: `/` -> `v51_frontend/index.html` (legacy shell)
2. New Vue migration entry: `/new/*` -> `frontend/dist/index.html` (if enabled)
3. Legacy compatibility aliases:
   - `/legacy` -> redirect `/`
   - `/v51`, `/v53` -> redirect `/`
4. Auth entry:
   - `/login` -> `app/login.html`

Backend reference: `app/routers/web.py`

---

## Page map (all major user-visible pages)

| Route / Entry | Stack | Primary feature scope | Frontend entry files | Main API groups |
|---|---|---|---|---|
| `/` | legacy | core workspace shell (errors, knowledge tree, notes, practice entry, sync, backup) | `v51_frontend/index.html`, `v51_frontend/assets/v53-bootstrap.js`, `xingce_v3/modules/main/99-bootstrap.js` | auth, sync, backup, practice, ai, images |
| `/new/xingce/workspace` | vue | new Xingce workspace page | `frontend/src/views/xingce/WorkspacePage.vue` | sync, practice, backup, auth |
| `/new/shenlun/workbench` | vue | Shenlun workbench | `frontend/src/views/shenlun/WorkbenchPage.vue` | shenlun, sync, auth |
| `/new/shenlun/result/:attemptId` | vue | Shenlun attempt result page | `frontend/src/views/shenlun/ResultPage.vue` | shenlun, auth |
| `/shenlun` | legacy page | Shenlun standalone html entry | `xingce_v3/shenlun.html`, `xingce_v3/modules/shenlun.js` | shenlun, sync, auth |
| `/login` | auth page | login/register session entry | `app/login.html` | auth, me |
| `xingce_v3/note_editor.html` | legacy tool page | note editor utility page | `xingce_v3/note_editor.html`, `xingce_v3/modules/note-editor-page.js` | sync/backup (indirect) |
| `xingce_v3/note_viewer.html` | legacy tool page | note viewer utility page | `xingce_v3/note_viewer.html`, `xingce_v3/modules/note-viewer-page.js` | sync/backup (indirect) |
| `xingce_v3/process_image_editor.html` | legacy tool page | process image/canvas editor | `xingce_v3/process_image_editor.html`, `xingce_v3/modules/process-image-editor-page.js` | images, ai(ocr) |
| `xingce_v3/global_search.html` | legacy tool page | global search utility page | `xingce_v3/global_search.html`, `xingce_v3/modules/global-search-page.js` | sync/local state |

Notes:

1. `markdown_smoke_harness.html` and `process_image_smoke_harness.html` are smoke/testing harness pages, not primary user pages.
2. `xingce_v3/xingce_v3.html` exists but is not the current authenticated runtime root.

---

## Feature-domain ownership (high level)

### 1) Core workspace (legacy active runtime)

- Main files:
  - `xingce_v3/modules/main/99-bootstrap.js`
  - `xingce_v3/modules/main/05-persistence.js`
  - `xingce_v3/modules/main/16-main-render.js`
  - `xingce_v3/modules/main/14-sidebar-render.js`
- Includes:
  - error list / filters / card actions
  - knowledge tree + notes panel
  - daily/full/review/retrain practice entries
  - cloud sync + backup UI

### 2) Practice and review

- Main files:
  - `xingce_v3/modules/main/modal/13c-quiz-queue-entry.js`
  - `xingce_v3/modules/main/13-quiz-flow.js`
  - `xingce_v3/modules/main/modal/13f-quiz-render-answer.js`
  - `xingce_v3/modules/main/modal/13g-quiz-review-render.js`
  - `app/routers/practice.py`
  - `app/services/practice_query_service.py`
  - `app/services/today_training_service.py`
  - `app/services/today_training_session_service.py`
- Includes:
  - today training, full practice, review/retrain queues
  - today session start/current/pause/answer
  - attempt logs + batch attempt writes

### 3) New Vue workspace

- Main files:
  - `frontend/src/views/xingce/WorkspacePage.vue`
  - `frontend/src/components/xingce/*.vue`
  - `frontend/src/stores/xingceStore.ts`
  - `frontend/src/api/xingce.ts`
- Includes:
  - migration workspace UI
  - modern modal/components version of key operations

### 4) Shenlun

- Main files:
  - `frontend/src/views/shenlun/WorkbenchPage.vue`
  - `frontend/src/views/shenlun/ResultPage.vue`
  - `app/routers/shenlun.py`
- Legacy compatibility:
  - `xingce_v3/shenlun.html`
  - `xingce_v3/modules/shenlun.js`

---

## API dependency groups by module

For detailed route-to-file mapping, use `docs/active/ROUTE_CALL_MAP.md`.

Quick grouping:

1. auth/session: `/api/auth/*`, `/api/me`
2. sync/state: `/api/sync`, `/api/origin-status`
3. backup: `/api/backup*`, `/api/local-backups*`
4. practice: `/api/practice/*`
5. ai/image: `/api/ai/*`, `/api/images`, `/api/ai/ocr-image`
6. shenlun: `/api/shenlun/*`

---

## Mandatory maintenance rule for this map

Any change that affects user-visible behavior must update this file in the same delivery when it touches:

1. route entry behavior (`app/routers/web.py`, frontend router, redirects)
2. page ownership (legacy vs vue)
3. feature-domain ownership file paths
4. page-level API dependency surface

If no update is needed, explicitly state "FULL_PAGE_FEATURE_MAP.md reviewed, no map delta" in delivery notes.
