#!/bin/bash
# TikiTaka Product Owner Agent — daily prioritization
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKDIR="/home/agent/worldcup"
LOG="/home/agent/po-$(date +%Y%m%d-%H%M).log"
BOARD="http://127.0.0.1:3001"
KEY="fabc46f625e746be5774bb848b000b9a"

if ! "$SCRIPT_DIR/shabbat-guard.sh"; then exit 0; fi

cd "$WORKDIR"
git pull origin main --ff-only 2>/dev/null || true

source /home/agent/.agent-factory/credentials.env

SUMMARY=$(curl -s "$BOARD/api/summary" -H "Authorization: Bearer $KEY" -H "Accept: text/markdown")
BUILDER_TASKS=$(curl -s "$BOARD/api/tasks?role=builder" -H "Authorization: Bearer $KEY" -H "Accept: text/markdown")
GROWTH_TASKS=$(curl -s "$BOARD/api/tasks?role=growth" -H "Authorization: Bearer $KEY" -H "Accept: text/markdown")

WC_START=$(date -d "2026-06-11" +%s)
NOW=$(date +%s)
DAYS_LEFT=$(( (WC_START - NOW) / 86400 ))

timeout 900 claude -p \
  --allowedTools 'Bash,Read' \
  "You are the Product Owner for tikitaka.vip — a World Cup 2026 prediction game.

DAYS TO WORLD CUP: $DAYS_LEFT

## Your job
Review the board state and write prioritization orders as comments on tasks.
You do NOT create new tasks. You do NOT write code. You reprioritize and unblock.

## Board summary
$SUMMARY

## Builder tasks
$BUILDER_TASKS

## Growth tasks
$GROWTH_TASKS

## Hard rules
- If days_remaining < 2: only P0 tasks matter. Comment on all P1/P2 builder tasks to skip.
- If a task has been in_progress for 2+ standups with no progress comment: escalate via TG.
- Always prioritize tasks that unblock the Growth agent.
- If a Growth channel shows 0 engagement after 2 days (check progress comments): deprioritize it.

## Actions
For each role, pick the top 3 tasks for today and add an 'order' comment explaining why.
Use curl to interact with the board:

# Add order comment:
curl -s '$BOARD/api/tasks/TASK_ID/comments' -X POST -H 'Authorization: Bearer $KEY' -H 'Content-Type: application/json' -d '{\"type\":\"order\",\"content\":\"YOUR ORDER\"}'

# Change priority:
curl -s '$BOARD/api/tasks/TASK_ID' -X PATCH -H 'Authorization: Bearer $KEY' -H 'Content-Type: application/json' -d '{\"priority\":\"p0\"}'

After writing orders, send a TG summary:
curl -s 'https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage' -d 'chat_id=${TG_CHAT_ID}' -d 'text=YOUR SUMMARY'" \
  >> "$LOG" 2>&1
