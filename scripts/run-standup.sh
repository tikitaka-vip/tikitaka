#!/bin/bash
# TikiTaka Standup Digest — morning TG summary from board
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BOARD="http://127.0.0.1:3001"
KEY="3845b31f77fe61488d954ee991941b4e"

if ! "$SCRIPT_DIR/shabbat-guard.sh"; then exit 0; fi

source /home/agent/.agent-factory/credentials.env

SUMMARY=$(curl -s "$BOARD/api/summary" -H "Authorization: Bearer $KEY")

READY=$(echo "$SUMMARY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(sum(r['count'] for r in d['byStatus'] if r['status']=='ready'))" 2>/dev/null || echo "?")
IN_PROGRESS=$(echo "$SUMMARY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(sum(r['count'] for r in d['byStatus'] if r['status']=='in_progress'))" 2>/dev/null || echo "?")
REVIEW=$(echo "$SUMMARY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(sum(r['count'] for r in d['byStatus'] if r['status']=='review'))" 2>/dev/null || echo "?")
DONE=$(echo "$SUMMARY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(sum(r['count'] for r in d['byStatus'] if r['status']=='done'))" 2>/dev/null || echo "?")
BLOCKED=$(echo "$SUMMARY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(sum(r['count'] for r in d['byStatus'] if r['status']=='blocked'))" 2>/dev/null || echo "?")
STALE=$(echo "$SUMMARY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(sum(r['count'] for r in d['byStatus'] if r['status']=='stale'))" 2>/dev/null || echo "0")

WC_START=$(date -d "2026-06-11" +%s)
NOW=$(date +%s)
DAYS_LEFT=$(( (WC_START - NOW) / 86400 ))

STALE_WARNING=""
if [ "$STALE" != "0" ] && [ "$STALE" != "?" ]; then
  STALE_WARNING="⚠️ $STALE stale task(s) — possible crash"
fi

MSG="⚽ TikiTaka Sprint — ${DAYS_LEFT} days to World Cup
✅ Done: $DONE | 🔄 In progress: $IN_PROGRESS | 📋 Ready: $READY
🔍 Review: $REVIEW | 🚫 Blocked: $BLOCKED
${STALE_WARNING}
Board: https://tikitaka.vip/board/?key=de54399319f86db3d46869562479f042"

curl -s "https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage" \
  -d "chat_id=${TG_CHAT_ID}" \
  -d "text=${MSG}" > /dev/null 2>&1
