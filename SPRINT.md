# TikiTaka Sprint — June 5-11, 2026

World Cup starts June 11. Everything below is prioritized for launch readiness.

## Priority Legend
- **P0** — Must ship before June 11
- **P1** — Ship if time allows
- **P2** — Nice to have, skip if tight

---

## Builder Queue

### P0 — Ship before June 11
- [ ] **B-1** Onboarding flow for new users (8.7) — First-time visitors need to understand what this is and how to play in <10 seconds
- [ ] **B-2** Points breakdown per match (4.6) — Users will ask "why did I get X points?" Show the math
- [ ] **B-3** Uptime monitoring (10.1) — UptimeRobot free tier → TG alert. Cannot go down during the tournament
- [ ] **B-4** DB backup cron (10.3) — Daily SQLite backup. Losing predictions = game over
- [ ] **B-5** Notification badge for unpredicted matches (8.9) — Drive completion rate

### P1 — Ship if time allows
- [ ] **B-6** Loading skeleton (8.1)
- [ ] **B-7** Auto-fetch odds daily (6.5)
- [ ] **B-8** Edit knockout team names as bracket fills (3.10)
- [ ] **B-9** Graceful error pages (10.5)
- [ ] **B-10** Rate limiting on API endpoints (10.4)

### P2 — Skip unless bored
- [ ] **B-11** Animated score reveal (8.3)
- [ ] **B-12** Confetti on exact prediction (8.4)
- [ ] **B-13** Dark/light theme toggle (8.6)

---

## Growth Queue

### P0 — Do before June 11
- [ ] **G-1** WhatsApp status + broadcast to all contacts (11.1)
- [ ] **G-2** TG personal channel / group posts (11.2)
- [ ] **G-3** Reddit posts — r/Israel, r/worldcup, r/soccer (11.6)
- [ ] **G-4** Facebook groups — Israeli sports groups (11.7)
- [ ] **G-5** Follow up on awaiting_admin forum registrations (bigsoccer, thefootballforum, milanworld, etc.)
- [ ] **G-6** Post in all active forums (xtratime, forumfoot, talkchelsea, villatalk, redcafe)
- [ ] **G-7** Check directory submission statuses (betalist, uneed, launchingnext, etc.)

### P1 — High leverage content
- [ ] **G-8** Shareable prediction card image generator (11.12) — needs Builder
- [ ] **G-9** "Beat the monkey" social challenge copy + images (11.11)
- [ ] **G-10** Short video — screen recording of the app (11.17)
- [ ] **G-11** Meme templates (11.18)
- [ ] **G-12** Hebrew blog post about odds system (11.16)

### P1 — More communities
- [ ] **G-13** Telegram channels — Israeli sports + tech (11.8)
- [ ] **G-14** Discord — Israeli servers, football servers (11.9)
- [ ] **G-15** WhatsApp communities — forward invites (11.10)
- [ ] **G-16** Instagram story + reel (11.3)
- [ ] **G-17** Twitter/X post Hebrew + English (11.5)

---

## Standup Format
Each agent writes to STANDUP.md at start of session:
```
## [Date] [Role]
- **Done:** what was completed
- **Blocked:** what needs operator input
- **Next:** what's planned
```

---

## Decision Authority
| Do it | Do it + notify (TG) | Propose + wait |
|---|---|---|
| Fix bugs, add polish, draft content, update TASKS.md | Deploy to VPS, post on forums as tikitaka_vip, submit to directories | Spend money, post under real identity, change scoring/game mechanics, contact real people |
