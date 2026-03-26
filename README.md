# xingce_v3_lab

`xingce_v3_lab` is now a lightweight cloud-backed version of the original `xingce_v3` workbench.

## Current Goal

Keep the existing manual workflow intact:

1. You manually enter questions.
2. You manually paste analysis results.
3. The system keeps full-workspace backup compatibility while adding safer per-error sync.

No Excel parsing is required in the current path.

## What Is Implemented

- `app/login.html`
  - dedicated login/register page
  - shows the current access origin
  - shows the current Cloudflare public URL when tunnel is running
  - both addresses support one-click copy
- `xingce_v3/xingce_v3.html`
  - workbench is now authenticated-only
  - login modal removed
  - keeps `Cloud Load / Cloud Save / Logout`
- `xingce_v3/xingce_v3.html`
  - original workbench kept as the main UI
- `app/main.py`
  - FastAPI service
  - user register/login/logout
  - per-user full-backup storage
  - unauthenticated requests to `/` redirect to `/login`
  - serves both the login page and the HTML workbench
- `docker-compose.yml`
  - `app` service
  - optional `cloudflared` service via Docker profile

## Storage Model

This project now uses a hybrid model:

1. one full backup JSON per user for compatibility and restore
2. per-error incremental sync operations for safer multi-entry editing
3. file-backed image storage for uploaded images when available

The full backup still stores:

- errors
- notes
- note images
- type rules
- dir tree
- global note
- knowledge tree
- knowledge-node Markdown content

The incremental sync path currently focuses on `errors[]` changes.

Important:

- full backup remains the fallback and restore source
- note bodies / knowledge content still rely mainly on the full-backup path
- error records now use UUIDs instead of integer-only ids for cross-device safety

## Knowledge Tree Extension

The current workbench keeps the knowledge tree as the main study structure.

- `knowledgeTree`
  - the primary structure
  - each node itself can store `contentMd`
  - nodes can still have children
- `errors[].noteNodeId`
  - each error binds to one knowledge node
- `notesByType + knowledgeNotes`
  - kept only as compatibility data for now
  - no longer the main UI model

When entering an error:

1. The original `type / subtype / subSubtype` flow stays unchanged.
2. You can bind the error to an existing knowledge node.
3. If the node does not exist yet, the modal can create one on the spot.
4. If nothing is selected, the system creates a default node automatically.

When using the workbench:

1. The left panel is the knowledge navigation tree.
2. The center panel is the current knowledge node workspace.
3. The right-side related-errors rail has been retired to keep the workspace focused.

## Run With Docker

```bash
cd E:\IdeaProject\git\xingce_v3_lab
set DEEPSEEK_API_KEY=your_deepseek_key_here
set MINIMAX_API_KEY=your_key_here
set MINIMAX_MODEL=MiniMax-M2.5
set ALLOWED_ORIGINS=http://127.0.0.1:8000,http://localhost:8000,https://erroranaly.qzz.io
set TUNNEL_TOKEN=your_cloudflare_tunnel_token
docker compose up --build -d app
```

DeepSeek priority:

- if `DEEPSEEK_API_KEY` is set, AI analysis prefers DeepSeek
- if DeepSeek is unavailable, the backend falls back to MiniMax
- if you only want DeepSeek, you may leave `MINIMAX_API_KEY` empty

Open:

- `http://localhost:8000`

## Run Without Docker

If Docker image pulls are blocked on this machine, use the local Python runtime:

```powershell
cd E:\IdeaProject\git\xingce_v3_lab
$env:DEEPSEEK_API_KEY='your_deepseek_key_here'
$env:MINIMAX_API_KEY='your_key_here'
$env:MINIMAX_MODEL='MiniMax-M2.5'
$env:ALLOWED_ORIGINS='http://127.0.0.1:8000,http://localhost:8000'
powershell -ExecutionPolicy Bypass -File .\scripts\start-local.ps1
```

Open:

- `http://127.0.0.1:8000`

## Local Entry Recommendation

For daily local debugging, prefer one fixed entry:

- recommended: `http://127.0.0.1:8000`

Do not casually switch between:

- `http://127.0.0.1:8000`
- `http://localhost:8000`
- `http://localhost:8080`

They may look similar, but during debugging they may not represent the same runtime path or the same browser-local state.

