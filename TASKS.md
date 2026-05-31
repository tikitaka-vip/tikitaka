# TikiTaka.vip Launch Tasks

Status: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked · `[-]` skipped

---

## Phase 0 — VPS
- [x] **0.1** Rent VPS — Vultr, TLV, 1GB/$5mo
- [x] **0.2** Initial setup — SSH key, firewall (ufw), Node.js
- [x] **0.3** App deployed — Express + SQLite, systemd service
- [x] **0.4** Caddy reverse proxy

## Phase 1 — Domain & DNS
- [x] **1.1** Register tikitaka.vip (Porkbun, $3.12/yr, WHOIS privacy on)
- [x] **1.2** Add domain to Cloudflare
- [x] **1.3** DNS A record → VPS IP (proxied)
- [x] **1.4** www CNAME → tikitaka.vip
- [x] **1.5** SSL mode → Flexible (Cloudflare terminates)
- [x] **1.6** Force HTTPS redirect (Cloudflare Always Use HTTPS)
- [x] **1.7** HSTS header (max-age=31536000, includeSubDomains)
- [x] **1.8** Security headers (X-Frame-Options DENY, nosniff, Referrer-Policy, TLS 1.2 min)

## Phase 2 — Auth
- [x] **2.1** Google Sign-In (OAuth client ID configured)
- [x] **2.2** Session tokens (localStorage, persist across visits)
- [x] **2.3** PIN fallback auth
- [x] **2.4** Admin role (evyatar.kaplan@gmail.com only)
- [x] **2.5** Add tikitaka.vip to Google OAuth authorized origins
- [x] **2.6** Google consent screen published

## Phase 3 — Core Game Features
- [x] **3.1** 104 real matches (72 group + 32 knockout) with dates/times/venues
- [x] **3.2** Score-based predictions (exact score input)
- [x] **3.3** Predictions lock at kickoff (server-side enforced)
- [x] **3.4** Predictions confidential until kickoff (API-level)
- [x] **3.5** Tournament predictions (winner, runner-up, top scorer) with dropdowns
- [x] **3.6** Tournament predictions lock before June 11
- [x] **3.7** Auto-fill missing predictions (0-0 or player average)
- [x] **3.8** Monkey random guesser per group
- [x] **3.9** Monkey tournament predictions (random winner/scorer picks)
- [ ] **3.10** Edit knockout team names as bracket fills in (admin)

## Phase 4 — Scoring System
- [x] **4.1** Base scoring (exact=5, diff=3, result=2)
- [x] **4.2** Stage multipliers (groups ×1 → final ×6)
- [x] **4.3** Odds-based surprise multiplier (The Odds API)
- [x] **4.4** Outright winner odds for tournament bonus multiplier
- [x] **4.5** Per-group customizable scoring (manager sets weights)
- [ ] **4.6** Display points breakdown per match (how calculated)
- [ ] **4.7** Show potential points before kickoff ("if you're right, you'll earn X")

