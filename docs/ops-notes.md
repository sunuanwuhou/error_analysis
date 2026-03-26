# xingce_v3_lab Ops Notes

## Current Product Boundary

This project is not a full exam system.

Current boundary:

1. manual question entry
2. manual analysis result entry
3. per-user workspace storage
4. full-backup cloud sync

Current v3.1 addition:

5. per-error incremental sync for safer multi-entry editing

Do not pull it back into Excel parsing or a heavy question-bank architecture unless that becomes a new deliberate phase.

## Why The Storage Model Is Simple

The original `xingce_v3.html` already works around one local full-backup model.

So the backend stores one full backup per user instead of splitting the model into many tables.

That keeps:

- the front-end nearly unchanged
- migration cost low
- manual entry flow fast

Current practical extension:

- `user_backups` remains the restore and compatibility layer
- `operations` adds per-error incremental sync
- `user_images` allows file-backed image storage
- the system is intentionally hybrid rather than a hard cut-over

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

### 2026-03-24: Custom Domain Setup Attempt

**Goal**: Configure `erroranaly.qzz.io` as custom domain for the tunnel

**What was done**:
1. Downloaded Argo Tunnel token from Cloudflare Dashboard
2. Updated docker-compose.yml with token
3. Tried multiple token formats (file mount, environment variable)

**Result**: Token always reported as invalid

**Lessons learned**:
1. Argo Tunnel tokens from Cloudflare Dashboard may have different formats
2. The token format starting with `-----BEGIN ARGO TUNNEL TOKEN-----` may require specific setup
3. Alternative approach: use the older `credentials.json` method instead of token
4. Or use Quick Tunnel (temporary URL) for testing

**Successful approach for production**:
- Use `cloudflared tunnel login` to get proper credentials
- Create tunnel via CLI: `cloudflared tunnel create <name>`
- Generate DNS with: `cloudflared tunnel route dns <name> <domain>`
- Use `credentials.json` for Docker volume mount

---

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
3. per-user incremental error ops

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

Current behavior:

- local edits auto-save to cloud after debounce
- error edits can also sync through `/api/sync`
- page open may auto-load or prompt for cloud restore depending on current local state
- manual `Cloud Save` and `Cloud Load` remain available as explicit controls

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

## TOC Runtime Rule

The note TOC bug is a runtime-path problem before it is a rendering problem.

Observed case on 2026-03-23:

- the patched code worked on `http://127.0.0.1:8000`
- the public entry and some old local entries still showed the old note page without TOC

Root cause:

1. the live TOC fix was served by local `uvicorn` on `127.0.0.1:8000`
2. another entry was still hitting an older runtime
3. browser cache made the mismatch harder to notice

Practical interpretation:

- if `127.0.0.1:8000` works, the front-end code itself is likely correct
- if another origin does not work, assume runtime mismatch first
- do not keep editing UI code until the served HTML and served JS are confirmed for that exact origin

Verification order for note TOC:

1. confirm which exact URL the user opened
2. confirm which process is serving that URL
3. fetch the served `/assets/modules/knowledge-workspace.js`
4. check whether the served script contains the expected TOC code
5. only then debug note content or CSS

## Local 8000 Vs Other Entrances

There are multiple valid entry paths in this project, but they are not guaranteed to run the same build.

Current local rules:

- `scripts/start-local.ps1` starts local `uvicorn` on `127.0.0.1:8000`
- Docker maps the app container to both `8000` and `8080`
- the Docker tunnel targets `http://app:8000` inside Docker
- the local tunnel script targets `http://127.0.0.1:8000`

This means:

- `127.0.0.1:8000` can be the newest local Python runtime
- `localhost:8080` may be a different process or an older containerized build
- a public `trycloudflare.com` URL only reflects whichever runtime the tunnel currently points to

Do not assume “same project” means “same served front-end”.

## Public Domain Rule

If the public domain does not reflect a local front-end fix, check tunnel target before changing code again.

Most likely causes:

1. the tunnel points to Docker `app`, but the container was not rebuilt after `app/` or `xingce_v3/` edits
2. the tunnel points to an older local process
3. the browser opened an older saved domain or a stale tab
4. the public origin is using its own cached page shell and JS bundle

Required checks:

1. identify whether the tunnel was started by Docker or by `scripts/start-tunnel.ps1`
2. if Docker tunnel is used, run `docker compose up --build -d app` before trusting the public URL
3. if local tunnel is used, confirm `127.0.0.1:8000` is the exact runtime currently listening
4. fetch the public `/assets/modules/knowledge-workspace.js` and compare it with the local one

Rule of thumb:

- local `127.0.0.1:8000` working only proves the source code is fixed
- the public domain works only after its target runtime is confirmed to serve the same files

## Quick Tunnel Fallback

If the configured `cloudflared` container keeps failing with token errors, use a Docker quick tunnel instead of debugging auth first.

Practical command on this machine:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-quick-tunnel-docker.ps1
```

This starts a temporary `cloudflare/cloudflared` container pointing at `http://host.docker.internal:8000` and prints a fresh `trycloudflare.com` URL.

## v3.1 Smoke Check

There is now a repeatable backend smoke test:

```powershell
python .\scripts\verify_v31_smoke.py
```

It verifies:

1. health endpoint
2. register/login
3. full backup read/write
4. incremental sync push/pull and idempotency
5. image upload/read/unref

## Local Debug Cache Rule

For local debugging, HTML and `/assets/*` should return no-cache headers.

Reason:

- otherwise the browser can keep an older page shell or module file
- this can make a fixed local runtime look unfixed

Practical rule:

1. local debug responses for `/`, `/login`, and `/assets/*` should send `Cache-Control: no-store`
2. after front-end debugging fixes, restart the local service once
3. if behavior still looks old, verify headers before assuming the patch failed

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

## Directory Rule

The front-end directory model is now treated as durable workspace state.

Practical rule:

1. `dirTree` is not temporary UI state
2. `dirTree` is stored both locally and inside the cloud full backup
3. a new origin showing default or empty directory data does not prove the user has no saved directory
4. directory debugging should start from account, origin, and backup content verification

Detailed frozen rules are recorded in `docs/frontend-directory-rules.md`.

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
