#!/usr/bin/env bash
###############################################################################
# growth-worker.sh — autonomous growth-browser daemon (LAPTOP-SIDE)
#
# Runs on the dedicated browser laptop (NOT the VPS). It polls the TikiTaka
# task board for `growth-browser` tasks and executes them through persona
# Chrome profiles, with ADB-based IP rotation between tasks.
#
# >>> THIS SCRIPT HAS NOT BEEN TESTED END-TO-END ON THE LAPTOP <<<
# The shell control flow (shabbat guard, board polling/parsing, logging,
# Telegram, CDP-vs-LLM routing, --self-test) was verified on the VPS with the
# browser/ADB steps stubbed. The browser launch, ADB airplane-mode toggle,
# CDP scripts and `claude -p` invocation must be smoke-tested on the laptop
# (start with DRY_RUN=1, then RUN_ONCE=1) before leaving it unattended.
#
# The loop (per task spec B-17 / #35):
#   1. Shabbat guard      — skip while it is Shabbat in Israel
#   2. Poll board         — next ready growth-browser task (top priority)
#   3. No task            — sleep IDLE_SLEEP, retry
#   4. Rotate IP          — ADB airplane-mode toggle on USB-tethered Android
#   5. Claim task         — set in_progress, read persona/platform
#   6. Launch Chrome      — persona profile, stealth fingerprint
#   7. Execute            — CDP script if one exists & enabled, else `claude -p`
#   8. Update board       — status + progress/blocker comment
#   9. Close Chrome
#  10. Loop
#
# IMPORTANT (board order #119, P0): all browser interaction MUST go through the
# human-behavior layer (applyStealthProfile + createHumanBehavior + human.idle).
# The legacy raw-WS CDP scripts in social-publisher/scripts are detection-prone,
# so this daemon defaults to the `claude -p` path (ALLOW_LEGACY_CDP=0).
#
# Run as: tmux new -s growth-worker './growth-worker.sh'   (or the systemd unit
# in scripts/growth-worker.service). See scripts/GROWTH-WORKER.md for setup.
###############################################################################

set -uo pipefail   # NOT -e: a single failed task must never kill the daemon

# ─── Configuration (override via env) ────────────────────────────────────────
BOARD_URL="${BOARD_URL:-http://127.0.0.1:3001}"            # reachable board endpoint (SSH tunnel or public domain on the laptop)
BOARD_KEY="${BOARD_KEY:-735ab3d149839deadb70b19455e6a7b5}" # growth-browser role key
BOARD_ROLE="${BOARD_ROLE:-growth-browser}"

AGENT_FACTORY_DIR="${AGENT_FACTORY_DIR:-$HOME/.agent-factory}"
CREDS_FILE="${CREDS_FILE:-$AGENT_FACTORY_DIR/credentials.env}"
LAUNCH_BROWSER_DIR="${LAUNCH_BROWSER_DIR:-$HOME/projects/agent-factory}"   # dir containing src/launch-browser.ts
SHABBAT_GUARD="${SHABBAT_GUARD:-$HOME/projects/worldcup/scripts/shabbat-guard.sh}"
CDP_SCRIPTS_DIR="${CDP_SCRIPTS_DIR:-$HOME/projects/social-publisher/scripts}"
MCP_CONFIG="${MCP_CONFIG:-$(dirname "$0")/growth-browser-mcp.json}"

LOG="${LOG:-$HOME/growth-worker.log}"
IDLE_SLEEP="${IDLE_SLEEP:-300}"          # seconds to sleep when no task is ready
ERROR_BACKOFF="${ERROR_BACKOFF:-120}"    # seconds to back off after an unexpected error
TASK_TIMEOUT="${TASK_TIMEOUT:-1800}"     # max seconds per task (claude -p / CDP)
ADB_SETTLE="${ADB_SETTLE:-25}"           # seconds to wait for mobile data to reconnect

# Safety toggles
DRY_RUN="${DRY_RUN:-0}"                   # 1 = log actions, touch nothing external (no board writes, no browser)
RUN_ONCE="${RUN_ONCE:-0}"                 # 1 = process at most one task then exit
ALLOW_LEGACY_CDP="${ALLOW_LEGACY_CDP:-0}" # 1 = allow raw-WS CDP scripts (detection-prone; see #119)
REQUIRE_IP_ROTATION="${REQUIRE_IP_ROTATION:-0}" # 1 = skip task if IP rotation fails; 0 = warn & continue
ADB_SERIAL="${ADB_SERIAL:-}"             # optional: target a specific adb device serial

