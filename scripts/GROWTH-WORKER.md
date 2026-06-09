# growth-worker — autonomous growth-browser daemon (LAPTOP-SIDE)

`growth-worker.sh` runs on the **dedicated browser laptop** (not the VPS). It
polls the TikiTaka board for `growth-browser` tasks and executes them through
persona Chrome profiles, rotating the mobile IP between tasks.

> ⚠️ **Not yet tested end-to-end on the laptop.** The shell control flow
> (shabbat guard, board polling/parsing, priority sort, CDP-vs-LLM routing,
> Telegram, dry-run) was verified on the VPS with the browser/ADB steps
> stubbed. The browser launch, ADB airplane-mode toggle, CDP scripts and
> `claude -p` invocation must still be smoke-tested on the laptop.

## The loop
1. **Shabbat guard** — skip while it is Shabbat in Israel.
2. **Poll board** — `GET /api/tasks?role=growth-browser&status=ready`, pick the
   highest-priority lowest-id task.
3. No task → sleep `IDLE_SLEEP` (default 5 min), retry.
4. **Rotate IP** — toggle airplane mode on the USB-tethered Android via ADB.
5. **Claim** — set task `in_progress`, heartbeat.
6. **Launch Chrome** — persona profile via `launch-browser.ts` (stealth).
7. **Execute** — a known CDP script *(only if `ALLOW_LEGACY_CDP=1`)*, else
   `claude -p` with the growth-browser MCP config.
8. **Update board** — status + progress/blocker comment.
9. Close Chrome, loop.

## ⚠️ Human-behavior layer is mandatory (board order #119)
All browser interaction must go through `applyStealthProfile` +
`createHumanBehavior` + `human.idle()` — never `page.click()`/raw CDP. The
legacy raw-WS scripts in `social-publisher/scripts/` are detection-prone, so the
daemon **defaults to the `claude -p` path** (`ALLOW_LEGACY_CDP=0`). The prompt
handed to `claude -p` instructs it to call the `browser_setup_guide` MCP tool
and use the human-behavior layer for everything. Only flip `ALLOW_LEGACY_CDP=1`
once those scripts have been wrapped in the human-behavior layer.

## First-run checklist (on the laptop)
1. Place this repo's `scripts/` on the laptop (or symlink), then set the paths
   below to the laptop layout (they default to `$HOME/projects/...`).
2. Edit `growth-browser-mcp.json`: point `args` at the laptop's
   `mcp-agent-factory.js` and `env` paths at the laptop's agent-factory dir.
   Keep `AGENT_ROLE=growth-browser`.
3. Make sure `node`, `adb`, `chrome`, `npx`, and an authenticated `claude` CLI
   are on PATH. Confirm `adb devices` shows the tethered phone.
4. Ensure `BOARD_URL` reaches the VPS board (SSH tunnel or public domain).
5. Smoke test, escalating safety off:
   ```sh
   ./growth-worker.sh --self-test           # read-only: preflight + poll + routing
   DRY_RUN=1 ./growth-worker.sh --once       # full flow, no external side effects
   RUN_ONCE=1 ./growth-worker.sh             # process exactly one real task
   ```
6. Run for real under tmux or systemd:
   ```sh
   tmux new -s growth-worker './growth-worker.sh'
   # or: systemctl --user enable --now growth-worker   (see growth-worker.service)
   ```

## Configuration (env vars, with defaults)
| Var | Default | Meaning |
|---|---|---|
| `BOARD_URL` | `http://127.0.0.1:3001` | Reachable board endpoint |
| `BOARD_KEY` | growth-browser role key | Bearer token |
| `LAUNCH_BROWSER_DIR` | `$HOME/projects/agent-factory` | dir with `src/launch-browser.ts` |
| `SHABBAT_GUARD` | `$HOME/projects/worldcup/scripts/shabbat-guard.sh` | guard script |
| `CDP_SCRIPTS_DIR` | `$HOME/projects/social-publisher/scripts` | legacy CDP scripts |
| `MCP_CONFIG` | `<script dir>/growth-browser-mcp.json` | claude -p MCP config |
| `LOG` | `$HOME/growth-worker.log` | log file |
| `IDLE_SLEEP` | `300` | sleep when no task |
| `TASK_TIMEOUT` | `1800` | max seconds per task |
| `ADB_SETTLE` | `25` | wait for mobile data to reconnect |
| `ADB_SERIAL` | (empty) | target a specific adb device |
| `DRY_RUN` | `0` | log actions, touch nothing external |
| `RUN_ONCE` | `0` | process one task then exit |
| `ALLOW_LEGACY_CDP` | `0` | allow raw-WS CDP scripts (detection-prone) |
| `REQUIRE_IP_ROTATION` | `0` | requeue task if IP rotation fails |

## Notifications
Telegram (`TG_BOT_TOKEN`/`TG_CHAT_ID` from `credentials.env`) is pinged on
CAPTCHA/operator blocks, timeouts, executor errors, and startup. CAPTCHAs always
need a human — the daemon marks the task `blocked` and notifies.
