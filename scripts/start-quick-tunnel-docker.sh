#!/bin/bash
set -euo pipefail

NAME="codex_quick_tunnel"
TARGET_URL="http://host.docker.internal:8000"

echo "Starting Docker-based Cloudflare Quick Tunnel for $TARGET_URL"

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" cloudflare/cloudflared:latest tunnel --no-autoupdate --url "$TARGET_URL" >/dev/null

sleep 4
URL="$(docker logs "$NAME" 2>&1 | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -n 1 || true)"

if [[ -z "$URL" ]]; then
  docker logs "$NAME"
  echo "Quick tunnel URL not found in logs." >&2
  exit 1
fi

echo "Quick tunnel URL:"
echo "$URL"
echo
echo "Stop it with:"
echo "docker rm -f $NAME"
