# xingce_v3_lab

`xingce_v3_lab` is now a lightweight cloud-backed version of the original `xingce_v3` workbench.

## Current Goal

Keep the existing manual workflow intact:

1. You manually enter questions.
2. You manually paste analysis results.
3. The system only stores and syncs the full workspace by user.

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

This project does not split the xingce data into many backend tables yet.

Instead it stores one full backup JSON per user:

- errors
- notes
- note images
- type rules
- dir tree
- global note
- knowledge tree
- knowledge-node Markdown content

That matches the existing xingce front-end model and keeps the migration small.

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
3. The right panel shows related errors for the current knowledge node.

## Run With Docker

```bash
cd E:\IdeaProject\git\xingce_v3_lab
set MINIMAX_API_KEY=your_key_here
set MINIMAX_MODEL=MiniMax-M2.5
docker compose up --build -d app
```

Open:

- `http://localhost:8000`

## Run Without Docker

If Docker image pulls are blocked on this machine, use the local Python runtime:

```powershell
cd E:\IdeaProject\git\xingce_v3_lab
$env:MINIMAX_API_KEY='your_key_here'
$env:MINIMAX_MODEL='MiniMax-M2.5'
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

The tunnel log will print a `trycloudflare.com` URL.

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

## Public Access Rule

The public `trycloudflare.com` domain may not match the page you see on local `127.0.0.1:8000`.

Why this happens:

1. Docker tunnel and local tunnel can point to different runtimes
2. Docker front-end edits require rebuilding the `app` container
3. browser cache on the public origin is independent from local origin cache
4. an old public tab or an old tunnel URL may still be in use

Practical rule:

1. first verify that `http://127.0.0.1:8000` already shows the expected behavior
2. then confirm how the public tunnel was started
3. if using Docker tunnel, run `docker compose up --build -d app` before trusting the public URL
4. if using local tunnel, ensure local `uvicorn` is the runtime currently listening on `127.0.0.1:8000`
5. if switching between local and public entries, use `Cloud Save` on one side and `Cloud Load` on the other side

Do not assume that fixing local `127.0.0.1:8000` automatically fixes the public domain at the same moment.

## Notes

- Current auth is simple username/password with SQLite-backed sessions.
- Current sync model is full-backup sync, not per-record merge.
- This is intentional: it lets the original workbench keep working with minimal change.
- AI entry analysis uses MiniMax and reads `MINIMAX_API_KEY` / `MINIMAX_MODEL` from the runtime environment.
- If you are running with Docker, after front-end edits or AI feature changes you must rebuild the `app` container.
- `127.0.0.1`, `localhost`, and the public tunnel domain are different browser origins; use `Cloud Save` then `Cloud Load` when switching entries.
- If running with Docker, front-end code changes under `app/` or `xingce_v3/` require `docker compose up --build -d app`.
- Operational experience is recorded in `docs/ops-notes.md`.
- Stage progress and current implementation order are recorded in docs/roadmap.md.
- Frontend module split preparation is recorded in docs/frontend-split-plan.md.
