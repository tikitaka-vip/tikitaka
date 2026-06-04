#!/bin/bash
# WAL-safe daily backup wrapper for TikiTaka. Runs backup-db.js and alerts
# Telegram on failure. Install via crontab (see scripts/install-backup-cron.sh).
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CREDS="$HOME/.agent-factory/credentials.env"

export DB_PATH="${DB_PATH:-/opt/worldcup/worldcup.db}"
export BACKUP_DIR="${BACKUP_DIR:-/home/agent/backups/worldcup}"
export KEEP_DAYS="${KEEP_DAYS:-7}"

OUT=$(node "$SCRIPT_DIR/backup-db.js" 2>&1)
CODE=$?
echo "$(date -u +%FT%TZ) $OUT"

if [ $CODE -ne 0 ]; then
  if [ -f "$CREDS" ]; then
    BOT_TOKEN=$(grep TG_BOT_TOKEN "$CREDS" | cut -d= -f2)
    CHAT_ID=$(grep TG_CHAT_ID "$CREDS" | cut -d= -f2)
    if [ -n "${BOT_TOKEN:-}" ] && [ -n "${CHAT_ID:-}" ]; then
      curl -s "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
        --data-urlencode "chat_id=${CHAT_ID}" \
        --data-urlencode "text=🚨 TikiTaka DB backup FAILED: ${OUT}" > /dev/null
    fi
  fi
  exit $CODE
fi
