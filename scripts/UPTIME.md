# Uptime Monitoring (B-3)

The app cannot go down during the tournament. Monitoring has two layers:

## 1. Health endpoint (shipped)

`GET https://tikitaka.vip/health` (alias `/healthz`)

- Returns `200` + `{"status":"ok","db":"ok","uptime_s":N}` when the DB responds.
- Returns `503` + `{"status":"error","db":"down"}` if the DB query fails.
- Not under `/api`, so it is **not rate-limited** and safe to poll frequently.
- `Cache-Control: no-store` so monitors always hit the live server.

## 2. External monitor — UptimeRobot (operator action, ~3 min)

Internal cron checks (the existing `/opt/worldcup/healthcheck.sh`) cannot fire
if the whole VPS is down. An **external** monitor closes that gap.

Set up at https://uptimerobot.com (free tier, 5-min interval):

1. **Add New Monitor**
   - Type: `HTTP(s)` (or `Keyword`)
   - URL: `https://tikitaka.vip/health`
   - Friendly name: `TikiTaka`
   - Monitoring interval: `5 minutes` (free tier minimum)
   - For Keyword type: keyword `ok`, alert when keyword **not** present.
2. **Alert Contact → Telegram**
   - UptimeRobot has a built-in Telegram integration: add the `@uptimerobot_bot`
     contact and link it to the alerts chat, **or** use a webhook to our bot:
     `https://api.telegram.org/bot<TG_BOT_TOKEN>/sendMessage?chat_id=<TG_CHAT_ID>&text=*alertDetails*`
     (token/chat id live in `~/.agent-factory/credentials.env`).
3. Attach the alert contact to the `TikiTaka` monitor for both Down and Up events.

## 3. Optional: tighten the internal healthcheck

`/opt/worldcup/healthcheck.sh` currently probes `/api/stats` (runs several DB
COUNT queries). Switching it to the lighter, rate-limit-free `/health` reduces
load and false negatives:

```bash
STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 http://localhost:3000/health)
```

(Requires editing the root-owned file in `/opt` — operator action.)
