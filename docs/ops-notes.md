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