CHROME_PID=""

# ─── Logging & notifications ─────────────────────────────────────────────────
ts()  { date '+%Y-%m-%d %H:%M:%S'; }
log() { echo "[$(ts)] $*" | tee -a "$LOG"; }

tg_notify() {
  # Best-effort Telegram ping to the operator. Never fail the daemon on this.
  local msg="$1"
  [ "$DRY_RUN" = "1" ] && { log "DRY_RUN tg_notify: $msg"; return 0; }
  [ -z "${TG_BOT_TOKEN:-}" ] && { log "WARN: TG_BOT_TOKEN unset, cannot notify: $msg"; return 0; }
  curl -s --max-time 15 "https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TG_CHAT_ID:-}" \
    --data-urlencode "text=[growth-worker] $msg" >/dev/null 2>&1 || true
}

# ─── Cleanup ─────────────────────────────────────────────────────────────────
close_chrome() {
  if [ -n "$CHROME_PID" ] && kill -0 "$CHROME_PID" 2>/dev/null; then
    log "Closing Chrome (pid $CHROME_PID)"
    kill "$CHROME_PID" 2>/dev/null || true
    sleep 2
    kill -9 "$CHROME_PID" 2>/dev/null || true
  fi
  CHROME_PID=""
}

cleanup() { log "Shutting down growth-worker"; close_chrome; }
trap cleanup EXIT
trap 'log "Received INT/TERM"; exit 0' INT TERM

# ─── Preflight ───────────────────────────────────────────────────────────────
preflight() {
  local missing=0
  for bin in curl python3; do
    command -v "$bin" >/dev/null 2>&1 || { log "FATAL: '$bin' not found in PATH"; missing=1; }
  done
  # adb / claude / npx are only needed for the live path; warn but don't abort.
  for bin in adb claude npx; do
    command -v "$bin" >/dev/null 2>&1 || log "WARN: '$bin' not found in PATH (needed for live browser tasks)"
  done
  [ -f "$CREDS_FILE" ] && set -a && . "$CREDS_FILE" && set +a || log "WARN: creds file $CREDS_FILE not found — TG notifications disabled"
  [ -x "$SHABBAT_GUARD" ] || log "WARN: shabbat guard not executable at $SHABBAT_GUARD — Shabbat checks will be skipped"
  [ "$missing" -eq 1 ] && return 1
  return 0
}

# ─── Shabbat guard ───────────────────────────────────────────────────────────
is_shabbat() {
  [ -x "$SHABBAT_GUARD" ] || return 1   # no guard → never block
  if "$SHABBAT_GUARD" >/dev/null 2>&1; then
    return 1   # exit 0 = not shabbat
  else
    return 0   # exit non-zero = shabbat
  fi
}

# ─── Board API ───────────────────────────────────────────────────────────────
# Echo the JSON of the single highest-priority ready task, or empty if none.
next_task() {
  local json
  json=$(curl -s --max-time 20 "$BOARD_URL/api/tasks?role=$BOARD_ROLE&status=ready" \
           -H "Authorization: Bearer $BOARD_KEY" 2>/dev/null) || return 1
  printf '%s' "$json" | python3 -c '
import sys, json
try:
    tasks = json.load(sys.stdin)
except Exception:
    sys.exit(0)
if not isinstance(tasks, list) or not tasks:
    sys.exit(0)
rank = {"p0": 0, "p1": 1, "p2": 2}
tasks.sort(key=lambda t: (rank.get(t.get("priority", "p2"), 9), t.get("id", 0)))
print(json.dumps(tasks[0]))
' 2>/dev/null
}

task_field() { printf '%s' "$1" | python3 -c "import sys,json;print(json.load(sys.stdin).get('$2',''))" 2>/dev/null; }

board_patch_status() {
  local id="$1" status="$2"
  [ "$DRY_RUN" = "1" ] && { log "DRY_RUN board: task #$id -> $status"; return 0; }
  curl -s --max-time 20 "$BOARD_URL/api/tasks/$id" -X PATCH \
    -H "Authorization: Bearer $BOARD_KEY" -H "Content-Type: application/json" \
    -d "{\"status\":\"$status\"}" >/dev/null 2>&1 || log "WARN: failed to set task #$id -> $status"
}

