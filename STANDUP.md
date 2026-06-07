# TikiTaka Standup Log

---

## 2026-06-07 Builder — QA pass (4 days to WC)
- **No code work to do, verified not assumed:** all 17 builder tickets in `review`/`done`; only `ready` tasks are operator-gated growth. Prod HEALTHY (`/health` 200, db:ok). Did NOT re-tread the backup task or invent work.
- **Spent the session on the one Builder-lane gap left: actually verifying the P0 features in `review`, not just trusting board state.** Ran server on a test port; smoke-tested live.
  - **Scoring consistency (the divergence-prone area in memory):** confirmed all 3 scoring sites are byte-identical — server `computeBoard()` (server.js:791), client `showPointsBreakdown()` (index.html:1257), client inline `earnedPts` (index.html:1758). Same base (5/3/2/0), same stage map (1..6, 3rd=4), same `min(odds,8)` cap. So the #2 breakdown modal total always equals the leaderboard points the server awards — no silent drift. Logged the sign-off as a progress comment on #2.
  - **Source attribution (#32/#33):** `/wa`→302 `/?ref=whatsapp`, `/tg`→`/?ref=telegram` verified live; `ref_source` written on google/pin/email signup paths; `/wa../ig../tw` redirects + `ref_visit` tracking present.
- **Did NOT touch scoring logic** (propose-wait per decision authority) — but flagged for future: the stage map + scoring rule is duplicated in 3 places; if anyone edits one multiplier pre-launch the others drift silently. Left as-is 4 days out (refactor risk > reward); worth consolidating post-tournament.
- **Next:** Nothing to build. Distribution (#14-17) + external uptime monitor (#3) remain the operator-gated critical path.

---

## 2026-06-07 Growth-Content (4 days to WC)
- **Verified state before acting:** all 6 growth-content tickets (#22-25, #30, #34) are already drafted and in `review`; #34 memes were rendered 06-07 (browser-side). No content task in `ready`/`in_progress`. Confirmed every P0 distribution channel already has paste-ready copy: #14→draft10 (WA), #15→draft11 (TG), #16→drafts12/13 (Reddit), #17→draft14 (FB) — all bundled in LAUNCH-KIT.md.
- **Closed the one real content gap:** #29 (Instagram story + reel, `ready` for growth-browser) had **zero copy and no comments** — the only distribution channel with nothing for the operator to post. Drafted paste-ready IG copy HE + EN (drafts #16-19): Reel caption + hashtags reusing the #23 video (drafts #3/#4), plus a 4-frame Story sequence (Hook → Poll → Countdown → Link sticker). Leads with the monkey hook; link in bio + Story link sticker (IG has no clickable caption link).
- **Honored the hard no-emdash rule:** normalized all em dashes to hyphens and re-saved (latest = drafts #18 HE / #19 EN). Left #29 status as `ready` — posting is growth-browser's lane.
- **Next:** All growth-content output is drafted and in review awaiting operator approval. Nothing else actionable in the content queue; distribution (operator-gated) remains the critical path.

---

## 2026-06-07 Builder (4 days to WC)
- **Verified launch-readiness (not just board state):** prod HEALTHY (`/health` 200, db:ok, both via tikitaka.vip and localhost). Builder queue is empty — all 17 builder tickets in `review`/`done`, the only `ready` tasks are growth-browser/content (operator-gated). No assigned code work.
- **Closed the recurrence of a real P0 data-loss gap (#4 backup).** The WAL-safe backup "silently stopped once" (gap Jun 5 02:00 → Jun 7 05:40). Root cause: the wrapper alerts TG on a *failed run* but is blind to *runs stopping* (a vanished cron line). Verified the live state first: cron daemon up (PID 914), line installed, daemon fired my own session, script works end-to-end (fresh WAL-consistent backup, players=20, predictions=939, integrity ok).
  - **Fix (commit `611295d`):** made `scripts/backup-db.sh` **self-healing** — each successful run re-asserts its own `# tikitaka-wal-backup` cron line (idempotent, no dupes) and TG-alerts if it had to self-heal. As long as it fires ≥daily it keeps itself scheduled across crontab resets. This is the agent-side script the live cron runs (`/home/agent/worldcup/...`), so it's effective immediately — no `/opt` deploy needed.
  - **Tested both paths:** normal run = quiet, line stays single; simulated a wiped line = self-heal re-installs it and crontab ends byte-identical to original (managed block intact). One "♻️ self-heal" TG alert was sent during that simulation (expected, not a real incident).
- **Still operator-only (unchanged, can't touch `/opt`):** external UptimeRobot→TG monitor (#3, steps in `scripts/UPTIME.md`); WAL-safe swap of the root `cp`-based `/opt` backup. The agent-side WAL backup is the working redundant safety net for the latter.
- **Next:** Nothing to build until tickets are reviewed/merged or new ones land. Distribution (#14-17) remains the whole game and is operator-gated.

---

## 2026-06-07 Product Owner (3 days to WC)
- **Evaluate:** Prod HEALTHY, local HEAD == prod HEAD == `325e5d4` (all builder review tickets are deployed; no code work remains). Real signal check: **20 players but only ~10 real humans** (rest are 🐒 monkey baselines + 1 tester), and just **+1 new signup since yesterday** (מיכאל 06-06). So the mass-distribution P0s (#14-17) still have NOT fired - this is friends-and-family scale, 3 days out. Bottleneck unchanged and operator-gated (laptop Chrome / personal accounts).
- **Acted autonomously (the differentiated value today):**
  - **Closed a real data-loss gap (#4):** the WAL-safe agent-side backup had silently stopped after Jun 5 02:00 (cron never persistently installed). Ran `scripts/backup-db.sh` -> fresh WAL-consistent backup (players=20, predictions=939) and installed the daily 02:00 cron. Reads `/opt` DB read-only, no sudo. Backup is no longer a launch blocker.
  - **Built LAUNCH-KIT.md (commit `ed6b4fe`):** instead of re-issuing the same 3-day-stale distribution order, removed the friction that's kept it stuck - consolidated all 6 channel drafts (#10-15) into one ROI-ordered, paste-top-to-bottom operator runbook. **Normalized 15 em dashes -> plain hyphens** across the copy (hard no-emdash rule; the EN/HE drafts all violated it). Makes the launch session a ~20-min copy-paste.
- **Decide/Order (decision format, 5 orders):** growth-browser critical path -> **#14 WhatsApp #1**, **#15 TG #2**, **#17 FB #3** (Reddit #16 + forums #19 next, all in the kit). Infra -> **#3 Uptime**: only remaining readiness item agents can't do (external UptimeRobot signup, ~5 min, steps in scripts/UPTIME.md).
- **Kill:** none. The 26 `review` tickets are the operator's QA gate; mass-closing erases it.
- **Escalated to operator (TG):** distribution is the whole game now - one 20-min session from LAUNCH-KIT.md. Plus the external uptime monitor. Backup is handled.

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
