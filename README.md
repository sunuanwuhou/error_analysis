# xingce_v3_lab

`xingce_v3_lab` is the current authenticated study workbench for error analysis, knowledge-note editing, cloud sync, and AI-assisted review.

## Current Product State

The current production baseline already includes:

1. authenticated login/register flow
2. knowledge-tree-centered workspace
3. hybrid sync
   - full-backup restore/save
   - per-error incremental sync
4. split image storage through backend image APIs
5. DeepSeek-first AI routing with MiniMax fallback
6. stable Cloudflare named tunnel on `https://erroranaly.qzz.io`
7. async `Codex Inbox` for remote留言 and scheduled reply write-back

The right-side related-errors rail has been retired from the active layout.

## Main Runtime Entry

- preferred Docker local entry: `http://127.0.0.1:8080`
- fallback local Python entry: `http://127.0.0.1:8000`
- public: `https://erroranaly.qzz.io`

The login page no longer exposes the current domain or tunnel address.

## Storage Model

This project intentionally uses a hybrid model instead of a hard cut-over:

1. `user_backups`
   - full workspace backup
   - restore and rollback safety net
2. `operations`
   - per-error incremental sync
   - safer cross-entry editing
3. `user_images`
   - backend-managed uploaded images
   - deduped by hash

Important caveat:

- fine-grained sync currently focuses on error records
- long-form note bodies and knowledge content still rely mainly on full-backup persistence

## AI Capabilities

The backend already exposes:

- `/api/ai/analyze-entry`
- `/api/ai/evaluate-answer`
- `/api/ai/generate-question`
- `/api/ai/diagnose`
- `/api/ai/chat`
- `/api/ai/module-summary-for-claude`
- `/api/ai/distill-to-node`
- `/api/ai/synthesize-node`
- `/api/ai/discover-patterns`
- `/api/ai/suggest-restructure`

DeepSeek is preferred when `DEEPSEEK_API_KEY` is present.

## Codex Inbox

The workbench now includes an async `Codex Inbox` for remote use.

- users leave a message inside the app
- the message is stored in SQLite as `pending`
- the Codex desktop client scans pending messages on a schedule
- the reply is written back into the same thread

This is designed for domain-only access when the user cannot directly open Codex desktop.

## Practice Capabilities

The backend already exposes:

- `/api/practice/daily`
- `/api/practice/log`
- `/api/knowledge/search`

The current UI has started wiring these capabilities in, but the product is still primarily the error-analysis workbench rather than a full exam platform.

## Shenlun Source Materials

Shenlun source materials have been copied into the repository for stable in-project access:

- [quantity sources](E:\IdeaProject\git\xingce_v3_lab\knowledge_sources\shenlun\quantity)
- [ashore sources](E:\IdeaProject\git\xingce_v3_lab\knowledge_sources\shenlun\ashore)
- [source manifest](E:\IdeaProject\git\xingce_v3_lab\knowledge_sources\README.md)

These files are currently treated as read-only source material for the upcoming Shenlun module.

## Run With Docker

```bash
cd E:\IdeaProject\git\xingce_v3_lab
set DEEPSEEK_API_KEY=your_deepseek_key_here
set MINIMAX_API_KEY=your_minimax_key_here
set MINIMAX_MODEL=MiniMax-M2.5
set ALLOWED_ORIGINS=http://127.0.0.1:8080,http://localhost:8080,http://127.0.0.1:8000,http://localhost:8000,https://erroranaly.qzz.io
set TUNNEL_TOKEN=your_cloudflare_tunnel_token
docker compose up --build -d app
```

Optional fallback only:

```bash
docker compose --profile server-inbox up --build -d codex-inbox-worker
```

## Run Without Docker

```powershell
cd E:\IdeaProject\git\xingce_v3_lab
$env:DEEPSEEK_API_KEY='your_deepseek_key_here'
$env:MINIMAX_API_KEY='your_minimax_key_here'
$env:MINIMAX_MODEL='MiniMax-M2.5'
$env:ALLOWED_ORIGINS='http://127.0.0.1:8080,http://localhost:8080,http://127.0.0.1:8000,http://localhost:8000'
powershell -ExecutionPolicy Bypass -File .\scripts\start-local.ps1
```

## Cloudflare Domain

Named tunnel production access is bound to:

- `https://erroranaly.qzz.io`

Repair/bootstrap script:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\bind-cloudflare-domain.ps1
```

Temporary quick tunnel:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-quick-tunnel-docker.ps1
```

## Verification

Useful checks:

```powershell
python -m py_compile app/main.py
python .\scripts\verify_v31_smoke.py
docker compose up --build -d app
```

## Documentation Map

- [current roadmap](E:\IdeaProject\git\xingce_v3_lab\docs\roadmap.md)
- [ops notes](E:\IdeaProject\git\xingce_v3_lab\docs\ops-notes.md)
- [Codex inbox](E:\IdeaProject\git\xingce_v3_lab\docs\codex-inbox.md)
- [v3.1 integration plan](E:\IdeaProject\git\xingce_v3_lab\docs\v3.1-integration-plan.md)
- [v3.1 rollout notes](E:\IdeaProject\git\xingce_v3_lab\docs\v3.1-rollout-notes-2026-03-26.md)
- [shenlun workbench plan](E:\IdeaProject\git\xingce_v3_lab\docs\shenlun-workbench-plan.md)
