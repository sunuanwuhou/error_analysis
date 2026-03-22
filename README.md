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
- knowledge leaf notes

That matches the existing xingce front-end model and keeps the migration small.

## Knowledge Tree Extension

The current workbench now keeps two note models in parallel:

- `knowledgeTree + knowledgeNotes`
  - the new primary model
  - each leaf node has its own Markdown note
  - each error stores `noteNodeId`
- `notesByType`
  - legacy type-based notes
  - kept for backward compatibility

When entering an error:

1. The original `type / subtype / subSubtype` flow stays unchanged.
2. You can bind the error to a leaf node in the knowledge tree.
3. If no leaf exists yet, the modal can create one on the spot.
4. If nothing is selected, the system creates a default leaf automatically.

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