## Phase 5 — Groups
- [x] **5.1** Create group with invite code
- [x] **5.2** Join group via code (case-insensitive)
- [x] **5.3** Join via invite link (/join/CODE)
- [x] **5.4** Group leaderboard
- [x] **5.5** Group compare (predictions visible after kickoff)
- [x] **5.6** Share buttons (WhatsApp, Telegram, copy, native share)
- [x] **5.7** Confidentiality message in share text
- [x] **5.8** Multiple groups per player
- [x] **5.9** Manager scoring config
- [ ] **5.10** Leave group button
- [ ] **5.11** Group stats (most accurate player, biggest upset caller, etc.)
- [ ] **5.12** Matchday summary (who won today's round in the group)

## Phase 6 — Data & APIs
- [x] **6.1** The Odds API integration (match odds)
- [x] **6.2** The Odds API integration (outright winner odds)
- [x] **6.3** Auto-fetch match results (every 5 min)
- [x] **6.4** Auto-fill missing predictions on result
- [ ] **6.5** Auto-fetch odds daily (cron)
- [ ] **6.6** Handle knockout team name updates from API

## Phase 7 — PWA & Mobile
- [x] **7.1** manifest.json + service worker
- [x] **7.2** App icons (monkey + soccer ball)
- [x] **7.3** Maskable icon for Android
- [x] **7.4** iOS install banner ("הוסף למסך הבית")
- [x] **7.5** Android install prompt
- [x] **7.6** Mobile-responsive CSS
- [x] **7.7** Hebrew RTL throughout
- [ ] **7.8** Offline fallback page (service worker)
- [ ] **7.9** Push notifications (new results, leaderboard changes)

## Phase 8 — Polish & UX
- [ ] **8.1** Loading skeleton while data fetches
- [ ] **8.2** Pull-to-refresh on mobile
- [ ] **8.3** Animated score reveal after match ends
- [ ] **8.4** Confetti/celebration on exact prediction
- [ ] **8.5** Sound effects toggle
- [ ] **8.6** Dark/light theme toggle
- [ ] **8.7** Onboarding flow for new users (what is this, how to play)
- [x] **8.8** "Next match" countdown timer on home screen
- [ ] **8.9** Notification badge for unpredicted matches

## Phase 9 — SEO & Sharing
- [x] **9.1** OG tags (title, description, image) for tikitaka.vip
- [x] **9.2** OG image (monkey + soccer ball icon)
- [x] **9.3** Dynamic OG for invite links (/join/CODE shows group name + member count)
- [x] **9.4** robots.txt + sitemap.xml
- [x] **9.5** Google Search Console verification
- [x] **9.6** Short link (spoo.me/wc26il)

## Phase 10 — Monitoring & Reliability
- [ ] **10.1** Uptime monitoring (UptimeRobot or BetterStack → TG alert)
- [ ] **10.2** Error logging (server-side, persist to file)
- [ ] **10.3** DB backup cron (daily, to local + offsite)
- [ ] **10.4** Rate limiting on API endpoints
- [ ] **10.5** Graceful error pages (not raw JSON on 500)

## Phase 11 — Distribution & Marketing
_Tournament starts June 11. 11 days. Every day counts._

### Owned channels (do first)
- [ ] **11.1** WhatsApp status + broadcast to all contacts
- [ ] **11.2** TG personal channel / group posts
- [ ] **11.3** Instagram story + reel (countdown + monkey hook)
- [ ] **11.4** Facebook post in Israeli football groups
- [ ] **11.5** Twitter/X post (Hebrew + English)

### Communities (high leverage)
- [ ] **11.6** Reddit — r/Israel, r/worldcup, r/soccer, r/football (Hebrew angle)
- [ ] **11.7** Facebook groups — Israeli sports groups, office/friend group pages
- [ ] **11.8** Telegram channels — Israeli sports channels, tech channels
- [ ] **11.9** Discord — Israeli servers, football servers
- [ ] **11.10** WhatsApp communities — forward the invite to group admins

### Viral mechanics (built into product)
- [ ] **11.11** "Beat the monkey" social challenge — share result image
- [ ] **11.12** Shareable prediction card (image of your picks for today)
- [ ] **11.13** Weekly digest message to group (TG/WhatsApp)
- [ ] **11.14** Referral tracking (who invited whom)
- [ ] **11.15** Leaderboard screenshot generator (share-worthy)

### Content
- [ ] **11.16** Hebrew blog post — "למה ניחוש הפתעה שווה יותר" (explain the odds system)
- [ ] **11.17** Short video — screen recording of the app, monkey reveal
- [ ] **11.18** Meme templates (monkey losing to humans / humans losing to monkey)

### Press / Influencers
- [ ] **11.19** Israeli sports bloggers / podcasters — pitch the monkey angle
- [ ] **11.20** Tech bloggers — "built in a day with AI" angle

---

## API Keys

| Service | Status |
|---------|--------|
| Vultr | [x] Saved in session |
| Porkbun | [x] ~/.agent-factory/credentials.env |
| Cloudflare | [x] ~/.agent-factory/credentials.env |
| The Odds API | [x] In app DB |
| Google OAuth | [x] Client ID in app DB |

---

_Last updated: 31 May 2026_
