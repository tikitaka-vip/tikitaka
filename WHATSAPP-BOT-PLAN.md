# WhatsApp Bot Plan — sign up & guess from chat

**Goal:** Let people join TikiTaka and submit match predictions ("guesses") entirely inside
WhatsApp, no browser. Built on the WhatsApp Cloud API (Meta Graph), mirroring the existing
Telegram bot in `notifications.js`.

## 0. Status — credentials (DONE)

Stored in Infisical `prod` `/ops/tikitaka` (projectId `9a155f01-...`):

| Secret | Source |
|---|---|
| `WHATSAPP_ACCESS_TOKEN` | the `EAAX…` token (⚠ likely a 24h/temp token — see §7) |
| `WHATSAPP_PHONE_NUMBER_ID` | `1133074496563254` |
| `WHATSAPP_PHONE_NUMBER` | `+972559253120` |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | `868489259089731` |
| `WHATSAPP_APP_ID` | `1669642917605552` |
| `WHATSAPP_APP_SECRET` | app secret (for webhook signature verification) |
| `WHATSAPP_VERIFY_TOKEN` | generated, for webhook GET handshake |

## 1. Architecture

Add a `whatsapp.js` module next to `notifications.js`, wired the same way:

- `server.js:9` already imports from `./notifications`. Add `const { setupWhatsAppRoutes } = require('./whatsapp')`.
- `server.js:1787` calls `setupNotificationRoutes(app, db)`. Add `setupWhatsAppRoutes(app, db)` beside it.
- Reuse helpers already in `server.js`: `createAutoGroup()` (1022), `generateToken()` (486),
  `isLocked()` (387), and the predictions write at `server.js:783`
  (`INSERT OR REPLACE INTO predictions …`). The guessing flow must call the **same** validated
  write path so web and WhatsApp predictions stay identical.

WhatsApp Cloud API send (one helper, like `sendTelegram` at `notifications.js:42`):
```
POST https://graph.facebook.com/v22.0/{PHONE_NUMBER_ID}/messages
Authorization: Bearer {WHATSAPP_ACCESS_TOKEN}
{ messaging_product: "whatsapp", to, type: "text"|"interactive", ... }
```

## 2. DB changes (additive, follow the migration list at `server.js:215`)

```
['whatsapp_id',          "ALTER TABLE players ADD COLUMN whatsapp_id TEXT"],         // wa phone (wa_id)
['wa_pending_match_id',  "ALTER TABLE players ADD COLUMN wa_pending_match_id INTEGER"], // which match we're asking about
```
- `whatsapp_id` mirrors `telegram_chat_id` — identifies returning users.
- `wa_pending_match_id` holds the lightweight conversation state for guessing (which match a
  free-text "2-1" reply applies to). Avoids a separate session table.
- Optionally a `wa_login_tokens` table mirroring `tg_login_tokens` (238) **only if** we also want
  "log in to the website via WhatsApp." Not required for sign-up-and-guess-in-chat.

## 3. Webhook (two routes)

```
GET  /api/whatsapp/webhook   // Meta verification handshake
POST /api/whatsapp/webhook   // incoming messages
```
- **GET:** echo `hub.challenge` when `hub.verify_token === WHATSAPP_VERIFY_TOKEN`.
- **POST:** ack `200` immediately (like `notifications.js:168`), then process
  `body.entry[].changes[].value.messages[]`. Verify `X-Hub-Signature-256` HMAC with
  `WHATSAPP_APP_SECRET` before trusting payloads.
- Register the URL once in Meta App dashboard → WhatsApp → Configuration, subscribe to `messages`.

## 4. Sign-up flow (port of the TG `/start` handler, `notifications.js:168-256`)

Entry point: click-to-chat link `https://wa.me/972559253120?text=join` — add a `/wa` redirect
target (the `/wa → whatsapp` ref-source already exists at `server.js:61`).

1. First inbound message with no matching `whatsapp_id`:
   - Create player: `INSERT INTO players (name, pin, session_token, lang, whatsapp_id, email_verified)
     VALUES (?, 'wa-auth', ?, ?, ?, 0)` (name from WhatsApp profile, `ref_source='whatsapp'`).
   - `createAutoGroup(playerId, name, lang)` — same as web/TG.
   - Send welcome + their group invite link `https://tikitaka.vip/join/{code}` (reuse `invite_tg`
     string, add a `welcome_wa`/`invite_wa` pair to `NOTIFY_STRINGS`).
