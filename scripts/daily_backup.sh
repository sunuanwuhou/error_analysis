#!/bin/bash
set -euo pipefail

DB_PATH="${1:-/app/data/xingce.db}"
BACKUP_DIR="${2:-/app/data/backups}"

mkdir -p "$BACKUP_DIR"
DEST="$BACKUP_DIR/xingce.db.$(date +%Y%m%d)"

cp "$DB_PATH" "$DEST"
echo "$(date '+%Y-%m-%d %H:%M:%S') backup -> $DEST"

find "$BACKUP_DIR" -name "xingce.db.*" -mtime +7 -delete
