#!/bin/bash
# WAL-safe daily backup wrapper for TikiTaka. Runs backup-db.js and alerts
# Telegram on failure. Install via crontab (see scripts/install-backup-cron.sh).
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CREDS="$HOME/.agent-factory/credentials.env"

export DB_PATH="${DB_PATH:-/opt/worldcup/worldcup.db}"
export BACKUP_DIR="${BACKUP_DIR:-/home/agent/backups/worldcup}"
export KEEP_DAYS="${KEEP_DAYS:-7}"

tg() {
  # tg "message" — best-effort Telegram alert, never fails the script
  [ -f "$CREDS" ] || return 0
  local token chat
  token=$(grep TG_BOT_TOKEN "$CREDS" | cut -d= -f2)
  chat=$(grep TG_CHAT_ID "$CREDS" | cut -d= -f2)
  [ -n "${token:-}" ] && [ -n "${chat:-}" ] || return 0
  curl -s "https://api.telegram.org/bot${token}/sendMessage" \
    --data-urlencode "chat_id=${chat}" \
    --data-urlencode "text=$1" > /dev/null || true
}

OUT=$(node "$SCRIPT_DIR/backup-db.js" 2>&1)
CODE=$?
echo "$(date -u +%FT%TZ) $OUT"

if [ $CODE -ne 0 ]; then
  tg "🚨 TikiTaka DB backup FAILED: ${OUT}"
  exit $CODE
fi

# Self-heal: ensure our own cron line still exists. This backup silently
# stopped once (Jun 5-7) when the line wasn't persistently installed. The
# wrapper alerts on a failed RUN but cannot alert when runs stop happening,
# so each successful run re-asserts the line. As long as it fires at least
# daily it keeps itself scheduled across crontab resets.
CRON_LINE="0 2 * * * $SCRIPT_DIR/backup-db.sh >> /home/agent/backup-db.log 2>&1"
MARK="# tikitaka-wal-backup"
if ! crontab -l 2>/dev/null | grep -qF "$MARK"; then
  ( crontab -l 2>/dev/null ; echo "$CRON_LINE $MARK" ) | crontab - \
    && echo "$(date -u +%FT%TZ) [backup-db] self-heal: re-installed missing cron line" \
    && tg "♻️ TikiTaka DB backup cron was missing and has been re-installed (self-heal)."
fi
