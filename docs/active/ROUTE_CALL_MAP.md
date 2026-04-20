# ROUTE_CALL_MAP

## Purpose

This document maps frontend runtime modules to backend API routes so route changes can be reviewed safely.

## Active runtime call map

### Shell and session

1. `xingce_v3/modules/main/99-bootstrap.js`
   - `GET /api/runtime-info`
2. `xingce_v3/modules/main/05-persistence.js`
   - `GET /api/me`
   - `POST /api/auth/logout`

### Backup and restore

1. `xingce_v3/modules/main/05-persistence.js`
   - `GET /api/backup`
   - `PUT /api/backup`
   - `POST /api/backup/chunk/init`
   - `PUT /api/backup/chunk/{upload_id}/part`
   - `POST /api/backup/chunk/complete`
   - `POST /api/backup/chunk/download/init`
   - `GET /api/backup/chunk/download/{download_id}/part`
2. `xingce_v3/modules/main/persistence/05d-local-backup-ui.js`
   - `GET /api/local-backups`
   - `POST /api/local-backups/create`
   - `POST /api/local-backups/restore`
   - `GET /api/local-backups/{backup_id}/download`
   - `DELETE /api/local-backups/{backup_id}`

### Sync and origin status

1. `xingce_v3/modules/main/05-persistence.js`
   - `GET /api/sync`
   - `POST /api/sync`
2. `xingce_v3/modules/main/persistence/05c-cloud-restore-origin-utils.js`
   - `POST /api/origin-status`
3. `xingce_v3/modules/shenlun.js`
   - `GET /api/sync`
   - `POST /api/sync`

### Practice and review

1. `xingce_v3/modules/main/13-quiz-flow.js`
   - `GET /api/practice/daily`
   - `POST /api/practice/log`
   - `POST /api/practice/attempts/batch`
2. `xingce_v3/modules/main/17-error-card-render.js`
   - `GET /api/practice/attempts/summary`
3. `xingce_v3/modules/main/21-dashboard-modules.js`
   - `GET /api/practice/insights`
   - `GET /api/practice/workbench`
4. `v51_frontend/assets/features/attempt-sync.js`
   - `POST /api/practice/attempts/batch`
   - `GET /api/practice/attempts`

### AI and image/OCR

1. `xingce_v3/modules/main/06-ai-workbench.js`
   - `POST /api/ai/chat`
   - `POST /api/ai/diagnose`
   - `POST /api/ai/generate-question`
   - `POST /api/ai/module-summary-for-claude`
2. `xingce_v3/modules/main/modal/36b-entry-ai-and-save.js`
   - `POST /api/ai/analyze-entry`
3. `xingce_v3/modules/main/07-image-processing.js`
   - `POST /api/images`
   - `POST /api/ai/ocr-image`

## Deprecated or non-active paths

1. `/api/codex/*`  
   - not part of current router registration
2. `/api/cloud/origin-status`  
   - deprecated; use `/api/origin-status`

## Update rule

When frontend adds/removes API calls:

1. update code
2. update this map
3. run route/layout checks
4. rebuild runtime container if behavior can change