2. Returning user (matched `whatsapp_id`): skip creation, go straight to guessing.

Language: default `he`, switch on WhatsApp profile locale if available, same as TG.

## 5. Guessing flow — THE NEW PART (not in the TG bot)

A simple state machine driven by `wa_pending_match_id`:

1. **Pick next match to ask:** the earliest upcoming match (`kickoff_utc > now`, not `isLocked`)
   that the player has no row for in `predictions`. Set `players.wa_pending_match_id = that id`.
2. **Prompt** with an interactive message:
   - Text: "🇲🇽 Mexico vs South Africa 🇿🇦 — kickoff 22:00. Your score?"
   - Offer **reply buttons** for the 3 most common scores (e.g. `1-0`, `2-1`, `1-1`) +
     instruction "or type any score like `3-2`". (WhatsApp caps reply buttons at 3; a list
     message allows up to 10 rows if we want more presets.)
3. **Parse reply:** accept button payload or free text matching `^\s*(\d{1,2})\s*[-:]\s*(\d{1,2})\s*$`.
   Validate `0–20` (same rule as `server.js:779`). Re-check `isLocked()` — reject if kickoff passed.
4. **Write** via the exact predictions upsert (`server.js:783`). Confirm: "✅ Saved Mexico 2-1
   South Africa." Clear `wa_pending_match_id`, then loop to step 1 for the next match.
5. **Commands** (free text): `next` (skip), `mine` (list my predictions for upcoming matches),
   `table`/`leaderboard` (my group standing vs the monkey), `stop` (pause prompts). Keep it small.

This reuses 100% of the scoring/validation logic — WhatsApp is just another input surface onto
`predictions` + `tournament_predictions`.

## 6. Reminders via WhatsApp (later, optional)

The TG scheduler (`startNotificationScheduler`, `notifications.js:260+`) sends pre-match nudges.
WhatsApp can reuse it **but**: see §7 — proactive messages outside the 24h window require an
**approved message template**. So reminders need 2–3 templates submitted for approval
("you have N unpredicted matches", "kickoff in 2h"). Within 24h of the user's last message we can
free-text. Ship guessing first; add templated reminders once a template is approved.

## 7. Constraints & credential handling (read before building)

- **24-hour window:** free-form replies are only allowed within 24h of the user's last inbound
  message. The whole sign-up + guess flow is user-initiated, so it's fine. Only proactive
  reminders need templates.
- **Token longevity:** an `EAA…` token is usually a 24h user token. For a server we need a
  **permanent System User token** (Meta Business Settings → System Users → generate token with
  `whatsapp_business_messaging` + `whatsapp_business_management`). Replace
  `WHATSAPP_ACCESS_TOKEN` in Infisical when we have it. **Confirm with Harel which kind this is.**
- **Runtime injection:** the TG token is currently *hardcoded* at `server.js:1785`. Don't hardcode
  the WA token. Inject from Infisical at runtime — launch the prod service with
  `infisical run --env=prod --path=/ops/tikitaka -- node server.js` (or have the deploy write the
  values into `/opt/worldcup/.env` and read `process.env.WHATSAPP_*`). Per credential-placement
  rules: Infisical is the source of truth; the app reads them as env at runtime.
- **Number registration:** the phone number must be registered/verified on the WhatsApp Business
  Account and have a display name approved before it can send.

## 8. Build order (tasks)

1. [infra] Confirm permanent token with Harel; register webhook URL in Meta dashboard.
2. [code] `whatsapp.js`: `sendWhatsApp()` + GET/POST webhook with signature check.
3. [db] Add `whatsapp_id`, `wa_pending_match_id` migrations.
4. [code] Sign-up handler (port of TG `/start`) + `welcome_wa`/`invite_wa` strings.
5. [code] Guessing state machine (§5) reusing the predictions upsert.
6. [test] End-to-end from a real phone: join → guess 3 matches → verify rows in `worldcup.db`.
7. [code] (optional) Templated reminders wired into the existing scheduler.
8. [growth] Put the `wa.me` link on the site + in outreach (`/wa` ref-source already tracked).
