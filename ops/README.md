# Operations layout

- **`docker-compose.yml`** and **`Dockerfile`** stay at the **repository root** so `docker compose` works without extra `-f` flags (see `README.md`, `AGENTS.md`).
- **`ops/cloudflared/`** — optional place for Cloudflare tunnel PEM / local tunnel material (gitignored; create directory if needed). `scripts/bind-cloudflare-domain.ps1` defaults to `ops/cloudflared/token.pem`.
- A legacy **`cloudflared/`** folder at repo root may still exist on some machines; both are ignored by Git.

For runtime data and backups, use **`data/`** and **`runtime/`** at repo root (volume-mounted in Docker).
