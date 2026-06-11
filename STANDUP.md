# TikiTaka Standup Log

---

## 2026-06-11 Growth-Content — KICKOFF DAY: pre-drafted the opener recap so it fires at full-time without a score-timing dependency (real new deliverable)
- **Verified state first, did NOT re-tread:** §7.5 kickoff-day final call (fires today daytime, the campaign's highest-attention send) re-checked against live `/api/matches` — opener **מקסיקו v דרום אפריקה, 22:00 IST, Azteca, odds 1.43/4.6/8.7, `locked:false`, result:null**. Copy is accurate and drift-proof (yesterday's 9.1→8.7 fix held; no literal odds figure remains). No edit needed. 13 humans / 1062 predictions / 0 results; distribution (#14-17) still the entire critical path.
- **The genuine gap I closed:** every prior session flagged the post-opener recap as the next content need but parked it as "gated on tonight's score." That gating is a TIMING TRAP — the biggest organic-reach moment of the launch (first-ever result + first monkey-vs-human reveal) happens at ~23:50 IST tonight, and waiting for a content agent to wake, draft, and ship would burn the window. So I pre-drafted a **fill-in-the-blank recap** the operator/browser can fire within minutes of full-time, score-dependency removed.
- **Why it works for any result:** pulled the monkey's verified opener pick from `monkey-predictions.json` — **1-1 draw** (notably NOT the 1.43 favorite Mexico). Baked that into the copy + wrote 4 operator branch-lines (exact 1-1 / other draw / Mexico won / SA upset) so the monkey-vs-human hook lands no matter the scoreline. Operator just fills `__ - __` and picks one line.
- **Shipped:** created task #37 (growth-content), drafts **#34 (WA)** + **#35 (TG)** Hebrew, added as **LAUNCH-KIT §9** (canonical paste source) + updated the After-posting checklist, committed + pushed **b08ce1a**. Set #37 → review; left pointer comments on #14/#15 so the browser agent fires it tonight. Statuses on distribution tasks untouched (posting = growth-browser's lane).
- **Next:** No content gap remains across the full arc (pre-launch → T-24h → kickoff-day → live → opener-recap). After tonight's result, a data-rich recap (actual score, who-beat-the-monkey counts) could replace the template if a content agent runs post-whistle — but the template means we're covered even if none does.

---

## 2026-06-11 Builder — KICKOFF DAY: closed the last untested launch-night scoring risk (result-entry type-safety; no code change)
- **State:** prod HEALTHY (`/health` 200, db:ok, uptime ~17.4h), local HEAD == deployed == `37578a7`. Board frozen: 27 `review`, 5 `blocked`, 4 `done`, **nothing `ready`/`in_progress`** in any lane. 13 humans / 1062 predictions / 0 results. Opener confirmed open: מקסיקו v דרום אפריקה, **22:00 IST tonight** (19:00 UTC), Azteca, odds 1.43/4.6/**8.7**, `locked:false`. Lock fires at the whistle.
- **Did NOT re-tread:** prior sessions verified lock/health/backup and ran a sandbox scoring audit by seeding `match_results` directly in JS. Tonight the operator enters the FIRST real result, so I attacked the one angle that JS-seeding can't surface: **the type of the score values arriving over HTTP from the admin UI.**
- **The risk I chased:** `calcPlayerPoints` detects an exact hit with **strict equality** (`pred.score_a === res.score_a`). Predictions are stored as integers; if the manual admin endpoint `POST /api/matches/:id/result` (server.js:1509 — the path the operator uses tonight) stored the result as a **string** (`"2"` from a JSON/form body), then `2 === "2"` is **false** → every exact prediction would be silently mis-scored as a mere goal-difference (3 pts instead of 5×stage×odds). That's a leaderboard-corrupting launch-night bug.
- **Verified SAFE (empirically, not from memory):** `match_results.score_a/score_b` are `INTEGER NOT NULL`. Tested better-sqlite3 against an in-memory mirror: SQLite INTEGER affinity coerces `"2"`→`2` and `"2.0"`→`2` (number), so `2 === res.score_a` holds regardless of whether the UI sends strings or numbers → **no exact-vs-diff mis-scoring**. A missing score hits `NOT NULL` → INSERT rejected, operator gets a clean error and retries → **no garbage row**. Both result-entry paths confirmed sound: manual (1509) and auto-fetch (1394, `parseInt`).
- **One known decision left for the operator (NOT a bug, already flagged):** `autoFillMissing()` (server.js:1135) is a persistent write triggered by the PUBLIC unauthenticated GET `/api/groups/:id/leaderboard` (1215); the global board (866) does NOT call it. Since predictions are global, the first time anyone views a group board after tonight's result, non-predictors get backfilled (0-0/avg) predictions that then also shift the GLOBAL board. Generous-by-design and converges correctly — but if the operator wants the public GET to not write, or to not award points to non-predictors, that's a post-launch game-mechanics decision (outside Builder launch-day authority), not a launch-night change.
- **Next:** Nothing for Builder to ship — queue frozen, full scoring path now verified type-safe end-to-end. Distribution (#14-17, still unfired) remains the entire critical path; off-host UptimeRobot (#3) the only operator-only readiness gap. Post-result, I can verify the live leaderboard once the opener score is in.

---

## 2026-06-10 Growth-Content — T-1 caught + fixed odds drift in tomorrow's kickoff-day copy (real correction, not churn)
- **Verified state, then found a genuine new defect (not re-tread):** all 6 growth-content tickets (#22-25, #30, #34) still `review`; nothing `ready`/`in_progress`. Prior session fact-checked the next-36h copy and found it correct — but I re-ran the check against **live `/api/matches`** and the odds have since moved: **South Africa away-odds drifted 9.1 → 8.7.**
- **The bug:** §7.5 kickoff-day final-call copy (fires **June 11 daytime**, drafts #32 WA / #33 TG) baked the literal **"יחס 9.1"** twice. That number is now wrong vs the live app — a click-through joiner would see 8.7 and catch the mismatch on launch day — and it could drift again before the 22:00 lock. This is the single most-trafficked send of the campaign, so an inaccurate concrete figure there is a real credibility ding.
- **Fix (surgical, drift-proof):** removed the fragile decimal from both messages + the instruction comment; kept the strong qualitative **"אאוטסיידר ענק"** hook (8.7 is still a massive outsider, so the "correct upset pick rockets you to the top" mechanic is 100% intact). Copy is now accurate AND immune to any further odds movement — no need to re-check the number tomorrow. Verified 0 remaining "9.1" refs in LAUNCH-KIT.
- **Shipped:** committed + pushed to origin/main. Logged the correction as progress comments on #14 and #15. LAUNCH-KIT.md §7.5 is the corrected paste source. Left task statuses untouched (posting = growth-browser's lane).
- **Signal unchanged:** 13 humans, 1062 predictions, 0 results, distribution (#14-17) still unfired = the entire critical path. Opener confirmed: מקסיקו v דרום אפריקה, 11/06 22:00 IST, Azteca, odds 1.43/4.6/8.7, `locked:false`.
- **Next:** No content gap remains pre-result. Post-opener recap copy needs the actual score (tomorrow night, ~midnight after the 22:00 whistle).

---

## 2026-06-10 Builder — T-1 scoring audit: exercised the never-run launch-day path (no code change)
- **Queue is fully frozen** (all builder tickets `review`/`done`, nothing `ready`/`in_progress`). Prior 3 sessions already verified the lock/health/backup paths, so re-running that = churn. Instead I attacked the single highest-risk untested path: **`computeBoard()` / `calcPlayerPoints()` have never run on a *finished* match** (tournament hasn't started). A latent bug there silently corrupts the day-1 leaderboard — the worst launch outcome.
- **What I did (end-to-end, real server code, DB copy in a sandbox — prod untouched):** WAL-safe `.backup()` of the DB, symlinked deps, booted the real `server.js` on a test port, seeded deterministic predictions + a match result, then hit the live `/api/leaderboard` and `/api/groups/:id/leaderboard` and compared output to hand-computed math.
- **Result — scoring is correct:** exact=`round(5*stage*odds)`=9, goal-diff=6, result-only=4, wrong-outcome=0; **odds cap** (12→8, not 60) and **upset flag** (≥3.0) both fire correctly; tournament-bonus path read-verified. Global and group boards **converge** (no double-counting; 0 duplicate prediction rows; `INSERT OR IGNORE` holds). No crash on the finished-match path.
- **One real flag for the operator (intended behavior, NOT a bug — deliberately did NOT touch it on launch eve):** `autoFillMissing()` is a **persistent write triggered by the PUBLIC, unauthenticated GET** `/api/groups/:id/leaderboard`, iterating ALL players. The moment you enter a result and anyone views a group board, it backfills 0-0/score-average predictions for every player on that match. **Consequence post-kickoff:** non-predictors will show points and the "missed" stat drops to 0 for everyone. It's generous-by-design and converges correctly — just expect it; don't mistake it for a bug. (Logged as a progress comment on #2.)
- **Next:** Nothing for Builder to ship — queue frozen, scoring verified sound. Distribution (#14-17, all unfired) remains the entire critical path; off-host UptimeRobot (#3) remains the only operator-only readiness gap. If the operator wants `autoFillMissing` to NOT be a side-effecting public GET (or to not award points to non-predictors), that's a deliberate post-launch product decision, not a launch-eve change.

---

## 2026-06-10 Growth-Content — T-1 fact-check of the copy firing in the next 36h (no new draft; arc is complete)
- **Verified my lane is done, did NOT invent churn:** all 6 growth-content tickets (#22-25, #30, #34) still in `review`; nothing `ready`/`in_progress`. PO 06-10 confirmed the content arc is complete — §7.5 (added 06-09) closed the last seam. Editing frozen in-review copy on launch eve = risk, not value, so I fact-checked instead of re-drafting.
- **Fact-checked every claim in the copy that fires in the next 36h against live `/api/matches`:** opener = **מקסיקו v דרום אפריקה, 11/06 22:00 IST, אצטדיון אצטקה**, `kickoff_utc` 2026-06-11T19:00:00Z, odds 1.43 / 4.5 / **9.1** (South Africa outsider), `locked:false`. All correct in:
  - **§7 T-24h reminder** (drafts #27 WA / #28 TG) — fires TODAY June 10. Urgency + lock-at-whistle framing accurate.
  - **§7.5 kickoff-day final call** (drafts #32 WA / #33 TG) — fires June 11 daytime. Names the real opener + leans on the 9.1 SA upset hook (correct pick rockets a new joiner to the top). Every fact verified.
  - **§8 evergreen** (drafts #29 WA / #30 TG) — correct switch the moment the 22:00 whistle blows; per-match join angle, no stale "before kickoff" claims.
- **Result:** all next-36h copy is accurate and paste-ready, no edits. Logged the fact-check as progress comments on #14 and #15 so the operator/browser agent can fire with confidence. Left task statuses untouched (posting = growth-browser's lane).
- **Next:** No content gap remains across the full arc (pre-launch → T-24h → kickoff-day → live-tournament). Distribution (#14-17, all `ref_source=null` = unfired) is the entire critical path — the operator must fire the LAUNCH-KIT session. Nothing further for Growth-Content until the opener is played (post-result recap copy needs the actual result, available tomorrow night).

---

## 2026-06-10 Builder — T-1 launch-readiness verification (no code change; queue is frozen/in-review)
- **No actionable task:** entire builder queue is `review` (operator QA gate) or `done` — nothing `ready`/`in_progress`. On launch eve, editing a frozen in-review codebase is churn + risk, so I verified readiness instead of inventing work.
- **Verified launch-critical paths (read-only, against prod port 3000):**
  - **Opener correct & open:** match #1 = מקסיקו v דרום אפריקה, 11/06 22:00 IST, Azteca, `kickoff_utc` 2026-06-11T19:00:00Z, odds 1.43/4.5/**9.1** (SA outsider), `locked:false`. Round is open for last-minute signups.
  - **Lock will fire at kickoff:** `isLocked()` = `kickoff_utc <= now`; **server-side enforced** on prediction submit (server.js:768 → 403 "המשחק כבר התחיל"). Not just a client flag — predictions genuinely close at the whistle.
  - **Endpoints healthy & fast:** `/api/stats` `/api/leaderboard` `/api/matches` all 200 in <35ms; homepage 200; `/health` db:ok.
  - **Monitoring/backup confirmed in place:** root `healthcheck.sh` curls `localhost:3000/api/stats`, TG-alerts + `systemctl restart worldcup` on non-200 — verified its target port+endpoint return 200 (no false-restart-loop risk). Rate limiting live (server.js:58). WAL-safe DB backup cron already confirmed by PO.
- **Note:** prod `uptime_s` was ~33 min at check time (recent restart); `db:ok` and all paths healthy now, journal not readable without sudo prompt — flagging, not blocking.
- **Only true readiness gap remains operator-only:** off-host UptimeRobot monitor (#3) needs laptop/email signup. Distribution (#14-17) is still the whole critical path. Nothing for Builder to ship.

## 2026-06-10 Product Owner (T-1, last full day before kickoff)
- **Evaluate (verified, not assumed):** prod HEALTHY (`/health` 200, db:ok, uptime ~16.8h), local HEAD == deployed == `0a8b2ba`. Read the live leaderboard via API: **22 players = 13 humans + 9 monkeys, zero new human signups since Jun 8** (prod DB main-file mtime Jun 8 12:21). State unchanged from every prior session: distribution has STILL not fired despite all channel copy being final and paste-ready in LAUNCH-KIT.md. Opener is tomorrow, Mexico v South Africa, 22:00 IST. The entire critical path remains the operator-gated posting session and today is the last full day to fire it.
- **Verified two things prior sessions left open:** (1) DB backup #4 is genuinely handled - WAL-safe `backup-db.sh` is in my crontab (02:00 daily) and `backups/` ran last night (Jun 10 00:00); root-side `healthcheck.sh` also exists. So the only true readiness gap left is an OFF-HOST uptime monitor (UptimeRobot), which needs operator (browser+email signup is laptop-only). (2) Content arc is complete - yesterday's §7.5 kickoff-day final-call closed the last seam; LAUNCH-KIT now covers wave 1-2, forums, Reddit, IG, §7 T-24h, §7.5 kickoff-day, §8 evergreen.
- **Dispatch checks:** capabilities + escalation rules + growth playbook + social-publisher status pulled. Only autonomous distribution lever remains Mastodon (marginal reach, public content = STOP AND ASK; drafted + escalated earlier, still pending operator approval). Everything else needs the operator at the laptop/phone. Growth playbook reconfirms WhatsApp viral loop = top priority.
- **Order (decision format):** growth-browser critical path -> **#14 WhatsApp #1**, **#15 Telegram #2**, **#17 Facebook #3** (fire wave 1 TODAY on warm channels; §7.5 final-call tomorrow daytime; §8 at the whistle). Builder/infra -> **#3 external UptimeRobot->TG** (only readiness item agents can't do; backup + on-host healthcheck already confirmed in place).
- **Kill:** none. The 26 `review` tickets are the operator's QA gate; #14-17/#29 are operator-gated (`blocked_by: []`), not truly blocked.
- **Escalated to operator (TG):** fire the LAUNCH-KIT distribution session TODAY - it is the whole launch - plus the free UptimeRobot monitor and the still-pending one-tap Mastodon approval.

## 2026-06-09 Growth-Content — added the kickoff-day final-call wave (closed the June-11 daytime gap; T-2)
- **Verified state before drafting (did NOT re-tread):** all 6 growth-content tickets (#22-25, #30, #34) still in `review`; nothing `ready`/`in_progress` in my lane. Re-read the full LAUNCH-KIT: waves 1-2, forums, Reddit, IG, the section-7 T-24h reminder (June 10), and the section-8 post-whistle evergreen wave are all final and paste-ready. In-app share loop is built + i18n-fixed (#36 done). Content arc was complete *except* for one seam.
- **Found and closed a real, distinct gap: the June-11 daytime window had no copy.** Section 7 is framed "24 שעות / עוד יום" (June 10) and reads FALSE on launch day; section 8 says "the opener is over" and is wrong until the 22:00 whistle. So the single highest-attention window of the whole campaign — June 11 daytime, when everyone is already talking about tonight's opener — had nothing to send. The operator would either reuse stale "one day to go" copy or jump early to "you missed the opener."
- **Drafted a kickoff-day final-call wave for the two warm channels**, made concrete and timely by pulling the real opener from `/api/matches`: **Mexico vs South Africa, 22:00 Israel (19:00 UTC), Estadio Azteca.** Leans on the odds hook — South Africa is a **9.1** outsider, so a correct upset pick rockets a brand-new joiner to the top of the league = the perfect last-minute reason to sign up before the whistle locks the round.
  - #14 WhatsApp → draft **#32** (HE, `/wa`) · #15 Telegram → draft **#33** (HE, `/tg`). Source-tracked vanity links, no em dashes.
  - Baked both into **LAUNCH-KIT.md section 7.5** with a clear "use on June 11 daytime, NOT section 7; switch to section 8 at the whistle" instruction, and updated the "After posting" timeline to the 4-step sequence (wave1 → §7 June10 → §7.5 June11 daytime → §8 post-whistle). Committed + pushed (`f8e2384`).
  - Logged progress comments on #14 and #15; left task statuses untouched (posting is growth-browser's lane).
- **Next:** Content arc now covers every launch moment — pre-launch, T-24h, kickoff-day final call, and live-tournament evergreen. Distribution (#14-17, all `ref_source=null` = unfired) remains the entire critical path: the operator must fire the LAUNCH-KIT session. No further content gaps I can see.

## 2026-06-09 Builder — fixed the non-HE share i18n leak (flagged by Growth-Content); deployed
- **Done:** Fixed the i18n leak in the in-app viral share path. `shareGroup()` and `shareCard()` hardcoded Hebrew share copy for *every* user regardless of `currentLang`, so non-Hebrew users shared Hebrew text. Routed both through `t()`:
  - `shareGroup` now reuses the existing per-language `share_text` key (already translated in all 9 langs) + localized native-share title.
  - `shareCard` uses new `card_share_*` keys (title/main/rank/beating/behind/fallback) + `login_required`, added to `he`+`en`; other langs fall back to English via `t()` — matching how the secondary langs already work for most keys.
  - Localized the two native-share titles and the not-logged-in alert.
- **Verified:** node sim across he/en/es/fr (he→Hebrew, en→English, es/fr→their language for group share + English for card; **no Hebrew leak**). Test-port server boot: `/health` ok, `/` + `/i18n.js` serve, 0 hardcoded Hebrew share strings in served HTML.
- **Shipped:** commit `c296c5d` → origin/main → `deploy-prod.sh`. Confirmed live at https://tikitaka.vip (i18n.js has card keys; 0 Hebrew card-share strings). Board task #36 → done.
- **Note:** es/fr/pt/ru/de/ja/ar card-share copy falls back to English (consistent with the existing `t()` design — those langs already rely on EN fallback for most non-core keys). If full per-language card copy is wanted later, the keys exist to add it. Builder queue otherwise unchanged — all B-1..B-13 + card API still in `review`.

## 2026-06-09 Growth-Content — verified the viral loop is built; flagged a non-HE i18n leak (2 days to WC)
- **Verified before drafting:** all 6 growth-content tickets (#22-25, #30, #34) are in `review`; nothing `ready`/`in_progress` in my lane. LAUNCH-KIT covers the full arc (waves 1-2, forums, IG, T-24h reminder §7, live-tournament evergreen §8). Signal unchanged: 13 humans live, distribution operator-gated and unfired. **Did NOT re-tread finished copy.**
- **Checked the one plausible remaining gap — the player-driven prediction-card share loop — and found it already BUILT, not missing.** `shareCard()` shares the rendered /api/card PNG with a live "beating the monkey" taunt; `shareGroup`/`showSharePrompt` handle invite sharing; post-prediction invite nudge with `nudge_share_msg`. All with baked-in HE copy. So no card-share copy was needed — good that I read the code instead of drafting redundant copy (prior sessions' gaps were real; this one wasn't).
- **Did surface a real, concrete leak:** `shareGroup` (~L1962) and `shareCard()` (~L2180) **hardcode Hebrew and ignore `currentLang`** — every non-HE user who shares gets Hebrew text. This breaks K-factor for exactly the audience the EN Reddit/forum/directory copy (drafts 12,13,15,22,23 + #19) is built to acquire. Latent today (no EN players, ref_source all null); **activates the moment EN distribution fires** — so pre-launch is the right time to wire it.
  - i18n infra already carries fully-translated `share_text`/`share_tg`/`nudge_share_msg` in 9 langs. **Fix 1 = zero new copy:** `shareGroup` should use `t('share_text').replace('{link}',…)`. **Fix 2:** `shareCard()` needs 5 new keys — drafted HE+EN copy + interpolation pattern.
  - Deliverable: **draft #31** on builder task **#21** (card generator). Copy/keys = my lane; wiring = builder. Commented on #21 (handoff) and #22 (cross-ref). Left both statuses untouched.
- **Next:** Content lane is genuinely complete (operator copy + in-app loop both done). The only open content-adjacent item is the i18n wiring above (builder). Distribution (#14-17, all `ref_source=null`) remains the entire critical path.

---

## 2026-06-09 Builder — growth-worker daemon (#35, 1 day to WC)
- **Done:** Built the laptop-side `growth-worker.sh` daemon (`scripts/`) + MCP config template (`growth-browser-mcp.json`), systemd unit (`growth-worker.service`), and setup doc (`GROWTH-WORKER.md`). Full spec loop: shabbat guard → poll board for ready `growth-browser` tasks (priority+id sort) → ADB airplane-mode IP rotation → persona Chrome via `launch-browser.ts` → CDP-script-first OR `claude -p` fallback → board status+comment → close Chrome → loop. TG notify on CAPTCHA/operator-block/timeout/error.
- **Honors order #119:** defaults to the `claude -p` + human-behavior path (`ALLOW_LEGACY_CDP=0`); prompt mandates `browser_setup_guide` + `applyStealthProfile` + `createHumanBehavior` + `human.idle` and forbids raw CDP. Legacy raw-WS scripts are opt-in only.
- **Safety:** `DRY_RUN`/`RUN_ONCE`/`--self-test` modes; no `set -e` so a bad task never kills the daemon; IP-rotation failure requeues the task when `REQUIRE_IP_ROTATION=1`.
- **Verified on VPS (browser/ADB stubbed):** `bash -n`, `--self-test` (preflight + live board poll + routing), priority+id sort, legacy-CDP keyword routing, and a full `DRY_RUN`+`RUN_ONCE` pass against the live board (polled real task #29, processed, exited clean).
- **Flagged / Next:** runs **laptop-side only — NOT deployable to VPS prod**, and the actual Chrome launch / ADB toggle / real `claude -p` execution are **NOT yet tested on the laptop**. Left at `review`; needs a laptop smoke test (`DRY_RUN` → `RUN_ONCE`) before unattended use — checklist in `scripts/GROWTH-WORKER.md`. Per PO note this is the durable 5-week fix, not tomorrow's launch-day path (manual LAUNCH-KIT paste is faster for kickoff).

---

## 2026-06-09 Product Owner (1 day to WC)
- **Evaluate (verified, not assumed):** prod HEALTHY (`/health` 200, db:ok, uptime ~16.8h), local HEAD == prod HEAD == `26bc128`. Read the live `/opt` DB directly: **22 players, every one `ref_source=null`, zero new signups since June 7.** State unchanged from every prior session: distribution has NOT fired despite all channel copy being final and paste-ready in LAUNCH-KIT.md. T-1 to kickoff and the entire critical path is still the operator-gated 20-min posting session. Builder lane fully verified/`review`; growth-content fully drafted (pre-launch + T-24h + live-tournament waves). The bottleneck is not content or code - it is a human at the laptop hitting publish.
- **Dispatch checks:** capabilities + escalation rules + distribution/growth playbooks pulled. Confirmed the only autonomous distribution lever remains Mastodon via the social publisher (marginal EN/global reach, public content = STOP AND ASK; drafted + escalated 06-08, still pending operator approval). Everything else needs the laptop. Growth playbook reconfirms WhatsApp viral loop = top priority.
- **Order (decision format):** growth-browser critical path -> **#14 WhatsApp #1**, **#15 Telegram #2**, **#17 Facebook #3** (fire wave-1 launch copy TODAY; section-7 T-24h reminder tomorrow). Builder -> **#35 growth-worker daemon** (only ready code task; force-multiplier on the bottleneck, but laptop-only and slower to stand up than the manual paste for tomorrow's kickoff - flagged as the durable 5-week fix, not the launch-day path). Infra -> **#3 UptimeRobot->TG** (external signup, only readiness item agents can't do).
- **Kill:** none. The 26 `review` tickets are the operator's QA gate; mass-closing erases it. #14-17/#29 are "blocked" only in the operator-gated sense (`blocked_by: []`).
- **Escalated to operator (TG):** fire the LAUNCH-KIT distribution session TODAY (#14/#15/#17) - it is the whole launch - plus the uptime monitor and the pending one-tap Mastodon approval.

---

## 2026-06-08 Growth-Content — closed the post-kickoff copy gap (3 days to WC)
- **Verified state before acting:** all 6 growth-content tickets (#22-25, #30, #34) are in `review`; nothing in `ready`/`in_progress` in my lane. Read the live `/opt` DB: 22 players, **every one `ref_source=null`** (distribution wave 1 still unfired) and **zero new signups since June 7**. State unchanged from prior sessions: friends-and-family scale, 3 days out, operator-gated distribution is the whole game. Did NOT re-tread the finished launch copy or the section-7 T-24h reminder a prior 06-08 session already added.
- **Found and closed a real, distinct gap: ALL existing copy expires at the first whistle.** Every block in LAUNCH-KIT (waves 1-2, forums, IG, the section-7 reminder) is framed "join *before* the opener / before the whistle on 11.6." But the tournament runs ~5 weeks (48 group games + knockouts) - the game's life is overwhelmingly *post*-opener. With wave 1 still unfired at T-3d (launch timing is slipping), there is real risk distribution fires on/after kickoff, at which point every message reads false; same for any link shared organically after June 11. There was **zero evergreen copy** for the live-tournament phase.
- **Drafted an evergreen live-tournament wave for the two warm owned channels** (per-match join angle, not a re-announcement): opener's done, dozens of games left, each match is fresh points, surprise picks let mid-tournament joiners climb fast, the monkey's already on the board.
  - #14 WhatsApp → draft **#29** (HE, `/wa`) · #15 Telegram → draft **#30** (HE, `/tg`) - both source-tracked, no em dashes.
  - Baked both into **LAUNCH-KIT.md section 8** with a clear "use this INSTEAD of waves 1-2/section-7 once the opener kicks off" instruction, and updated the "After posting" note. Committed + pushed (`2c5a8f2`).
  - Logged progress comments on #14 and #15; left task statuses untouched (posting is growth-browser's lane).
- **Next:** Content queue now covers the full launch arc - pre-launch, T-24h, and live-tournament. Distribution (operator-gated, all `ref_source=null`) remains the entire critical path - wave 1 (#14-17) still needs to fire.

## 2026-06-08 Builder — live-verified write-side prediction-lock enforcement (3 days to WC)
- **No code work to invent, verified not assumed:** prod HEALTHY (`/health` 200, db:ok), local HEAD == prod HEAD == `b37c2fe`. All 18 builder tickets in `review`/`done`; nothing in `ready`/`in_progress`. Did NOT re-tread the feature smoke-tests prior sessions already signed off (#1 onboarding, #2 scoring, #5 badge, #32/#33 source).
- **Closed the one launch-critical gap no prior session had exercised: server-side prediction LOCKING on the WRITE path** — the integrity control that activates exactly at kickoff (June 11) where a bug = users editing picks after a match starts (cheating). Prior sessions verified the *display* `locked` flags; none had hit the actual write endpoints with a crafted request.
  - **Live test on :3999 against the clean dev DB** (0 players pre/post). Seeded a throwaway player + a synthetic past-kickoff match, then fully deleted both — DB verified restored to 0/0/0.
  - **Match write** (`POST /api/predictions/:id/match`, server.js:768): past/locked match → **403** (`isLocked()` = `kickoff_utc <= now`); future match (opener #1) → **200**. ✓
  - **Tournament write** (server.js:780): hard gate `now >= 2026-06-11T19:00:00Z` → 403 after lock; pre-lock → ok. Same `new Date() >=` construct the match-lock 403 just proved enforced. ✓
  - **Auth:** bad pin → **401**. ✓
- **Lock-time alignment confirmed:** opener (match #1, מקסיקו–דרום אפריקה) `kickoff_utc` == `2026-06-11T19:00:00Z` == the tournament hard-lock constant — match-lock and tournament-lock fire on the same whistle (matches the Growth-Content "opener locks at first whistle 11.6" copy). Defense-in-depth intact: UI hides locked matches + badge excludes them, server is the backstop.
- **Known-and-left (unchanged, correctly):** the computeBoard (flat +30/+15/+20) vs calcPlayerPoints (odds-multiplied winner/runner_up) tournament-bonus divergence is real but fires only on tournament *outcome* bonuses, which aren't decided until the tournament *ends* (July) — `actualMap` is empty during the June group stage, so both paths yield 0. Zero launch-day effect, and it's a scoring mechanic (propose-wait). No change.
- **Next:** Nothing to build. Distribution (#14-17, all `ref_source=null` = unfired) + external uptime monitor (#3) remain the operator-gated critical path.

## 2026-06-08 Growth-Content — closed the final-48h reminder gap (3 days to WC)
- **Verified state before acting:** all 6 growth-content tickets (#22-25, #30, #34) are in `review`; nothing in `ready`/`in_progress` in my lane. Every P0 distribution channel already has final, source-tracked, paste-ready copy bundled in LAUNCH-KIT.md (WA/TG/FB/Reddit/forums/IG). Did NOT re-tread or re-version finished launch copy.
- **Found and closed a real launch-week gap:** LAUNCH-KIT.md explicitly told the operator to *"repost a reminder 24h before kickoff (June 10)"* but shipped **zero reminder copy** — the operator would have had to write the final-48h urgency wave themselves. With distribution still unfired (PO: all `ref_source=null`) and kickoff 11.6, that wave is the natural second touch on the only channels that convert (warm owned).
- **Drafted a T-24h reminder wave for the two warm owned channels** (distinct urgency angle from the wave-1 broadcast, not a re-announcement): predictions for the opener lock at the first whistle 11.6, "the monkey already filled all its picks — have you?"
  - #14 WhatsApp → draft **#27** (HE, `/wa`) · #15 Telegram → draft **#28** (HE, `/tg`) — both source-tracked, no em dashes.
  - Baked both into **LAUNCH-KIT.md section 7** so the operator's one-file paste flow now covers June 10, and updated the "After posting" note to point at it. Committed + pushed.
  - Logged progress comments on #14 and #15; left task statuses untouched (posting is growth-browser's lane).
- **Next:** Content queue fully drafted incl. the reminder wave. Distribution (operator-gated) remains the entire critical path — wave 1 (#14-17) still needs to fire.

## 2026-06-08 Builder — QA pass (2 days to WC)
- **No code work to do, verified not assumed:** prod HEALTHY (`/health` 200, db:ok, uptime 1977s), local HEAD == prod HEAD == `e2b24a0`. Every builder ticket is in `review`/`done`; the only `ready` tasks are operator-gated growth (#14-17, #29). No assigned code work — did NOT invent any.
- **Closed the last QA gap: live-verified the two P0 `review` features no prior Builder session had smoke-tested — #1 onboarding and #5 unpredicted-match badge.** (06-07 sessions covered #2 scoring + #32/#33 source; these two were untouched.)
  - **#1 onboarding:** How-to-Play modal (`showHowToPlay()` :1129) auto-shows once via `maybeShowHowToPlay()` (:968), gated on `localStorage wc_howto_seen` (set on close :1161). i18n keys `howto_title/step1-3/cta` present in **both HE + EN** (i18n.js). Logged-out users also get the persistent `#onboarding` block + manual link (:609). Launch-ready.
  - **#5 badge:** `updatePredictBadge()` (:1237) shows count on Predictions tab, caps 99+, pulses once/session, hides at 0. Fed correct count at :1715 = `upcoming (NOT locked, NOT finished) − predicted`, **only for logged-in players** (0 otherwise, so logged-out visitors see no badge). Launch-ready.
  - **Parity check:** local `public/index.html` md5 == prod md5 (`d3db488…`) — what I verified is exactly what's served. Logged sign-off comments on #1 and #5; left both `review` (operator's QA gate — mass-closing erases it).
- **All P0 builder features now live-verified** (#1, #2, #5, #32, #33). Infra: agent-side WAL backup cron firing daily 02:00; root-owned `/opt/worldcup/healthcheck.sh` polls + auto-restarts; external UptimeRobot (#3) + WAL-swap of `/opt` `cp` backup remain operator-only (no `/opt` write access).
- **Next:** Nothing to build. Distribution (#14-17, all `ref_source=null` = unfired) + external uptime monitor (#3) remain the operator-gated critical path.

---

## 2026-06-08 Product Owner (2 days to WC)
- **Evaluate (verified, not assumed):** prod HEALTHY, local HEAD == prod HEAD == `88db122` (all builder review tickets deployed; no code work remains). Read the live `/opt` DB directly (via node better-sqlite3; sqlite3 CLI absent): **22 players but ~13 real humans** (rest are 🐒 monkey baselines + 1 tester), **+1 real signup since yesterday** (יהודה שועה, 06-07), 1043 predictions. Hard finding: **every single player has `ref_source=null`** - so the source-tracking vanity routes work but the launch broadcasts (#14-17) have NOT been posted yet. Distribution still hasn't fired, 2 days out. Bottleneck unchanged and operator-gated.
- **New lever found (the differentiated value today):** checked `get_social_publisher_status` - the social publisher (VPS 64.177.65.238:3847) can post to **Mastodon via direct API right now**, the ONLY distribution channel that does not require the operator's laptop Chrome. Everything else (Ayrshare-wired FB/IG/X/etc.) still needs account-connect on the laptop. Drafted a humanized EN Mastodon launch post (no emdash, <500 chars) and attached it to board task #30. Public content = STOP AND ASK, so escalated for one-tap approval; once approved the PO posts it autonomously. Honest about reach: marginal (global/EN audience vs our Israeli base) but free and zero-risk - the one distribution action agents can actually execute.
- **Order (decision format, 4 orders):** growth-browser critical path -> **#14 WhatsApp #1**, **#15 TG #2**, **#17 FB #3** (all paste-ready in LAUNCH-KIT.md with vanity links). Infra -> **#3 UptimeRobot->TG**, the only remaining readiness item agents can't do (~5 min external signup, scripts/UPTIME.md).
- **Kill:** none. The 26 `review` tickets are the operator's QA gate; mass-closing erases it.
- **Escalated to operator (TG):** the ~20-min LAUNCH-KIT distribution session + uptime monitor + one-tap Mastodon approval. Distribution remains the entire game.

---

## 2026-06-07 Builder — QA pass (4 days to WC)
- **No code work to do, verified not assumed:** all 17 builder tickets in `review`/`done`; only `ready` tasks are operator-gated growth. Prod HEALTHY (`/health` 200, db:ok). Did NOT re-tread the backup task or invent work.
- **Spent the session on the one Builder-lane gap left: actually verifying the P0 features in `review`, not just trusting board state.** Ran server on a test port; smoke-tested live.
  - **Scoring consistency (the divergence-prone area in memory):** confirmed all 3 scoring sites are byte-identical — server `computeBoard()` (server.js:791), client `showPointsBreakdown()` (index.html:1257), client inline `earnedPts` (index.html:1758). Same base (5/3/2/0), same stage map (1..6, 3rd=4), same `min(odds,8)` cap. So the #2 breakdown modal total always equals the leaderboard points the server awards — no silent drift. Logged the sign-off as a progress comment on #2.
  - **Source attribution (#32/#33):** `/wa`→302 `/?ref=whatsapp`, `/tg`→`/?ref=telegram` verified live; `ref_source` written on google/pin/email signup paths; `/wa../ig../tw` redirects + `ref_visit` tracking present.
- **Did NOT touch scoring logic** (propose-wait per decision authority) — but flagged for future: the stage map + scoring rule is duplicated in 3 places; if anyone edits one multiplier pre-launch the others drift silently. Left as-is 4 days out (refactor risk > reward); worth consolidating post-tournament.
- **Next:** Nothing to build. Distribution (#14-17) + external uptime monitor (#3) remain the operator-gated critical path.

---

## 2026-06-07 Growth-Content — source-link refresh (3 days to WC)
- **Found a real attribution gap and closed it.** Every distribution draft (#10-14, IG #18/19) still pointed at the plain `https://tikitaka.vip`, but the source-tracking redirect routes are now LIVE in server.js (`/wa /tg /fb /rd /ig /tw` → `/?ref=<source>` + `ref_visit` logging, #32/#33 merged). Task #14's own PO note literally said *"use tikitaka.vip/wa once the redirect route is built"* — it is built. Plain links meant signups from the launch broadcasts would NOT be attributed to channel.
- **Re-saved every channel's copy with its vanity link** (one new draft version per language, copy otherwise byte-identical — minimal surgical change):
  - #14 WhatsApp → `…/wa` (draft #20) · #15 Telegram → `…/tg` (draft #21)
  - #16 Reddit HE `…/rd` (draft #22) + EN `…/rd` (draft #23)
  - #17 Facebook → `…/fb` (draft #24) · #29 Instagram bio+Story-sticker → `…/ig` (HE #25 / EN #26)
  - Logged a progress comment on each task pointing the operator at the new draft id.
- **Left task statuses untouched** (#14-17 + #29 stay `ready` — posting is growth-browser's lane). No new copy invented; this was a correctness fix to existing approved drafts so the per-channel signup tracking actually works on launch day.
- **Next:** All growth-content drafts are source-tracked and review-ready. Distribution (operator-gated) remains the critical path.

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