board_comment() {
  local id="$1" type="$2" content="$3"
  [ "$DRY_RUN" = "1" ] && { log "DRY_RUN board: comment #$id [$type]: $content"; return 0; }
  local payload
  payload=$(python3 -c 'import json,sys; print(json.dumps({"type":sys.argv[1],"content":sys.argv[2]}))' "$type" "$content")
  curl -s --max-time 20 "$BOARD_URL/api/tasks/$id/comments" -X POST \
    -H "Authorization: Bearer $BOARD_KEY" -H "Content-Type: application/json" \
    -d "$payload" >/dev/null 2>&1 || log "WARN: failed to comment on task #$id"
}

board_heartbeat() {
  local id="$1"
  [ "$DRY_RUN" = "1" ] && return 0
  curl -s --max-time 15 "$BOARD_URL/api/tasks/$id/heartbeat" -X POST \
    -H "Authorization: Bearer $BOARD_KEY" >/dev/null 2>&1 || true
}

# ─── IP rotation (ADB airplane-mode toggle) ──────────────────────────────────
adb_cmd() { if [ -n "$ADB_SERIAL" ]; then adb -s "$ADB_SERIAL" "$@"; else adb "$@"; fi; }

current_ip() { curl -s --max-time 15 https://api.ipify.org 2>/dev/null; }

rotate_ip() {
  if [ "$DRY_RUN" = "1" ]; then log "DRY_RUN rotate_ip: would toggle airplane mode"; return 0; fi
  command -v adb >/dev/null 2>&1 || { log "WARN: adb missing, cannot rotate IP"; return 1; }
  if ! adb_cmd get-state >/dev/null 2>&1; then
    log "WARN: no ADB device connected, cannot rotate IP"; return 1
  fi
  local before; before=$(current_ip)
  log "Rotating IP (current: ${before:-unknown})"
  # Toggle airplane mode ON then OFF. cmd connectivity is the modern path;
  # fall back to the settings+broadcast method for older Android.
  if ! adb_cmd shell cmd connectivity airplane-mode enable >/dev/null 2>&1; then
    adb_cmd shell settings put global airplane_mode_on 1 >/dev/null 2>&1
    adb_cmd shell am broadcast -a android.intent.action.AIRPLANE_MODE --ez state true >/dev/null 2>&1
  fi
  sleep 5
  if ! adb_cmd shell cmd connectivity airplane-mode disable >/dev/null 2>&1; then
    adb_cmd shell settings put global airplane_mode_on 0 >/dev/null 2>&1
    adb_cmd shell am broadcast -a android.intent.action.AIRPLANE_MODE --ez state false >/dev/null 2>&1
  fi
  sleep "$ADB_SETTLE"
  local after; after=$(current_ip)
  if [ -n "$after" ] && [ "$after" != "$before" ]; then
    log "IP rotated: ${before:-?} -> $after"; return 0
  fi
  log "WARN: IP did not change (before=${before:-?} after=${after:-?})"; return 1
}

# ─── Execution: CDP-script-first, else claude -p ─────────────────────────────
# Map a task to a known CDP script by keyword. Returns the script path on stdout
# if one exists AND legacy CDP is enabled, else nothing.
cdp_script_for() {
  [ "$ALLOW_LEGACY_CDP" = "1" ] || return 0
  [ -d "$CDP_SCRIPTS_DIR" ] || return 0
  local hay; hay=$(printf '%s %s' "$1" "$2" | tr '[:upper:]' '[:lower:]')
  local key=""
  case "$hay" in
    *pinterest*) key="pinterest" ;;
    *mastodon*)  key="mastodon"  ;;
    *tumblr*)    key="tumblr"    ;;
    *) return 0 ;;
  esac
  # Prefer a signup-<key>.js, fall back to <key>.js
  for cand in "signup-$key" "$key"; do
    if [ -f "$CDP_SCRIPTS_DIR/$cand.js" ]; then
      printf '%s' "$CDP_SCRIPTS_DIR/$cand.js"; return 0
    fi
  done
}

run_cdp_script() {
  local script="$1" id="$2"
  log "Running CDP script: $script (task #$id)"
  if [ "$DRY_RUN" = "1" ]; then log "DRY_RUN: would run node $script"; return 0; fi
  timeout "$TASK_TIMEOUT" node "$script" >>"$LOG" 2>&1
}

