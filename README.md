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
docker compose up --build -d app
```

Open:

- `http://localhost:8000`

## Run Without Docker

If Docker image pulls are blocked on this machine, use the local Python runtime:

```powershell
cd E:\IdeaProject\git\xingce_v3_lab
powershell -ExecutionPolicy Bypass -File .\scripts\start-local.ps1
```

Open:

- `http://127.0.0.1:8000`

## Start Cloudflare Tunnel

```bash
cd E:\IdeaProject\git\xingce_v3_lab
docker compose --profile tunnel up --build -d
docker compose logs -f cloudflared
```

The tunnel log will print a `trycloudflare.com` URL.

## Start Tunnel Without Docker

If `cloudflared` is already installed locally:

```powershell
cd E:\IdeaProject\git\xingce_v3_lab
powershell -ExecutionPolicy Bypass -File .\scripts\start-tunnel.ps1
```

## Notes

- Current auth is simple username/password with SQLite-backed sessions.
- Current sync model is full-backup sync, not per-record merge.
- This is intentional: it lets the original workbench keep working with minimal change.
- Operational experience is recorded in `docs/ops-notes.md`.
- Stage progress and current implementation order are recorded in docs/roadmap.md.
- Frontend module split preparation is recorded in docs/frontend-split-plan.md.

