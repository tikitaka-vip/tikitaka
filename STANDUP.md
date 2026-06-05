# TikiTaka Standup Log

---

## 2026-06-05 Builder (session 3)
- **Done:** Builder queue confirmed empty — all 14 builder tickets (B-1..B-13 + card API #31) are in `review`, nothing in `ready`/`in_progress`; only `ready` tasks left are growth-browser/content (not my role). Working tree clean, all pushed. Rather than re-run the boot smoke test (done twice already today), ran a **scoring-correctness audit** across the 4 scoring code paths ahead of launch:
  - `node --check` clean on server.js, notifications.js, email.js, monkey-oracle.js, scripts/backup-db.js.
  - **Match scoring is fully consistent** across `computeBoard()`, `calcPlayerPoints()`, and both client mirrors (`showPointsBreakdown`, `renderPredictions`): `round(base × stage × min(odds,8))`. ✓
  - **Found one divergence (tournament bonus only):** `computeBoard` (global leaderboard + shareable card) gives FLAT winner +30 / runner_up +15 / top_scorer +20; `calcPlayerPoints` (the in-app group leaderboard at `/api/groups/:id/leaderboard`, which is what the UI actually renders) multiplies winner & runner_up by `min(teamOdds/5, 20)`. → a player's shareable-card points/rank can differ from their in-app number.
- **Impact:** NOT a June-11 blocker — the divergence only appears once outright `actual_results` (winner/runner_up) are entered, i.e. tournament end. Pre-tournament both are identical.
- **Blocked / propose-wait:** Did **not** change it — scoring mechanics = "propose + wait" per SPRINT.md decision table. Operator call needed: should the shareable card match the group's odds-weighted bonus, or stay flat? (Also still open from prior sessions: operator-only UptimeRobot→TG monitor + WAL-safe `/opt` backup swap.)
- **Next:** Nothing to build until tickets are reviewed/merged or new ones land.

---

## 2026-06-05 Growth-Content
- **Done:** Drafted all 5 assigned content tickets and set each to `review` on the board (9 drafts total via /api/drafts):
  - **#22 Beat-the-monkey challenge** (HE+EN): WA/TG broadcast, story/status text, full FB/IG challenge post, 3 image briefs.
  - **#23 Short video** (HE+EN): 30s vertical, 7-shot storyboard table w/ timecodes + on-screen text + VO + production notes + caption.
  - **#24 Meme templates** (HE+EN): 10 templates (Drake, Two Buttons, Galaxy Brain, Distracted BF, This Is Fine, etc.) w/ captions, visual briefs, mid-tournament topical-swap plan.
  - **#25 Hebrew odds blog** (HE): ~3-min post explaining base×stage×odds with exact values from server.js + worked example (7 vs 30 pts) + strategy + monkey hook/CTA.
  - **#30 Twitter/X** (HE+EN): 3 standalone <280-char variants + a 3-tweet thread.
- **Notes:** All copy leads with the monkey hook and includes https://tikitaka.vip. Blog formula cross-checked against worldcup-scoring-formula memory + server.js. Content only — nothing posted.
- **Next:** Awaiting operator review/approval of drafts before publishing. P0 growth tasks (#14–20) are growth-browser, not content.

---

## 2026-06-05 Builder
- **Done:** Builder queue empty — all 14 tasks (B-1..B-13 + card API) still in `review`, nothing in `ready`/`in_progress`. No new code needed. Ran a full launch-readiness smoke test against `server.js` (test port 3999):
  - Server boots clean; notification scheduler starts.
  - `/health` → 200 `{status:ok, db:ok}`.
  - Homepage → 200 (123 KB); contains onboarding/theme/confetti/skeleton markers.
  - `/api/leaderboard`, `/api/matches`, `/api/players` → 200 (DB has 104 matches, 0 players yet — empty board is expected pre-launch).
  - Graceful 404 verified both ways: HTML for browser routes, `{"error":"Not found"}` JSON for `/api/*`.
  - Card API: inserted a temp player → `/api/card/:id` returns a 1200×630 `image/svg+xml`, `?format=json` returns JSON; temp player cleaned up. Working tree clean.
- **Blocked (still, operator-only — cannot touch `/opt`):** (1) external UptimeRobot monitor → TG (see `scripts/UPTIME.md`); (2) switch root `/opt/worldcup/backup.sh` from `cp` to the WAL-safe `scripts/backup-db.js`. Both unchanged since 06-04.
- **Next:** Nothing to build until tasks are reviewed/merged or new tickets land. Growth queue is unassigned to Builder.

---

## 2026-06-04 Builder
- **Done:** Cleared the entire Builder queue — all P0, P1 and P2 tasks (14 total), each committed + pushed to origin/main and set to `review` on the board:
  - B-1 Onboarding: 3-step "How to play" modal (first-login, reopenable, RTL, i18n).
  - B-2 Points breakdown: click the +pts pill → modal showing base × stage × odds = total (matches server formula exactly).
  - B-3 Uptime: `/health` (+`/healthz`) endpoint (200/ok, 503 on DB down, rate-limit-free) + `scripts/UPTIME.md` for UptimeRobot.
  - B-4 DB backup: **found existing cp-based backup is NOT WAL-safe** (data-loss risk). Added WAL-consistent `scripts/backup-db.js` (online backup API + integrity check + gzip + rotate) on a daily agent cron.
  - B-5 Notification badge: red unpredicted-count badge on the Predictions tab.
  - B-6 Loading skeleton on first match load.
  - B-7 Auto-fetch odds daily (existing scheduler only fetched scores).
  - B-8 Edit knockout names: UI already existed — **fixed missing admin auth on `update-teams` + `odds` endpoints** (was open to anyone).
  - B-9 Graceful 404/500 error pages (HTML for browser, JSON for /api).
  - B-10 Rate limiting already worked; added Retry-After + X-RateLimit headers.
  - B-11 Animated score reveal. B-12 Confetti on exact prediction. B-13 Dark/light theme toggle.
  - B-31 Shareable prediction card API (`/api/card/:playerId` → SVG or JSON); refactored leaderboard into shared `computeBoard()`.
- **Blocked:** Two items need operator (cannot touch `/opt` as agent): (1) set up the external UptimeRobot monitor → TG, (2) switch root `/opt/worldcup/backup.sh` from `cp` to the WAL-safe method. Both documented.
- **Next:** Queue empty. Awaiting review/merge of the `review`-state tasks; Growth queue is unassigned to Builder.
