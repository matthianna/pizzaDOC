#!/usr/bin/env bash
# Run before production deploys or risky schema changes.
# Requires: PostgreSQL client (pg_dump). Install: brew install libpq && brew link --force libpq
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ ! -f .env ]]; then
  echo "Missing .env in $ROOT"
  exit 1
fi
DATABASE_URL=$(grep '^DATABASE_URL=' .env | sed 's/^DATABASE_URL=//; s/^"//; s/"$//')
OUT="${BACKUP_DIR:-$ROOT/../db-backups}/pizzadoc-$(date +%Y%m%d_%H%M%S).sql"
mkdir -p "$(dirname "$OUT")"
pg_dump "$DATABASE_URL" -F p -f "$OUT"
echo "Backup written: $OUT"
