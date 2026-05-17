#!/usr/bin/env bash
# Wipe suite_bank tables then re-import every docx under ./word版本/.
# Prefer this after bad dedupe kept non-word rows. Run from repo root (Docker compose cwd).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo ">>> Clearing suite_papers (suite_questions CASCADE)…"
docker compose exec -T app python3 <<'PY'
from backend.database import get_conn

with get_conn() as c:
    c.execute("DELETE FROM suite_papers")
print("cleared")
PY

echo ">>> Batch Word import…"
bash "$ROOT/tools/suite_bank/import_word_versions_batch.sh"
