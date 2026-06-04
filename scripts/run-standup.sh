#!/bin/bash
# TikiTaka Standup Digest — morning summary via Telegram
# Called by cron, skips during Shabbat.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKDIR="/home/agent/worldcup"

# Shabbat check
if ! "$SCRIPT_DIR/shabbat-guard.sh"; then
  exit 0
fi

cd "$WORKDIR"
git pull origin main --ff-only 2>/dev/null || true

source /home/agent/.agent-factory/credentials.env

# Count tasks
BUILDER_DONE=$(grep -c '\[x\] \*\*B-' SPRINT.md 2>/dev/null || echo 0)
BUILDER_TOTAL=$(grep -c '\*\*B-' SPRINT.md 2>/dev/null || echo 0)
GROWTH_DONE=$(grep -c '\[x\] \*\*G-' SPRINT.md 2>/dev/null || echo 0)
GROWTH_TOTAL=$(grep -c '\*\*G-' SPRINT.md 2>/dev/null || echo 0)

# Next uncompleted tasks
BUILDER_NEXT=$(grep '\[ \] \*\*B-' SPRINT.md | head -1 | sed 's/.*\*\*B-[0-9]*\*\* //' || echo "all done")
GROWTH_NEXT=$(grep '\[ \] \*\*G-' SPRINT.md | head -1 | sed 's/.*\*\*G-[0-9]*\*\* //' || echo "all done")

# Days to World Cup
WC_START=$(date -d "2026-06-11" +%s)
NOW=$(date +%s)
DAYS_LEFT=$(( (WC_START - NOW) / 86400 ))

# Last standup entries
LAST_STANDUP=$(tail -20 STANDUP.md 2>/dev/null || echo "No entries yet")

MSG="⚽ TikiTaka Sprint — ${DAYS_LEFT} days to World Cup
Builder: ${BUILDER_DONE}/${BUILDER_TOTAL} done (next: ${BUILDER_NEXT})
Growth: ${GROWTH_DONE}/${GROWTH_TOTAL} done (next: ${GROWTH_NEXT})"

curl -s "https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage" \
  -d "chat_id=${TG_CHAT_ID}" \
  -d "text=${MSG}" > /dev/null 2>&1