## `127.0.0.1:8000` vs `localhost:8000`

These two addresses often reach the same machine and the same port, but they are not the same browser origin.

Practical differences:

- `127.0.0.1` is a fixed loopback IP
- `localhost` is a hostname that usually resolves to loopback
- browser cache, cookies, localStorage, and IndexedDB are separated by origin
- this project also keeps browser-local workspace state by origin

So even if both addresses point to the same app process, they can still show different local state in the browser.

Rule of thumb:

- when debugging UI issues, use `http://127.0.0.1:8000` consistently
- do not compare `localhost` and `127.0.0.1` as if they were one shared local session

## Start Cloudflare Tunnel

```bash
cd E:\IdeaProject\git\xingce_v3_lab
docker compose --profile tunnel up --build -d
docker compose logs -f cloudflared
```

The named tunnel is configured to serve:

- `https://erroranaly.qzz.io`

If you need to create or repair the named tunnel and DNS binding from the local Cloudflare token bundle, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\bind-cloudflare-domain.ps1
```

If you only want a temporary public URL, use the Docker quick-tunnel helper instead:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-quick-tunnel-docker.ps1
```

or:

```bash
bash ./scripts/start-quick-tunnel-docker.sh
```

Important:

- the public tunnel only reflects the runtime it currently points to
- it does not automatically prove that the latest local front-end edits are active there

## Start Tunnel Without Docker

If `cloudflared` is already installed locally:

```powershell
cd E:\IdeaProject\git\xingce_v3_lab
powershell -ExecutionPolicy Bypass -File .\scripts\start-tunnel.ps1
```

This script points the tunnel to:

- `http://127.0.0.1:8000`

So it is suitable when you want the public domain to expose the current local Python runtime.

## AI And Practice APIs

The backend now exposes the roadmap stage capabilities even when the UI entry points are still evolving:

- `/api/ai/evaluate-answer`
- `/api/ai/generate-question`
- `/api/ai/diagnose`
- `/api/ai/chat`
- `/api/ai/module-summary-for-claude`
- `/api/ai/distill-to-node`
- `/api/ai/synthesize-node`
- `/api/ai/discover-patterns`
- `/api/ai/suggest-restructure`
- `/api/practice/daily`
- `/api/practice/log`
- `/api/knowledge/search`

These endpoints currently work off the authenticated user's hybrid backup data and practice log table.

## Public Access Rule

The public `https://erroranaly.qzz.io` domain may not match the page you see on local `127.0.0.1:8000` if the container runtime has not been rebuilt.

Why this happens:

1. Docker tunnel and local tunnel can point to different runtimes
2. Docker front-end edits require rebuilding the `app` container
3. browser cache on the public origin is independent from local origin cache
4. an old public tab or an old tunnel route may still be in use

Practical rule:

1. first verify that `http://127.0.0.1:8000` already shows the expected behavior
2. then confirm how the public tunnel was started
3. if using Docker tunnel, run `docker compose up --build -d app` before trusting the public URL
4. if using local tunnel, ensure local `uvicorn` is the runtime currently listening on `127.0.0.1:8000`
5. if switching between local and public entries, use `Cloud Save` on one side and `Cloud Load` on the other side

Do not assume that fixing local `127.0.0.1:8000` automatically fixes the public domain at the same moment.

## Notes

- Current auth is simple username/password with SQLite-backed sessions.
- Current sync model is hybrid:
  - full-backup restore/save remains available
  - per-error incremental sync runs through `/api/sync`
- AI entry analysis prefers DeepSeek when `DEEPSEEK_API_KEY` is present and falls back to MiniMax.
- If you are running with Docker, after front-end edits or AI feature changes you must rebuild the `app` container.
- `127.0.0.1`, `localhost`, and the public tunnel domain are different browser origins; use `Cloud Save` then `Cloud Load` when switching entries.
- If running with Docker, front-end code changes under `app/` or `xingce_v3/` require `docker compose up --build -d app`.
- Uploaded images may now be stored under `data/images/` and referenced through `/api/images/*`.
- A backend smoke test is available at `scripts/verify_v31_smoke.py`.
- Operational experience is recorded in `docs/ops-notes.md`.
- Stage progress and current implementation order are recorded in docs/roadmap.md.
- Frontend module split preparation is recorded in docs/frontend-split-plan.md.
