# xingce_v3_lab Ops Notes

## Current Product Boundary

This project is not a full exam system.

Current boundary:

1. manual question entry
2. manual analysis result entry
3. per-user workspace storage
4. full-backup cloud sync

Do not pull it back into Excel parsing or a heavy question-bank architecture unless that becomes a new deliberate phase.

## Why The Storage Model Is Simple

The original `xingce_v3.html` already works around one local full-backup model.

So the backend stores one full backup per user instead of splitting the model into many tables.

That keeps:

- the front-end nearly unchanged
- migration cost low
- manual entry flow fast

## Auth Rule

Current rule is explicit:

- unauthenticated user -> `/login`
- authenticated user -> `/`

That is stronger and cleaner than showing the workspace first and asking for login later.

## Docker Experience

`python:3.11-slim` pull failed on this machine, but container network for `pip` worked.

Practical fix:

- reuse local image `error_manage-ocr:latest` as the Python base image
- install only the minimal app dependencies during build

This avoids the blocked base-image pull while keeping Docker deployment usable.

## Cloudflare Experience

`cloudflare/cloudflared` was already present locally, so Docker tunnel startup worked.

Verification rule:

1. `docker compose --profile tunnel up -d`
2. check `docker logs xingce_v3_tunnel`
3. extract `trycloudflare.com` URL
4. verify the URL returns `200`
5. verify login over the public URL

Do not treat “tunnel created” as success until step 5 passes.

## UI Rule

The login page must show the current access origin.

Reason:

- local address and public address both exist
- the user needs to know which entrance is active
- this reduces confusion when Quick Tunnel domain changes

Current implementation rule:

- login page shows current origin
- login page also shows the latest detected `trycloudflare.com` URL from the shared tunnel log
- both values must be copyable

## Local Vs Cloud Rule

This project has two separate data layers:

1. browser-local cache by origin
2. per-user cloud full backup

Important behavior:

- `http://localhost:8000` and the public tunnel domain do not share one browser-local cache
- both entries only share the same cloud backup for the same logged-in user
- local edits are written to IndexedDB first
- cloud save is debounced and happens after local writes
- another origin should not be assumed to reflect the latest edits until `Cloud Load` runs there

Practical rule:

1. finish editing on one entry
2. click `Cloud Save`
3. switch to the other entry
4. click `Cloud Load`

Do not treat local and public entry as one live-synced workspace.

## Docker Frontend Rule

When running through Docker, front-end code edits are not live-mounted into the container.

Current compose file only mounts:

- `./data`
- `./runtime`

That means changes under:

- `app/`
- `xingce_v3/`

require rebuilding the app container:

```bash
docker compose up --build -d app
```

Do not debug UI behavior in Docker until the container has been rebuilt after code edits.

## Frontend Debug Rule

For UI bugs, do not default to repeated rendering tweaks before verifying the runtime path.

Required order:

1. confirm which entry the user is on: `localhost` or public domain
2. confirm which process serves the page: local uvicorn or Docker container
3. confirm the served HTML actually contains the expected code
4. confirm the target data exists in the current user backup and current node
5. only then change rendering logic

For note-heading / outline issues specifically:

- first verify the target note content in storage
- then verify the exact render function used by the current note view
- avoid broad speculative UI edits before checking the live execution path

## Knowledge Context Rule

When entering a wrong question from the knowledge-note workspace, the current knowledge node must be visible to the user.

Do not rely only on an implicit leaf auto-selection.

Practical rule:

1. if the current node is a leaf, preselect it in the modal picker
2. if the current node is not a leaf, still show its full path in the modal hint
3. save should fall back to the current workspace node when no leaf is explicitly selected

Otherwise the user will think the node context was not carried into the entry flow.

## Windows Encoding Rule

This repo is edited on Windows and some terminal output can display UTF-8 Chinese text as mojibake.

Practical rule:

1. prefer `apply_patch` for Chinese text edits
2. do not trust PowerShell console rendering as proof that file content is wrong
3. verify actual file content by reading it back in UTF-8-aware paths before making large replacements
4. avoid broad regex replacements around Chinese literals unless the target block is tightly scoped

This matters because console corruption can mislead UI debugging and accidentally damage unrelated labels.