run_claude() {
  # Hand the full task to claude -p with the growth-browser MCP config. The
  # prompt mandates the human-behavior layer for every interaction (#119).
  local task_json="$1" id="$2"
  local title desc
  title=$(task_field "$task_json" title)
  desc=$(task_field "$task_json" description)

  local prompt
  prompt=$(cat <<EOF
You are the growth-browser agent for tikitaka.vip (World Cup 2026 prediction game).
A persona Chrome instance is already open and controllable. Complete this board task:

TASK #$id: $title
$desc

CRITICAL browser rules (do not skip — platforms ban personas that look like bots):
- Call the browser_setup_guide MCP tool first and follow the pattern it returns.
- After opening EACH page, call applyStealthProfile(page, profile).
- Do ALL clicks/typing/scrolling via createHumanBehavior(page, fingerprint) —
  NEVER page.click()/page.type()/raw CDP. Call human.idle() between actions.
- Pick the right persona + account from ~/.agent-factory/agents/tikitaka_vip/accounts.json.

When finished, report the outcome by updating the board yourself:
- Success: POST a progress comment then set status=review.
- Hard block (CAPTCHA / account not approved / needs operator): POST a blocker
  comment, set status=blocked, and print a line starting with "CAPTCHA_BLOCK:"
  or "OPERATOR_BLOCK:" so the daemon can notify the operator.
Board base: $BOARD_URL   Auth: Bearer $BOARD_KEY   Task id: $id
EOF
)

  if [ "$DRY_RUN" = "1" ]; then
    log "DRY_RUN: would run claude -p for task #$id (prompt $(printf '%s' "$prompt" | wc -c) bytes)"
    return 0
  fi

  local mcp_args=()
  [ -f "$MCP_CONFIG" ] && mcp_args=(--mcp-config "$MCP_CONFIG") || log "WARN: MCP config $MCP_CONFIG missing"

  AGENT_ROLE=growth-browser timeout "$TASK_TIMEOUT" \
    claude -p --dangerously-skip-permissions \
      "${mcp_args[@]}" \
      --allowedTools 'Bash,Read,Write,Edit' \
      "$prompt" 2>&1 | tee -a "$LOG"
}

# ─── Process one task ────────────────────────────────────────────────────────
process_task() {
  local task_json="$1"
  local id title desc
  id=$(task_field "$task_json" id)
  title=$(task_field "$task_json" title)
  desc=$(task_field "$task_json" description)
  [ -z "$id" ] && { log "WARN: task has no id, skipping"; return 1; }

  log "=== Task #$id: $title ==="
  board_patch_status "$id" in_progress
  board_heartbeat "$id"

  # 4. Rotate IP
  if ! rotate_ip; then
    if [ "$REQUIRE_IP_ROTATION" = "1" ]; then
      log "IP rotation required but failed — releasing task #$id back to ready"
      board_comment "$id" progress "growth-worker: IP rotation failed, requeued."
      board_patch_status "$id" ready
      return 1
    fi
    log "Proceeding without IP rotation (REQUIRE_IP_ROTATION=0)"
  fi

  # 6. Launch persona Chrome.
  # NOTE: launch-browser.ts is interactive/long-lived on the laptop; the actual
  # persona selection + page driving happens inside the CDP script or claude -p
  # session (which connects to the launched instance). We start it detached and
  # let the executor attach. Persona slug is chosen by the executor from accounts.json.
  if [ "$DRY_RUN" != "1" ] && command -v npx >/dev/null 2>&1 && [ -d "$LAUNCH_BROWSER_DIR" ]; then
    log "Launching persona Chrome via launch-browser.ts"
    ( cd "$LAUNCH_BROWSER_DIR" && npx tsx src/launch-browser.ts >>"$LOG" 2>&1 ) &
    CHROME_PID=$!
    sleep 8   # give Chrome/CDP time to come up
  else
    log "Skipping browser launch (DRY_RUN or launch-browser dir/npx unavailable)"
  fi
  board_heartbeat "$id"

  # 7. Execute: CDP-first (if enabled), else claude -p
  local rc=0 out_file
  out_file=$(mktemp 2>/dev/null || echo /tmp/growth-worker-out.$$)
  local cdp; cdp=$(cdp_script_for "$title" "$desc")
  if [ -n "$cdp" ]; then
    log "Routing task #$id -> CDP script (legacy path enabled)"
    run_cdp_script "$cdp" "$id" | tee "$out_file"; rc=${PIPESTATUS[0]}
  else
    log "Routing task #$id -> claude -p (human-behavior path)"
    run_claude "$task_json" "$id" | tee "$out_file"; rc=${PIPESTATUS[0]}
  fi
  board_heartbeat "$id"

  # 8. Interpret outcome / detect blocks the executor may have hit.
  if grep -qiE 'CAPTCHA_BLOCK:|captcha|recaptcha|hcaptcha' "$out_file" 2>/dev/null; then
    log "CAPTCHA / block detected on task #$id"
    board_comment "$id" blocker "growth-worker: CAPTCHA / verification wall hit — needs operator."
    board_patch_status "$id" blocked
    tg_notify "CAPTCHA on task #$id ($title) — needs operator"
  elif grep -qiE 'OPERATOR_BLOCK:' "$out_file" 2>/dev/null; then
    log "Operator block on task #$id"
    tg_notify "Task #$id ($title) blocked — needs operator"
  elif [ "$rc" -eq 124 ]; then
    log "Task #$id timed out after ${TASK_TIMEOUT}s"
    board_comment "$id" blocker "growth-worker: timed out after ${TASK_TIMEOUT}s."
    board_patch_status "$id" blocked
    tg_notify "Task #$id ($title) timed out"
  elif [ "$rc" -ne 0 ]; then
    log "Task #$id executor exited rc=$rc"
    board_comment "$id" progress "growth-worker: executor exited rc=$rc (see laptop log)."
    # leave whatever status the executor set; notify so a human can look
    tg_notify "Task #$id ($title) executor error rc=$rc"
  else
    log "Task #$id completed (executor rc=0). Executor is responsible for final board status."
    # For the CDP path (no self-reporting), mark review so a human verifies.
    if [ -n "$cdp" ]; then
      board_comment "$id" progress "growth-worker: ran CDP script $cdp (no LLM). Needs human verify."
      board_patch_status "$id" review
    fi
  fi

  rm -f "$out_file" 2>/dev/null || true
  close_chrome
  return 0
}

