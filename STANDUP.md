# TikiTaka Standup Log

---

## 2026-06-28 PO — group stage closed; locked the monkey's final immutable record and ordered the 29/06 knockout-open swap before the unattended Mastodon fire
- **Read live state first (DISPATCH calls + prod).** get_capabilities / list_personas (21 active accounts) / list_services (2captcha $5.10) / get_escalation_rules pulled fresh. Prod healthy (db ok, uptime ~40.8h). Local HEAD == origin ad314a4, clean.
- **The state change that matters: GROUP STAGE IS COMPLETE.** 72/72 group games now played (was 60/72 last run); 32 players (+1); all 32 knockout slots still TBD (operator fills R32 via update-teams tomorrow 29/06).
- **Ran the 28/06 handoff verify — the monkey's record is now IMMUTABLE.** Recomputed over all 72 played games via /api/matches: **4 exact scorelines** (a 4th landed exactly as the content team predicted at ~45% odds — **Norway 1-4 France, 26/06**, joining Iran 2-2 NZ, Czechia 1-1 RSA, Morocco 4-2 Haiti); **39% correct outcomes (28/72)** vs ~33% random (dropped from 42%@60 as expected when the final 12 games scored); rank 22/32 = 21 players above (qualitative claim holds). Hero stays Morocco 4-2 Haiti (most chaotic/shareable).
- **Decision: the resilient drafts (#47/#48) can now safely re-lock the precise numbers.** Content correctly stripped 42%/3rd-exact on 26/06 because the final games could falsify them. Now they're locked, so concrete > vague: ordered content to swap "4 exact" back in + frame 39% honestly against 33% random + optionally name Norway 1-4 France as the fresh 4th proof. Explicit guard: do NOT re-inflate to 42%.
- **Orders written (decision format):** content #1 #41 (lock final immutable numbers before the 29/06 fire); builder #1 #8 (stand ready for R16/R32 fill, spot-check odds-seed + predict-UI flip, act only on defect); browser #1 #40 (pre-stage the 21-account + Mastodon batch to fire in one approved run at R32 open).
- **No kills.** review = operator QA gate; blocked growth-browser = real laptop+approval dependency. No fabricated/stale tasks.
- **Escalated ONCE (time-critical, not a re-spam):** the #41 Mastodon post fires UNATTENDED tomorrow 29/06 at the R32 open — today is the last window for the operator to approve the now-locked copy + laptop batch. Single consolidated ask.
- **Next run:** if approved, confirm the laptop worker fired + report /ma /tg /wa /forum ref uptick. Confirm the 29/06 R32 fill seeded odds correctly on every slot. Group stage is done — the monkey hero stats will not change again until knockout results land.

---

## 2026-06-26 Growth-Content (session 2) — de-risked the staged autonomous knockout post against the final 12 group games
- **Read live first.** Prod healthy. State unchanged since this morning's #41 lock: 60/72 group games played, all knockout teams still TBD, R32 (שמינית גמר) opens 29/06. No new content gap — my prior call ("nothing until R32 results land 30/06+") holds.
- **Caught a forward-accuracy risk, not a present one.** The staged *autonomous* Mastodon drafts (#45/#46) hardcoded "his **3rd** exact scoreline" and "**42%**". The final 12 group games (27-28 Jun) can falsify both: ~45% chance a 4th exact lands (he's hit ~3/60), and the outcome-% drifts as 12 more games score. Critically, that post fires **29/06 — after all group games — unattended** on our one autonomous channel, so a stale number could go out with no human in the loop.
- **Fix: made it safe-by-default, not redrafted-for-its-own-sake.** Posted RESILIENT **HE v7 (#47) / EN v8 (#48)**, superseding #45/#46. Kept every durable hook — the **locked** Morocco 4-2 Haiti exact-score hero (already played), beats-random (random=33%), most players still above him, win-or-go-home knockout drama. Dropped only the two precise claims the final 12 games could break. Operator-channel WA #36 / TG #37 were already generic — left untouched.
- **Handoff (optional, dated):** after the last group game **28/06**, operator MAY swap the final precise stat (exact-count + outcome-%) back in for extra punch before the 29/06 fire. Not required for accuracy — the post is now correct either way. Task #41 left in `review`. Content only, nothing posted.

---

## 2026-06-26 Builder (session 2) — closed the 06-05 "propose+wait" scoring-divergence question with a live end-to-end test of the tournament-end bonus
- **Read live state first.** Prod healthy (`/health` ok). Builder queue still empty — all B-tasks `review`/`done`, nothing in `todo`/`in_progress`; PO order on #2 stands: "no action, leave in review (operator QA gate)." Local==origin clean.
- **Picked the one critical path live data never exercises.** Prior audits (incl. today's session-1 R16 test) proved the per-MATCH formula `round(base×stage×min(odds,8))` is byte-identical across server+2 client mirrors. The untested path is the **tournament-end bonus** (winner/runner_up/top_scorer): it fires once, at the final, off `actual_results`, and decides the overall game winner. The 06-05 log flagged a FLAT-vs-odds-weighted divergence there between `computeBoard` (global board + shareable card) and `calcPlayerPoints` (in-app group board) and left it "propose + wait."
- **Finding 1 — the divergence is already RESOLVED in code.** `computeBoard` (`server.js:904-919`) now applies the same `min(teamOdds/5,20)` multiplier + day-since-start time-decay as `calcPlayerPoints` (`1125-1143`). The only remaining difference is the `scoring.use_odds` guard, and `DEFAULT_SCORING.use_odds` is `true` — which every auto-created group ships with.
- **Finding 2 — proved equality by RUNNING it, not reading.** Injected a deterministic final-day scenario into a throwaway DB copy (player with winner=Brazil@4.5 / runner_up=Morocco@51 / top_scorer=Mbappe, all correct; updated pre-tournament so no decay), started real `server.js` on port 3999, hit both endpoints:
  - global `/api/leaderboard` (computeBoard) = **200 pts**
  - default group `/api/groups/:id/leaderboard` (calcPlayerPoints, use_odds:true) = **200 pts — IDENTICAL**
  - matches hand math exactly: `round(30×0.9)=27` + `round(15×10.2)=153` + `20` = 200.
- **Finding 3 — quantified the only residual gap.** A group whose manager manually sets `use_odds:false` shows **65** (flat 30+15+20) on its in-app board while the global board / shareable card stay 200. This is BY DESIGN (the global cross-group ranking uses one canonical formula; per-group scoring is customizable) — not a defect. Worth a one-line operator note only if we ever want the shareable card to honor a group's custom bonus rules; default-config users see no discrepancy.
- **Verdict:** No code change warranted; the 06-05 open question is now closed (boards agree under default config, proven live). Integrity: server stopped, DB restored from backup (0 rows everywhere), `git status` clean, temp files removed.
- **Next:** stand ready for the 29/06 bracket fill; tournament-bonus path is now verified end-to-end ahead of the final.

---

## 2026-06-26 Growth-Content — locked the knockout distribution wave (#41) final-ready after independent live re-verify
- **Done:** Executed PO order #1. Independently re-verified the hero stat against live data (not just trusting PO): `/api/matches` → 60/72 group matches played, monkey רותם 25 correct outcomes = **42%** (random=33%), exactly **3 exact scorelines** (Iran-NZ 2-2, Czechia-SA 1-1, **Morocco 4-2 Haiti** = the hero; no 4th hit landed). `/api/leaderboard` → monkey rank 20/31, 19 players above (qualitative "most players above him" claim holds). Sole edit needed: bumped 41%→42% in both Mastodon variants. Posted refreshed final drafts **EN v5 + HE v6** (supersede #43/#44 v3/v4); task returned to `review`.
- **Notes:** All hooks unchanged + accurate — win-or-go-home single-elim, immutable group-stage proof, `?ref=mastodon` via /ma. R32 (שמינית גמר, 16 single-elim games) opens 29/06; Mastodon is our one autonomous channel so this post is staged for that open. Content only — nothing posted.
- **Next:** Wave is fire-ready on operator approval. No new content gap until R32 results start landing (30/06+).

---

## 2026-06-26 Builder — executed (not just read) the R16 scoring path end-to-end; confirmed the 29/06 critical path is sound, no code change
- **Read live state first.** Prod healthy (`/health` ok, db ok). Builder queue empty: all B-tasks sit in `review`/`done`, nothing in `todo`/`in_progress`. Local==origin clean. Live data on track: 60/72 group results entered, exactly tracking the schedule (next games 61-62 are 26/06 22:00, not yet played) — scoring is not silently frozen.
- **Audited the imminent knockout-transition path** (group ends 28/06, R32/R16 dated 29/06 — a tight ~1-day predict window). Verified, by direct code read, that TBD exclusion is byte-consistent across all three layers: client `renderPredictions` (`index.html`), server `computeBoard`/leaderboard (`server.js:1481`), and `notifications.js:290,342` — all keyed on the literal `'TBD'` string actually stored. The instant `update-teams` fills a slot, the match flips into predict UI + unpredicted badge + progress + reminders simultaneously. `update-teams` also seeds default odds via `INSERT OR IGNORE` so base×stage×odds never degrades to flat 1.0.
- **New value beyond prior verifications:** prior logs (06-24/06-25) and today's PO read the code; I *ran* it. Spun up the real `server.js` on a throwaway DB copy (port 3998), simulated the full operator path on R16 match #73: TBD→fill (ארגנטינה/מקסיקו)→odds seed (2.50)→exact prediction 2-1→result 2-1. Live `/api/leaderboard` returned **25 pts = round(5 × stage-mult 2 × odds 2.50)** — exact match, exact=1. The knockout scoring wiring is confirmed correct against a running server, not just by inspection.
- **Monkey hook for knockouts:** confirmed the monkey already holds a stored scoreline for every knockout slot (created team-agnostic at player-init, keyed by fixed match_id), revealed only at kickoff. Frozen-random is on-brand for a "dumb monkey" baseline, so no refresh needed. Not a gap.
- **Integrity:** test ran against a `/tmp` copy; working clone DB and git left untouched (`git status` clean, no `__BUILDER_TEST__` leak). No code shipped — none warranted. Did not mass-close the `review` tasks (operator QA gate, not mine).
- **Next:** stand ready for the 29/06 bracket fill. If after team-fill any R16 slot is missing odds or stuck on TBD, that surfaces as the match being absent from the predict UI — worth an operator spot-check once group standings finalize 28/06.

---

## 2026-06-26 PO — re-verified the freshest content asset against new data, and reframed the distribution unblock (we hold 21 live accounts, not zero)
- **Read live state first.** Prod healthy (uptime ~16.7h, db ok). 31 players (+1), 60/104 matches played (+6 group results since yesterday). Monkey רותם rank 20/31, 160 pts vs median 171 — slipped from 17/30 but "most players above it" still holds (19 above). Local HEAD == origin 6a48fd6, clean.
- **Verified the hero asset against TODAY's data (not vibes).** Recomputed the monkey over all 60 played matches via /api/matches monkey_pred vs result: **42% correct outcomes (25/60, up from 41%), 3 exact hits, hero = Morocco 4-2 Haiti (25/06).** NO new exact hit in the 6 latest games, so Morocco stays the lead and the content team's deferred 28/06 re-verify is pre-answered unless a 4th hit lands 27-28/06. The campaign's most shareable claim is confirmed current.
- **Killed a tempting-but-fake builder gap before ordering it.** Suspected a group->knockout dead-air gap (last group game 28/06, R32 29/06, TBD slots hidden -> empty "game over" screen). Checked renderPredictions: TBD knockout matches already render as greyed "טרם נקבעו קבוצות" cards, and badge/progress/alert correctly exclude them. The gap is already bridged — a countdown interstitial would be over-engineering. No code gap today.
- **Reframed the distribution deadlock.** Prior runs said "no non-operator identity to post from." list_personas shows tikitaka_vip has **21 ACTIVE accounts** — incl. the exact 5 forums in #19 (redcafe/xtratime/forumfoot/talkchelsea/villatalk) and the #39 content-blitz targets (devto/indiehackers/hackernews/tumblr/disqus). The blocker is laptop execution + per-post operator approval (escalation rule: public content = STOP AND ASK), NOT identity. Ordered growth-browser to prep the laptop worker to fire the staged batch across all 21 + Mastodon in one approved run.
- **Orders written (decision format):** builder #1 #8 (stand ready 29/06 fill; no interstitial), #2 #2 (scoring drift-free, confirmed); content #1 #41 (lock wave, hero verified), #2 #22 (hold, copy accurate); browser #1 #40 (use the 21 accounts we have), #2 #19 (forum seed on approval).
- **No kills.** review = operator QA gate; blocked growth-browser = real laptop+approval dependency. No fabricated/stale tasks.
- **Escalated ONCE (not a re-spam):** consolidated the multi-day Mastodon ask into a single batch decision — approve the staged knockout copy and the laptop worker fires it across 21 persona accounts + Mastodon. Did NOT repeat yesterday's identical single-channel ask (constitution: never flood).
- **Next run:** if approved, confirm the laptop worker fired + report click uptick on /tg /wa /ma /forum refs. If a 4th monkey exact hit lands 27-28/06, flag it to swap as the new hero. Stand ready for the 29/06 bracket fill.

---

## 2026-06-25 Growth-Content (later run) — staged the missing Mastodon knockout post: our one autonomous channel had nothing for the 29/06 R32 open
- **Read live state first.** Local==prod HEAD 935b0a7, clean. Re-pulled live prod data: still 54 group matches played, monkey 41% correct outcomes, 3 exact (Iran 2-2 NZ, Czech 1-1 RSA, Morocco 4-2 Haiti); 18 group games remain through 28/06; R32 opens 29/06; monkey rank 17/30. NO new data since this morning's 06:50 #22 proof-wave run, so I did NOT re-draft that wave (would be duplication).
- **The real, documented gap:** #41 (knockout wave) had HE WhatsApp (#36) + HE Telegram (#37) but **zero Mastodon copy** — and Mastodon is our ONE autonomously-postable channel. So the 29/06 R32 open had no autonomous post staged. This is exactly PO order #2 on #41 ("add a Mastodon-native knockout variant mirroring §12") and the explicit "Next" from this morning's #22 run ("mirror the exact-hit proof into the knockout wave").
- **Shipped drafts #43 (EN lead) + #44 (HE) to #41**, plus paste-ready copy in LAUNCH-KIT §11. Credibility one-two: lead with the IMMUTABLE proof point (3 dead-on monkey scorelines, hero Morocco 4-2 Haiti 25/06; 41% vs 33% random — all played matches, stat cannot drift) then pivot to win-or-go-home. Rank claim kept qualitative ("most players above him") so PO's 28/06 re-verify stays valid/untouched. Link source-tracked /ma.
- **Integrity:** content-only, nothing posted. #41 -> review (not mine to close the operator-QA gate).
- **Next:** morning of 28/06, run the #41 data re-verify (monkey rank + group-stage close); if a 4th exact hit lands in the 26-28/06 finale, swap it in as the hero. Once operator approves Mastodon, #43/#44 ship from the VPS with no laptop the instant R32 opens.

---

## 2026-06-25 Builder — verified the scoring triple-mirror end-to-end ahead of the group finale; no code gap (honest)
- **Read live state first.** Local HEAD == prod HEAD == 8e85a2b, tree clean. Prod healthy (db ok, uptime ~5.4h). 54/72 group matches played (results nested under `result`), 18 group games remain 25-27/06; 32 knockout slots still TBD until the 29/06 fill. No `todo`/`in_progress` builder task — all builder tickets sit in `review`/`done` (operator-QA gate). Did NOT fabricate work.
- **Chased a real, un-verified correctness risk instead of re-logging "no gap."** Prior sessions verified knockout scoring safety (#7) and the TBD-slot UI pollution fix (#42). The one thing nobody had explicitly diffed: do the THREE independent scoring implementations agree? If they drift, a user's leaderboard total, the per-card `+pts` badge, and the "why did I get X points?" breakdown modal disagree — a live, demoralizing group-finale bug.
- **Result: byte-identical across all three.** server `computeBoard()` (server.js:857-897), client `renderCard()` inline pills, and client `showPointsBreakdown()` (index.html:1398-1400) all use the same stage table (בתים=1…גמר=6), same `Math.min(odds,8)` cap, same 5/3/2 base (exact/diff/result), same no-odds→1.0 floor, same `Math.round`. They cannot disagree. Also confirmed: breakdown is reachable (`onclick` on the status pill + `+pts ⓘ` chip, gated on `res && pred`); all 13 `bd_*` i18n keys carry HE+EN; no TODO/FIXME defects (only token-format doc comments in notifications.js).
- **Standings/qualification is NOT automated** — the bracket is operator-filled via `update-teams`, so there's no 48→32 best-third-place tiebreaker computation to get wrong. No trap there.
- **Outcome:** no P0/P1 builder code gap today; the live scoring surface is provably consistent for the group finale. Added the verification as a progress comment on #2; left it in `review` (not mine to close the QA gate).
- **Next:** the real next builder beat is the 29/06 R32 bracket fill — if a defect surfaces post-fill (odds/lock timing on a slot scored before update-teams), act then. Stand ready. Distribution (operator/laptop-gated, Mastodon the one autonomous channel) remains the standing growth lever.

---

## 2026-06-25 Growth-Content — turned a fresh, verifiable monkey hit into a moment-marketing proof wave (the angle the campaign was missing)
- **Read live state first.** Prod healthy. All growth-content tasks sit in `review`/`done` (the recurring operator-QA-gate state). Rather than re-log "nothing to do" or fabricate busywork, I chased the live data for a real, time-sensitive hook — and found one in last night's results.
- **The gap:** existing monkey content was either reassurance (#22: "monkey is mid-table, humans beat it") or a generic future-dated knockout wave (#41, fires 29/06). Nobody had the **credibility/intrigue** angle — proof the gimmick is real — and a fresh proof point had just landed.
- **Grounded the copy in real prod data (computed over all 54 played group matches via `/api/matches`, not vibes):** the monkey called **מרוקו 4-2 האיטי EXACTLY** last night (25/06) — a chaotic 6-goal scoreline predicted from a zoo webcam, the single most shareable monkey moment we have. Honest supporting stat: **41% correct outcomes** (random ~33%), 3 exact-score hits total. "Beats nearly half the players" matches the verified ~17/30 mid-table rank.
- **Shipped 3 drafts to #22 (status → review):** (1) HE WhatsApp/TG broadcast, copy-paste, source-tracked /wa+/tg; (2) HE Mastodon; (3) EN Mastodon. Mastodon is our **one autonomous channel** — #2/#3 can ship from the VPS the instant the operator approves, no laptop.
- **Timing is the whole point.** This fires the **group-stage-finale window NOW (25-27/06)** — it's freshness-dependent and decays fast, unlike #41 which correctly waits for the 29/06 knockout open. Two waves, two windows, no overlap.
- **Next:** if operator approves, the HE/EN Mastodon proof posts ship autonomously; then mirror the same exact-hit proof into the 29/06 knockout wave (#41) for a one-two credibility punch. Re-run the monkey exact-hit stat after the final group matches (27/06) in case a 4th hit lands worth leading with.

---

## 2026-06-25 Builder — closed a live correctness bug ahead of the 29/06 knockout: TBD slots were polluting the predict UI + reminders
- **Read live state first.** Prod healthy, local HEAD == prod HEAD == 5f00d89, tree clean. No `todo`/`in_progress` builder task; all builder tickets `review`/`done`. Rather than repeat the prior sessions' "no code gap" QA, I chased the ONE live forward event (R32 opens 29/06) for an actual defect, not a fabricated one.
- **Found a real, live bug (and a dated one).** The 32 knockout matches are seeded `team_a/team_b=TBD` with kickoff 29/06+. With no teams and a future kickoff, `isLocked` is false, so the client rendered them as **open, predictable "TBD vs TBD" cards** (confirmed on prod: 32/32 render open). Consequences live *today* and worsening toward 29/06:
  - progress bar denominator inflated by 32 un-fillable matches;
  - the **B-5 unpredicted-count badge** (built to *drive* completion) stuck at ~32 nobody can clear — demoralizing, the opposite of its purpose;
  - the missing-predictions alert literally lists "TBD - TBD";
  - **notifications.js** counted them too, so the 08:00 digest + 2h pre-match push would have spammed every player on the **morning of 29/06** with "16 matches today without predictions, first: TBD vs TBD".
- **Fix (commit 2770dc5, deployed + verified live).** Treat a match as not-yet-predictable while either team is TBD: client (`renderPredictions`) excludes TBD from `upcoming` (progress/badge/alert) and renders TBD cards disabled+greyed with a "טרם נקבעו קבוצות" pill instead of OPEN; both notification queries exclude TBD. It auto-reverts to fully predictable the moment the operator fills the bracket via `update-teams` (real names + odds), no further code. Status pills stay hardcoded-Hebrew per existing convention, so no i18n surface touched.
- **Verified:** node --check clean on all touched files; clean boot test (fresh port, /health ok, served HTML carries the pill + filter); deployed via deploy-prod.sh; prod HEAD 2770dc5, prod serves the pill + filter, prod notifications.js has both guards. #42 -> done.
- **Next:** stand ready for the actual 29/06 bracket fill; if a defect surfaces post-fill (odds/lock timing on a slot scored before update-teams), that's the next builder beat. Distribution (operator/laptop-gated, with Mastodon the one autonomous channel) remains the standing growth lever.

---

## 2026-06-25 PO — broke the multi-day distribution deadlock into a single one-tap decision, and shipped the missing attribution for our one autonomous channel
- **Read live state first.** Prod healthy (uptime ~17.3h, 30 players, group stage). Monkey רותם rank 17/30, 145 pts vs median 151 — mid-table, 16/29 humans above it, so every "most players already beat the monkey" claim still verifies true. Local HEAD == origin, clean. Board unchanged structurally: all builder/content in `review` (operator QA gate), 9 growth-browser `blocked` on the same wall (no non-operator identity to post from).
- **The insight prior runs glossed over:** the standing diagnosis ("distribution is 100% operator/laptop-gated") is wrong in ONE place — **Mastodon posts autonomously from the VPS** via the social publisher (confirmed `get_social_publisher_status`: Mastodon = direct API, tested). It's the single channel where operator-approval → content actually ships with no laptop. Prior escalations were vague ("approve posting"); the operator never acted. I converted it into a concrete one-tap.
- **Shipped (autonomous, verified, live on prod):** found we had source-tracked redirects for /wa /tg /fb /rd /ig /tw /qr but **none for Mastodon** — our one autonomous channel had zero attribution. Added `/ma → ?ref=mastodon` (server.js), node --check + boot-test (302 verified), pushed; prod auto-deployed (curl confirms `/ma` 302 on :3000). Then wrote **LAUNCH-KIT §12** = Mastodon-native copy (EN lead + HE), drift-checked, using the source-tracked /ma link. So the channel, link, and copy are all fire-ready.
- **Orders written (decision format):** growth-content #1 #22 (Mastodon copy staged, needs only the YES) / #2 #41 (knockout re-verify morning 28/06); growth-browser #1 #40 (Mastodon unblock exists today; next key = Rotem persona on TG/Reddit); builder #1 #8 (/ma shipped, stand ready for 29/06 bracket fill).
- **No kills.** `review` items = operator QA gate (not mine to close); blocked growth-browser items blocked on real dependency #40 — closing any would lack evidence.
- **Escalated to operator (TG):** ONE concrete decision — reply "YES mastodon" to publish the exact Beat-the-monkey post to Mastodon now (it ships from the VPS, no laptop). That is the only distribution lever I can pull autonomously the instant it's approved.
- **Next run:** check if the operator approved; if YES, publish to Mastodon via the social publisher and report the post URL + any /ma click uptick. Then mirror a Mastodon knockout variant for the 29/06 R32 open.

---

## 2026-06-24 Builder — verified the one live forward risk end-to-end: knockout scoring is safe for 29/06 (no code gap)
- **Read live state first.** Local HEAD == origin/main, clean, nothing unpushed. Prod (port 3000): 30 players, 273-pt 6-way logjam at top, 104 matches = 72 group (בתים) + 32 knockout slots (שמינית גמר 16 / רבע 8 / חצי 4 / 3rd 1 / final... full bracket seeded). No `todo`/`in_progress` builder task — all P0/P1/P2 sit in `review` (operator QA gate) or `done`. Did NOT fabricate work.
- **Chased the PO's #1 builder order (#7): does base×stage×odds survive the 29/06 knockout, or 500/award-0?** Traced the whole path against live prod + source, not the board summary:
  - **Live finding:** all 32 knockout matches currently have **no odds rows** (`/api/matches` → `odds:null`, teams still TBD). On its own that means `getOddsMultiplier` would hit its `1.0` floor.
  - **Why that's safe, not a bug:** odds are seeded by `POST /api/matches/:id/update-teams` (server.js:751) at the moment the operator fills each bracket slot — strength-based via `computeDefaultOdds()` (TEAM_STRENGTH table), `INSERT OR IGNORE` so it never clobbers real fetched odds. The design intentionally waits for teams before seeding meaningful odds. So the normal flow (fill teams → score) always has real odds.
  - **Even the edge case degrades gracefully, never crashes:** `computeBoard()` (server.js:844) is null-safe — `stageBase[match?.stage]||1` (knockout stages = 2..6, never 1), `if(!res) continue`, `if(odds)` else `oddsVal=1.0` floor capped at 8.0. A correct result always scores ≥ `2×mult×oddsVal`. No 500, no award-0; worst case is a 1.0 odds floor only if a match is scored while teams are still TBD (which the fill-then-score flow structurally avoids).
- **Outcome:** PO #1 forward risk (#7) confirmed closed. No builder code gap to ship today. Distribution (operator/laptop-gated) remains the one live lever, per the standing PO note.
- **Next:** the real next builder beat is the actual 29/06 bracket fill — if a defect surfaces post-fill (odds/lock timing, or a slot scored before update-teams), that's the moment to act. Stand ready.

## 2026-06-24 Growth-Content — turned the two about-to-fire waves from briefs into rendered art (PO order #3), locked the knockout copy
- **Read live state first.** Prod: 30 players, group stage (last 24 group games run 24-27/06), knockout R32 (שמינית גמר, 32 teams) opens 29/06. Leaderboard: 6-way 273-pt logjam at the top, monkey רותם rank **20/30** (most players above it). No `todo`/`in_progress` content task — all 7 content drafts sit in `review`, the recurring state.
- **Picked the one order that was actionable TODAY, not just parked.** PO's #1 (#41 knockout) explicitly defers its full data re-verify to the morning of 28/06; PO's #2 (#22) says "nothing more to write." PO's **#3 (#34)** was the real gap: both waves had image briefs but **no rendered art**, and `generate_image` is now available — so visuals were the move with the highest live leverage.
- **Done.** Rendered two campaign hero images via generate_image (FLUX, pollinations fallback), stored in `socials/memes/`: **11-beat-monkey-leaderboard.jpg** (humans celebrating atop a glowing leaderboard, monkey stranded mid-pack — backs #22/#38-39) and **12-knockout-win-or-go-home.jpg** (floodlit pitch, one side advancing through a bracket gate, the other walking off — backs #41). QA'd both visually: on-brief; on-screen text is garbled (inherent to image-gen) so the operator overlays the real Hebrew copy — art is the backdrop. Documented asset paths in **LAUNCH-KIT §11**. #34 → review.
- **Also locked #41 copy:** re-verified §11 hooks against live data — R32=32 teams/29/06 (win-or-go-home holds), monkey mid-table/most-players-above (drift-proof, no exact rank). Copy + art staged for growth-browser to fire 28-29/06; final morning-of-28/06 re-verify still due per PO. Committed + pushed.
- **Next:** morning of 28/06, run the final #41 data re-verify (monkey rank + group-stage close) before the knockout handoff. Distribution remains the one live, operator/laptop-gated lever.

## 2026-06-24 PO — daily cycle: re-anchored everything on the one live lever (distribution) ahead of the 29/06 knockout
- **Read live state first.** Prod healthy (uptime ~16.7h, 29 players, group stage, 273-pt logjam at the top, monkey רותם mid-table). Builder: every task built + LIVE, sitting in `review` (board-QA state, not a deploy gate). Growth-content: 7 drafts ready incl. knockout wave (#41 drafts 36/37) + refreshed Beat-the-monkey (#22 -> #38 HE/#39 EN, now factually true). Growth-browser: 9 blocked, all behind the same wall — no non-operator identity to post from.
- **The diagnosis (consistent 3+ days):** product done, content done, distribution is the ONLY lever and it is 100% operator/laptop-gated. 13 days into the WC with the R32 knockout opening 29/06 (group stage ends ~27-28/06), we have zero autonomous distribution. The tournament window is our entire reason to exist and it is burning.
- **Orders written (decision format):**
  - growth-browser: #40 provision Rotem-the-monkey persona per platform (Mastodon/TG/Reddit first) = the unblock key [#1]; #15 TG post #38 now + stage knockout #37 for 28-29/06 [#2]; #16 Reddit warm-then-seed knockout match threads [#3].
  - growth-content: #41 lock knockout copy + image brief, re-verify data morning of 28/06 [#1]; #22 mark #38/#39 the first autonomous post, wired to /wa /tg [#2]; #34 render the meme art behind both waves [#3].
  - builder: #7 verify knockout fixtures get odds so base×stage×odds scoring does not 500/award-0 on 29/06 (the one real forward risk) [#1].
- **No kills.** Nothing clearly stuck/broken/obsolete enough to close without evidence (#38 handoff-channel is the only candidate; left it).
- **Escalated to operator (TG):** (A) is the laptop growth-worker agent-1e6f570e live? If not, that is the #1 fix. (B) approve posting Beat-the-monkey + knockout content to public channels (all public posts are stop-and-ask). Without A or B, 25 drafts + the built product sit idle through our peak window.
- **Next run:** check whether #40 produced a live persona and whether operator approved posting; if yes, the very first autonomous post should be Beat-the-monkey (#38), then the knockout wave at bracket open.

## 2026-06-23 Growth-Content — executed the actual #1 PO order: refreshed "Beat the monkey" to the now-true framing
- **Read live state first.** No `todo`/`in_progress` content task; 25 drafts sit in `review`. But the earlier Growth run today chased a self-found beat (knockout wave #41) and skipped the one task that carried an explicit, dated PO **order**: #22 "Beat the monkey" challenge, flagged this morning (05:42) as "#1 for growth-content today."
- **The real gap.** #22's live drafts (v1 HE / v2 EN, June 5) assert *"the monkey is winning / it beats half the players"* — a pre-tournament guess that is now **false**. Per `/api/leaderboard`, the monkey רותם sits **mid-table** (rank 17/29) with most humans above it. Our single most credible proof point was live on the board while the campaign still treated it as hypothetical, and the CTA still said "before June 11" (12 days dead).
- **Done.** Wrote refreshed drafts **#38 (v3, HE)** + **#39 (v4, EN)**: flipped the hook to the proven proof point ("real people already beat the monkey — will you stay above it?"), dropped the expired date, split the combined broadcast into source-tracked WhatsApp (`/wa`) + Telegram (`/tg`) copies, reused the §10 mid-tournament hook, and updated all 3 image briefs (humans on top, monkey stranded mid-pack). Drift-proof (qualitative "mid-table", no exact rank), no em dashes. #22 → `review`.
- **Notes:** Content only, nothing posted. Distribution (#14-19, operator/laptop-gated) remains the one live lever.
- **Next:** awaiting operator QA on #22/#38/#39 and the rest of the `review` queue.

---

## 2026-06-23 Builder — QA pass, no code gap: verified prod + the full knockout pipeline is ready for June 29
- **Read live state first.** Prod healthy (28 players, 1241 predictions, 44/104 scored, still group stage). Local HEAD == origin/main, nothing unpushed, no drift. Board: every builder task (P0/P1/P2) is already implemented and sits in `review` (operator QA gate) or `done`. No backlog or in_progress builder task.
- **Smoke-tested the recently shipped flows on prod, all green:** share-card API (`/api/card/13` → JSON rank/points + `image/svg+xml` SVG), source redirects `/wa`→`?ref=whatsapp` and `/tg`→`?ref=telegram` (both 302), leaderboard renders 29 rows.
- **Looked forward to the next real event — the knockout transition (~29/06) — and confirmed it is fully built, not just parked in review.** #8 ("edit knockout team names as bracket fills") is end-to-end: 32 TBD slots seeded (`server.js` knockoutRounds), round labels i18n'd across 9 languages (`i18n.js`), admin endpoint `POST /api/matches/:id/update-teams` (admin-gated + non-empty validation), AND the admin UI surface — `renderAdmin()` renders editable team inputs + an "עדכן" button per knockout match wired to `updateTeams()`. Operator can fill the bracket as teams advance with no further code.
- **Outcome:** no builder gap to close today; did not fabricate work. The one live lever remains distribution (#14-19, operator/laptop-gated), per the PO note.
- **Next:** stand ready for the knockout transition; if a real defect surfaces post-bracket-fill (e.g. odds/lock timing on R32), that's the next builder beat.

---

## 2026-06-23 Growth-Content — drafted the next tournament beat: the knockout-stage wave
- **Read live state first.** All my assigned content tickets (#22–25, #30, #34) are already in `review`; #37 opener recap is done-and-now-expired. No content task in backlog, so I looked for the next *organic beat that has no copy yet*. LAUNCH-KIT §10 (mid-tournament wave) was added today and covers the group-stage back half. The gap: nothing for the **group-stage → knockout transition**.
- **Grounded in real data, not assumptions.** `/api/matches`: group stage runs through ~27–28/06; the first knockout round (app label **שמינית גמר**, 32 teams, 16 single-elim games) opens **29/06**. `/api/leaderboard`: monkey **רותם** sits rank **17/29** — 16 of 28 human players already above it, so a "you've beaten the monkey, now defend your lead" framing is truthful.
- **Done:** Drafted the knockout wave (HE) — WhatsApp draft **#36** + Telegram draft **#37** on new task **#41** (G-19, → `review`). Two drift-proof hooks: single-elimination win-or-go-home (no more meaningless draws; odds multiplier matters most) + monkey-is-mid-table. Same source-tracked `/wa` `/tg` links. Mirrored into **LAUNCH-KIT §11** and fixed the After-posting timeline (§9 marked expired, §10→§11 handoff at knockouts).
- **Notes:** Content only, nothing posted. Leads with the monkey hook, includes the site link, no em dashes (matches kit convention). Operator fires §11 ~28–29 June, replacing §10 for the rest of the tournament.
- **Next:** Awaiting operator review of #41 + the other `review` drafts. Distribution remains the one live lever (warm channels, operator/laptop-gated).

---

## 2026-06-23 Builder — closed the real gap behind PO order #31: the viral card was unreachable for every live user
- **Read live state first.** Prod healthy, local HEAD == deployed. PO's #1 builder order today: land the share-card API (#31) and wire it into the in-app share loop. The API (`GET /api/card/:id`) and `shareCard()` were already built + deployed (per memory + code) — so I checked WHERE the loop actually surfaces, not whether it exists.
- **The defect:** `shareCard()` had exactly one entry point — the post-prediction nudge (`loadNudgeButtons`), which renders only when `predCount 1-10 && !dismissed`. The 26 real users average ~47 predictions each (1230 preds / 26), so **every current player has aged out of that window** — the K-factor card was unreachable for the entire live userbase. That is the gap the PO order describes ("wire it into the share loop"): it was only half-wired.
- **Fix (additive, low-risk, front-end only):** added a persistent share-card button to the always-on monkey widget (`#monkeyShareBtn`), revealed for logged-in users in `loadMonkeyWidget()`, with a beat-the-monkey taunt (`share_beating_monkey`, he+en) when the user leads the monkey head-to-head — ties directly to the PO's "beat-the-monkey is now PROVEN" proof point. Card API untouched.
- **Verified:** inline JS + i18n.js + server.js syntax clean; booted test server (health ok, button + key serve); card API confirmed live in prod (`/api/card/13?format=json` -> rank 1/28, 250pts, `beating_monkey:true`, SVG `image/svg+xml`). Committed **da77c3b**, deployed via deploy-prod.sh, prod md5 == local, button + key served over HTTPS, health ok. #31 -> done.
- **Next:** PO #3 (#5 unpredicted badge) already QA-signed-off + live (06-08). #2 points-breakdown likewise live. No remaining builder code gap; distribution (#14-19, operator/laptop-gated) is still the whole growth lever.

---

## 2026-06-23 Product Owner — Day 12: broke the 12-day standup silence, refreshed stale launch copy, re-prioritized around the one dead lever (distribution)
- **Read live state, did NOT trust the frozen board summary.** App healthy (uptime ~13.6h), 29 players (~26 real humans + monkey + a few test rows), 1230 predictions, **44 results scored in prod**. Still GROUP STAGE (44/72), every upcoming match `locked:false` — join window wide open, with England/Brazil/Portugal/Colombia all in the next 48h.
- **The signal that matters:** the monkey 🐒 רותם sits MID-TABLE (108 pts, ~16 players ahead). "Beat the monkey" is now PROVEN, not promised — our strongest, most honest proof point, and the old copy still treated it as hypothetical. Signups trickle ~1/day purely organically: **distribution (#14-19) has never fired in 12 days.** That is the whole gap.
- **Did (autonomous, drafting + board hygiene — posting stays operator/laptop-gated):**
  - Drafted + committed **LAUNCH-KIT §10 mid-tournament wave** (WA+TG, Hebrew, drift-proof: marquee nations + monkey-mid-table, no fabricated figures, no emdashes) — commit d6652af.
  - **Killed #37** (opener recap, Mexico v SA — played June 11, 12 days dead) and flagged kit §9 EXPIRED / do-not-fire.
  - Posted decision-format orders on **top 3 per role** (#14/#15/#40 browser; #22/#34/#23 content; #31/#2/#5 builder).
  - TG'd the operator: fire §10 now from the laptop worker; it's the entire growth lever and it's been off since kickoff.
- **Note:** builder is actively self-shipping to main outside the review tickets (recent: pin-today's-games, real-time-to-kickoff reminder). The 26 `review` tasks are the operator QA gate, not idle work.
- **Operator-gated (escalated, per STOP-AND-ASK on public content):** fire §10 on WhatsApp + Telegram; optionally provision Rotem persona accounts (#40) so future waves are autonomous. Laptop worker (agent-1e6f570e) provisioned June 22 = this is finally possible.

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
