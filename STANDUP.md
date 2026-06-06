# TikiTaka Standup Log

---

## 2026-06-06 Product Owner (4 days to WC)
- **Evaluate:** Verified launch-readiness, not just board status. Prod is HEALTHY and on the latest code — `/health` 200, prod `/opt` HEAD = origin/main `fd1801a`. So the 17 builder tickets sitting in `review` are already DEPLOYED; "review" is bookkeeping, not a deploy gap. No code work remains.
- **Decide/Order (7 orders, decision format):**
  - growth-browser (the critical path): **#14 WhatsApp #1**, **#15 TG #2**, **#16 Reddit #3** — owned channels first (zero approval latency, best conversion), copy already drafted (#10/#11/#12/#13). #17 FB next.
  - builder (operator handoffs — code done): **#3 Uptime** (operator must wire external UptimeRobot→TG; #1 readiness gap), **#4 Backup** (operator WAL-safe swap in /opt), **#21** scoring-card flat-vs-odds bonus = propose-wait operator decision (not a June-11 blocker).
  - growth-content: **#34 RE-SCOPED** — not VPS-executable (no ImageMagick / no image-gen API; templates need base images). Routed to browser via imgflip free tier + drafted captions (~15 min).
- **Kill:** none. All `review` tasks are legit shipped work behind the operator's QA gate; mass-closing would erase that gate.
- **Escalated to operator (TG):** UptimeRobot→TG monitor, WAL-safe backup swap, scoring-card bonus decision. Distribution posting (#14–17) is operator-triggered and is the only thing standing between done-code and signups.

## 2026-06-05 Builder (session 4)
- **Done:** Took #32/#33/#21 (set in_progress → review, pushed as 1b1d041). Mid-session another agent pushed `a2a9409` implementing the bulk of #32 (vanity redirects) + #33 (ref_source). Rebased onto it and layered only the genuinely-missing/value-add parts rather than duplicating:
  - **#32 — source logging (was missing):** a2a9409's `/wa /tg /fb /rd /ig /tw` routes only *redirected*; the ticket explicitly asks for *logging*. Added `track(req,'ref_visit',{source,route})` so every click is recorded → PO can measure channel **reach**, not just conversions. Verified `/wa → 302 /?ref=whatsapp` + analytics row.
  - **#33 — hardening:** core (column + capture on email/google/PIN signup) already landed; added `cleanRef()` to type-guard + cap the client `?ref=` at 64 chars before it hits `players.ref_source`. Verified a 100-char ref stored as len 64.
  - **#21 — shareable card (net-new):** `shareCard()` wires existing `/api/card/:id` into Web Share via a 📤 button in the post-prediction nudge. SVG→PNG (canvas) → `navigator.share({files})` when supported, falls back to text+link → clipboard. User-gesture triggered (keeps transient activation). i18n `nudge_share_card` he/en/pt.
- **Notes:** All HTTP tests ran on port 3999 against the dev clone; created + fully removed temp test players/groups/monkey + test analytics rows — dev DB restored to clean pre-launch state (0 players/groups/predictions). `node --check` clean on server.js + i18n.js; inline scripts parse-checked.
- **Blocked:** none for these. Still operator-only from prior sessions: UptimeRobot→TG monitor; WAL-safe `/opt` backup swap.
- **Next:** Queue empty again — all builder tickets in `review`. Awaiting review/merge or new tickets.

---

## 2026-06-05 Growth-Content (session 2)
- **Done:** My own content queue (#22–25, #30) was already drafted & in `review` earlier today, so I closed the real launch gap instead: the **P0 distribution channels (#14–17, #19)** had PO priority orders but **no copy** — the growth-browser agent had nothing to paste 6 days before kickoff. Drafted paste-ready, channel-tailored copy and saved 6 drafts via /api/drafts:
  - **#14 WhatsApp broadcast** (HE, draft #10) — copy-paste-&-forward, monkey hook + private-league CTA + 11.6 countdown.
  - **#15 Telegram channel/group** (HE, draft #11) — owned-audience one-two punch with #14 per PO order.
  - **#16 Reddit** — HE for r/Israel (#12) + EN for r/worldcup & r/soccer (#13); honest indie-project tone + "mods remove if not allowed" line.
  - **#17 Facebook IL sports groups** (HE, draft #14) — admin-courtesy line; space across runway per PO order.
  - **#19 Active forums** (EN, draft #15) — club-forum angle note + flag that forumfoot is French (needs translation).
  - Added a progress comment on each task pointing the browser agent to its draft.
- **Notes:** All copy leads with the monkey hook and includes https://tikitaka.vip. Did NOT change task status on #14–19 (those are growth-browser tickets). Content only — nothing posted. Drafting copy = "Do it" per SPRINT decision table.
- **Next:** Optional follow-ups if time: copy for P1 #26/#27/#28 (TG/Discord/WA-communities) and #29 (IG story/reel — overlaps existing #22/#23 creative). Otherwise awaiting operator review of all drafts.

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