# ─── Main loop ───────────────────────────────────────────────────────────────
main_loop() {
  log "growth-worker starting (board=$BOARD_URL role=$BOARD_ROLE dry_run=$DRY_RUN once=$RUN_ONCE legacy_cdp=$ALLOW_LEGACY_CDP)"
  tg_notify "growth-worker online"
  while true; do
    if is_shabbat; then
      log "Shabbat — sleeping 1h"
      sleep 3600
      continue
    fi

    local task_json
    task_json=$(next_task)
    if [ -z "$task_json" ]; then
      log "No ready $BOARD_ROLE task — sleeping ${IDLE_SLEEP}s"
      sleep "$IDLE_SLEEP"
      continue
    fi

    process_task "$task_json" || { log "process_task error — backing off ${ERROR_BACKOFF}s"; sleep "$ERROR_BACKOFF"; }

    if [ "$RUN_ONCE" = "1" ]; then
      log "RUN_ONCE set — exiting after one task"
      break
    fi
    sleep 5
  done
}

# ─── Self-test (VPS-safe) ────────────────────────────────────────────────────
# Exercises preflight, shabbat guard, board polling/parsing and routing WITHOUT
# touching the browser, ADB, or writing to the board. Run: ./growth-worker.sh --self-test
self_test() {
  echo "── growth-worker self-test ──"
  preflight && echo "PASS preflight" || echo "FAIL preflight"
  if is_shabbat; then echo "INFO shabbat guard: currently Shabbat"; else echo "PASS shabbat guard: not Shabbat"; fi
  local t; t=$(next_task)
  if [ -n "$t" ]; then
    echo "PASS next_task: #$(task_field "$t" id) [$(task_field "$t" priority)] $(task_field "$t" title)"
    local c; c=$(cdp_script_for "$(task_field "$t" title)" "$(task_field "$t" description)")
    echo "INFO routing: ${c:-claude -p (human-behavior path)}"
  else
    echo "INFO next_task: no ready $BOARD_ROLE task right now"
  fi
  echo "INFO routing matrix (ALLOW_LEGACY_CDP=$ALLOW_LEGACY_CDP):"
  for s in "signup on pinterest" "post to mastodon" "reddit thread" "tumblr blog"; do
    local route; route=$(cdp_script_for "$s" "")
    echo "   '$s' -> ${route:-claude -p}"
  done
  echo "── self-test done ──"
}

# ─── Entrypoint ──────────────────────────────────────────────────────────────
case "${1:-}" in
  --self-test) self_test ;;
  --once)      RUN_ONCE=1; preflight || exit 1; main_loop ;;
  --help|-h)
    grep -E '^#( |!)' "$0" | sed 's/^# \{0,1\}//' | head -45 ;;
  *)
    preflight || { log "FATAL: preflight failed"; exit 1; }
    main_loop ;;
esac
