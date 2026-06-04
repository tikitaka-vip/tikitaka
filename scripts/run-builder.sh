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
ORDERS=$(curl -s "$BOARD/api/tasks?role=builder" -H "Authorization: Bearer $KEY" | python3 -c "
import sys,json
tasks = json.loads(sys.stdin.read())
for t in tasks:
    if t['status'] in ('ready','in_progress'):
        print(f\"Task #{t['id']}: {t['title']} [{t['priority']}]\")
" 2>/dev/null || echo "Could not parse tasks")

timeout 1800 claude -p \
  --allowedTools 'Bash,Read,Write,Edit' \
  "You are the Builder agent for tikitaka.vip — a World Cup 2026 prediction game.
Working directory: $WORKDIR (git clone, NOT production)
Production: /opt/worldcup/ (DO NOT modify directly)

## Your tasks (pick the highest P0 first)
$TASKS

## Instructions
1. Pick the top P0 task. If no P0s remain, pick top P1.
2. Set it to in_progress: curl -s '$BOARD/api/tasks/TASK_ID' -X PATCH -H 'Authorization: Bearer $KEY' -H 'Content-Type: application/json' -d '{\"status\":\"in_progress\"}'
3. Send heartbeats every ~10 minutes: curl -s '$BOARD/api/tasks/TASK_ID/heartbeat' -X POST -H 'Authorization: Bearer $KEY'
4. Implement the feature in $WORKDIR
5. Test locally (node server.js, check it works)
6. Add progress comment: curl -s '$BOARD/api/tasks/TASK_ID/comments' -X POST -H 'Authorization: Bearer $KEY' -H 'Content-Type: application/json' -d '{\"type\":\"progress\",\"content\":\"WHAT YOU DID\"}'
7. Set to review: curl -s '$BOARD/api/tasks/TASK_ID' -X PATCH -H 'Authorization: Bearer $KEY' -H 'Content-Type: application/json' -d '{\"status\":\"review\"}'
8. Git commit and push
9. If time remains, pick the next task

## If blocked
Add a blocker comment and set status to blocked:
curl -s '$BOARD/api/tasks/TASK_ID/comments' -X POST -H 'Authorization: Bearer $KEY' -H 'Content-Type: application/json' -d '{\"type\":\"blocker\",\"content\":\"WHAT IS BLOCKING\"}'

## Notify when done
curl -s 'https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage' -d 'chat_id=${TG_CHAT_ID}' -d 'text=Builder done: SUMMARY'

## Quality
- Ship working code, not perfect code (6-day sprint)
- Hebrew RTL must not break
- Mobile-first
- Test before marking review" \
  >> "$LOG" 2>&1
