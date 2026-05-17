#!/usr/bin/env bash
# Batch re-import every *.docx under ./word版本/ (see docs/active/SUITE_BANK_WORD_IMPORT_RULES.md §7).
# Run from repo root on a machine where `docker compose` targets the stack (e.g. WSL).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

shopt -s nullglob
count=0
for doc in "$ROOT"/word版本/*/*.docx; do
  base="$(basename "$doc")"
  [[ "$base" == '~$'* ]] && continue
  folder="$(basename "$(dirname "$doc")")"
  rel="word版本/${folder}/${base}"
  echo ""
  echo "========== [$((++count))] $rel =========="
  docker compose exec -T app python3 /app/tools/suite_bank/import_word_suite_bank.py \
    --docx "/app/$rel" \
    --source-rel-path "$rel" \
    --folder "$folder"
done

echo ""
echo "Done. Imported $count file(s)."
