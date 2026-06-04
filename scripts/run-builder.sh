#!/bin/bash
# TikiTaka Builder Agent — runs as the `agent` user on VPS
# Called by cron, skips during Shabbat.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKDIR="/home/agent/worldcup"
LOG="/home/agent/builder-$(date +%Y%m%d-%H%M).log"

# Shabbat check
if ! "$SCRIPT_DIR/shabbat-guard.sh"; then
  exit 0
fi

cd "$WORKDIR"

# Pull latest
git pull origin main --ff-only 2>/dev/null || true

# Load TG credentials for notification on failure
source /home/agent/.agent-factory/credentials.env

notify_tg() {
  curl -s "https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage" \
    -d "chat_id=${TG_CHAT_ID}" \
    -d "text=$1" > /dev/null 2>&1
}

# Run Claude in non-interactive mode with the builder prompt
timeout 1800 claude -p \
  --allowedTools 'Bash,Read,Write,Edit' \
  "You are the Builder agent for tikitaka.vip.

Read /home/agent/worldcup/.claude/roles/builder.md for your full role definition.
Then read SPRINT.md for your task queue and STANDUP.md for context from previous sessions.

Pick the highest-priority uncompleted B-* task, implement it, test it, and mark it done.
Update STANDUP.md with what you did.

After finishing, send a Telegram notification using:
  curl -s \"https://api.telegram.org/bot\${TG_BOT_TOKEN}/sendMessage\" -d \"chat_id=\${TG_CHAT_ID}\" -d \"text=YOUR_MESSAGE\"
where TG_BOT_TOKEN=${TG_BOT_TOKEN} and TG_CHAT_ID=${TG_CHAT_ID}

Git push your changes when done." \
  >> "$LOG" 2>&1

EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
  notify_tg "⚠️ Builder agent failed (exit $EXIT_CODE). Check $LOG"
fi
