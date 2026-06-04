#!/bin/bash
# Installs the WAL-safe daily backup as an agent-user cron job (idempotent).
# Runs at 02:00 UTC daily. This is a REDUNDANT, WAL-consistent safety net that
# is independent of the root-owned /opt/worldcup/backup.sh (which uses cp).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CRON_LINE="0 2 * * * $SCRIPT_DIR/backup-db.sh >> /home/agent/backup-db.log 2>&1"
MARK="# tikitaka-wal-backup"

chmod +x "$SCRIPT_DIR/backup-db.sh" "$SCRIPT_DIR/backup-db.js" 2>/dev/null || true

# Strip any prior entry, then append fresh
( crontab -l 2>/dev/null | grep -v "$MARK" ; echo "$CRON_LINE $MARK" ) | crontab -
echo "Installed cron:"
crontab -l | grep "$MARK"
