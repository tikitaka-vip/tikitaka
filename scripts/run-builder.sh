#!/bin/bash
# TikiTaka Builder Agent — implements features from the board
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKDIR="/home/agent/worldcup"
LOG="/home/agent/builder-$(date +%Y%m%d-%H%M).log"
BOARD="http://127.0.0.1:3001"
KEY="69ebbaa2edee338e7e08f3d83d48e38a"

if ! "$SCRIPT_DIR/shabbat-guard.sh"; then exit 0; fi

cd "$WORKDIR"
git pull origin main --ff-only 2>/dev/null || true

source /home/agent/.agent-factory/credentials.env

TASKS=$(curl -s "$BOARD/api/tasks?role=builder&status=ready" -H "Authorization: Bearer $KEY" -H "Accept: text/markdown")

# Write prompt to a temp file to avoid quoting hell
PROMPT_FILE=$(mktemp /tmp/builder-prompt-XXXX.md)
cat > "$PROMPT_FILE" << PROMPT_EOF
You are the Builder agent for tikitaka.vip — a World Cup 2026 prediction game.
Working directory: $WORKDIR (git clone, NOT production)
Production: /opt/worldcup/ (DO NOT modify directly)

## Your tasks (pick the highest P0 first)
$TASKS

## Board API
Base URL: $BOARD
Auth header: Authorization: Bearer $KEY

To update a task status:
curl -s "$BOARD/api/tasks/TASK_ID" -X PATCH -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d '{"status":"in_progress"}'

To add a progress comment:
curl -s "$BOARD/api/tasks/TASK_ID/comments" -X POST -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d '{"type":"progress","content":"WHAT YOU DID"}'

To send heartbeat (do this every ~10 min):
curl -s "$BOARD/api/tasks/TASK_ID/heartbeat" -X POST -H "Authorization: Bearer $KEY"

## Workflow
1. Pick the top P0 task
2. Set it to in_progress via the API
3. Implement the feature in $WORKDIR
4. Test locally (node server.js on a test port, verify it works)
5. Add a progress comment describing what you did
6. Set status to review
7. Git commit and push
8. DEPLOY: if the task is ready for production, run: sudo /opt/board/scripts/deploy-prod.sh
9. Set status to done (not review) if deployed and verified
10. If time remains, pick the next task

## If blocked
Set status to blocked and add a comment with type "blocker".

## When done
Send a Telegram notification:
curl -s "https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage" -d "chat_id=${TG_CHAT_ID}" -d "text=Builder done: SUMMARY_HERE"

## Capabilities
Read /home/agent/.claude/founder-os/capabilities.md to know what tools and services are available.

## Quality
- Ship working code, not perfect code
- Hebrew RTL must not break
- Mobile-first — most users are on phones
- Test before deploying
PROMPT_EOF

cat "$PROMPT_FILE" | timeout 1800 claude -p --dangerously-skip-permissions --mcp-config /home/agent/.claude/mcp-builder.json >> "$LOG" 2>&1
EXIT_CODE=$?

rm -f "$PROMPT_FILE"

if [ $EXIT_CODE -ne 0 ]; then
  curl -s "https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage" \
    -d "chat_id=${TG_CHAT_ID}" \
    -d "text=Builder agent failed (exit $EXIT_CODE). Check $LOG" > /dev/null 2>&1
fi
