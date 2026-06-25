const webpush = require('web-push');
const https = require('https');
const { handleTelegramMessage, handleTelegramCallback } = require('./telegram-bot');
const { sendWhatsApp } = require('./whatsapp');

const VAPID_PUBLIC = 'BNYhhxgzt7qDXmsp0ytjm6_sqyR62wioYxGFTHn05CLgllIedJb5TzKsrNFpm2Fxxc4EOIwO3zKPvVKgiOeucpo';
const VAPID_PRIVATE = 'CvfuSu23-LwfnjptaJPxiYZszdjbweoeqGgcUfWt8SA';

webpush.setVapidDetails('mailto:monkey@tikitaka.vip', VAPID_PUBLIC, VAPID_PRIVATE);

// TG bot token — set after creating the bot
let TG_BOT_TOKEN = null;

function setTgBotToken(token) { TG_BOT_TOKEN = token; }

function httpPost(hostname, path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({ hostname, path, method: 'POST', headers: {
      'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data)
    }}, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data);
    req.end();
  });
}

async function sendWebPush(subscription, payload) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (e) {
    if (e.statusCode === 410 || e.statusCode === 404) return 'expired';
    console.error('Web push failed:', e.statusCode, e.message);
    return false;
  }
}

async function sendTelegram(chatId, text, opts = {}) {
  if (!TG_BOT_TOKEN) return false;
  try {
    const body = { chat_id: chatId, text, parse_mode: 'HTML', ...opts };
    const res = await httpPost('api.telegram.org', `/bot${TG_BOT_TOKEN}/sendMessage`, body);
    return res.status === 200;
  } catch (e) {
    console.error('TG send failed:', e.message);
    return false;
  }
}

const NOTIFY_STRINGS = {
  he: {
    unpredicted_title: '⚽ יש משחקים שלא ניחשת!',
    unpredicted_body: '{count} משחקים היום בלי ניחוש. הראשון: {match} ב-{time}',
    pre_match_title: '⏰ תזכורת ניחוש!',
    pre_match_body: '{teamA} נגד {teamB} מתחיל {when}. נעלו ניחוש!',
    result_title: '📊 התוצאה נכנסה!',
    result_body: '{teamA} {scoreA}-{scoreB} {teamB}. קיבלת {pts} נקודות!',
    tournament_lock_title: '🏆 ניחושי טורניר ננעלים!',
    tournament_lock_body: 'ניחושי אלוף, סגן ומלך שערים ננעלים עוד {hours} שעות!',
    welcome_tg: '🐒 ברוכים הבאים ל-TikiTaka!\nתקבלו התראות לפני משחקים כדי שלא תשכחו לנחש.\n\nהחשבון שלכם חובר בהצלחה ✅',
    invite_tg: '⚽🐒 הצטרפתי למשחק ניחושים למונדיאל 2026 — נגד קוף אמיתי!\n\nבואו לקבוצה שלי, מי שמפסיד לקוף מביא בירות 🍺\n\n👉 {link}\n\ntikitaka.vip',
    enable_push: 'קבלו התראות כדי לא לשכוח לנחש ⚽',
    enable_push_btn: 'הפעילו התראות',
    connect_tg: 'חברו טלגרם לקבלת תזכורות',
    connect_tg_btn: '🔗 חברו טלגרם',
  },
  en: {
    unpredicted_title: '⚽ Unpredicted matches today!',
    unpredicted_body: "{count} matches today without predictions. First: {match} at {time}",
    pre_match_title: '⏰ Prediction reminder!',
    pre_match_body: "{teamA} vs {teamB} starts {when}. Lock in your prediction!",
    result_title: '📊 Result is in!',
    result_body: '{teamA} {scoreA}-{scoreB} {teamB}. You scored {pts} points!',
    tournament_lock_title: '🏆 Tournament predictions locking!',
    tournament_lock_body: 'Winner, runner-up & top scorer predictions lock in {hours} hours!',
    welcome_tg: "🐒 Welcome to TikiTaka!\nYou'll get reminders before matches so you never forget to predict.\n\nYour account is linked ✅",
    invite_tg: "⚽🐒 I joined a World Cup 2026 prediction game — against a REAL monkey!\n\nJoin my group, whoever loses to the monkey buys beers 🍺\n\n👉 {link}\n\ntikitaka.vip",
    enable_push: "Get notified so you never forget to predict ⚽",
    enable_push_btn: 'Enable notifications',
    connect_tg: 'Connect Telegram for reminders',
    connect_tg_btn: '🔗 Connect Telegram',
  },
};

function ns(lang, key) {
  return NOTIFY_STRINGS[lang]?.[key] || NOTIFY_STRINGS.en[key];
}

// Human phrase for "time until kickoff" so the reminder reflects the REAL gap,
// not a hardcoded "2 hours" (which is wrong after a restart/late check).
function formatLeadTime(mins, lang) {
  const he = lang === 'he';
  if (mins >= 105) return he ? 'עוד שעתיים' : 'in 2 hours';
  if (mins >= 50) return he ? 'עוד כשעה' : 'in about an hour';
  if (mins >= 20) { const r = Math.round(mins / 5) * 5; return he ? `עוד כ-${r} דקות` : `in ~${r} min`; }
  if (mins >= 2) return he ? `עוד ${mins} דקות` : `in ${mins} min`;
  return he ? 'עכשיו' : 'now';
}

function getPlayerInviteCode(db, playerId) {
  const group = db.prepare('SELECT invite_code FROM groups WHERE manager_id = ? LIMIT 1').get(playerId);
  return group?.invite_code || null;
}

function setupNotificationRoutes(app, db) {
  // Save web push subscription
  app.post('/api/push/subscribe', (req, res) => {
    const { subscription, player_id } = req.body;
    if (!subscription?.endpoint || !player_id) return res.status(400).json({ error: 'Missing data' });

    db.prepare(`INSERT OR REPLACE INTO push_subscriptions (player_id, endpoint, keys_p256dh, keys_auth, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))`).run(
      player_id, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth
    );

    const inviteCode = getPlayerInviteCode(db, player_id);
    res.json({ ok: true, inviteCode: inviteCode || null });
  });

  // Remove push subscription
  app.post('/api/push/unsubscribe', (req, res) => {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });
    db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
    res.json({ ok: true });
  });

  // Get VAPID public key
  app.get('/api/push/vapid-key', (req, res) => {
    res.json({ publicKey: VAPID_PUBLIC });
  });

  // Telegram bot link — generate a one-time link token
  app.get('/api/telegram/link', (req, res) => {
    const token = req.headers['x-session-token'] || req.query.token;
    const player = db.prepare('SELECT id, name FROM players WHERE session_token = ?').get(token);
    if (!player) return res.status(401).json({ error: 'not logged in' });

    const linkToken = require('crypto').randomBytes(16).toString('hex');
    db.prepare('UPDATE players SET tg_link_token = ? WHERE id = ?').run(linkToken, player.id);

    const botUsername = db.prepare("SELECT value FROM settings WHERE key = 'tg_bot_username'").get()?.value;
    if (!botUsername) return res.status(500).json({ error: 'TG bot not configured' });

    const inviteCode = getPlayerInviteCode(db, player.id);
    res.json({ url: `https://t.me/${botUsername}?start=${linkToken}`, inviteCode });
  });

  // TG login — init (frontend requests a login token)
  app.post('/api/auth/tg-login-init', (req, res) => {
    const token = require('crypto').randomBytes(16).toString('hex');
    db.prepare("INSERT INTO tg_login_tokens (token, created_at) VALUES (?, datetime('now'))").run(token);
    // Clean up old tokens (> 10 min)
    db.prepare("DELETE FROM tg_login_tokens WHERE created_at < datetime('now', '-10 minutes')").run();

    const botUsername = db.prepare("SELECT value FROM settings WHERE key = 'tg_bot_username'").get()?.value;
    res.json({ token, url: `https://t.me/${botUsername}?start=login_${token}` });
  });

  // TG login — poll (frontend checks if bot has processed the login)
  app.get('/api/auth/tg-login-check', (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Missing token' });

    const row = db.prepare('SELECT session_token, player_id, player_name FROM tg_login_tokens WHERE token = ?').get(token);
    if (!row || !row.session_token) return res.json({ ready: false });

    // Login complete — return session and clean up
    const player = db.prepare('SELECT id, name, email, avatar_url FROM players WHERE id = ?').get(row.player_id);
    db.prepare('DELETE FROM tg_login_tokens WHERE token = ?').run(token);
    res.json({ ready: true, id: player.id, name: player.name, email: player.email, avatar_url: player.avatar_url, token: row.session_token });
  });

  // Telegram webhook handler
  app.post('/api/telegram/webhook', async (req, res) => {
    res.json({ ok: true });

    // Inline-keyboard button taps (the primary guessing UX)
    if (req.body?.callback_query) {
      await handleTelegramCallback(db, req.body.callback_query).catch(e => console.error('TG callback error:', e.message));
      return;
    }

    const msg = req.body?.message;
    if (!msg?.text) return;

    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const tgUser = msg.from;

    // Deep-link payload only when it's a /start command; plain text (guesses,
    // commands) has no payload and falls through to the shared bot engine below.
    const payload = text.startsWith('/start') ? text.slice(7).trim() : '';

    // TG Login: /start login_XXXXX
    if (payload.startsWith('login_')) {
      const loginToken = payload.slice(6);
      const row = db.prepare('SELECT token FROM tg_login_tokens WHERE token = ?').get(loginToken);
      if (!row) {
        await sendTelegram(chatId, '❌ Expired login link. Try again from tikitaka.vip');
        return;
      }

      const tgName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || tgUser.username || 'Player';
      const lang = tgUser.language_code && NOTIFY_STRINGS[tgUser.language_code] ? tgUser.language_code : 'he';

      // Find existing player by TG chat ID, or create new one
      let player = db.prepare('SELECT * FROM players WHERE telegram_chat_id = ?').get(String(chatId));
      const generateToken = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let t = ''; for (let i = 0; i < 48; i++) t += chars[Math.floor(Math.random() * chars.length)];
        return t;
      };
      const sessionToken = generateToken();

      if (player) {
        db.prepare('UPDATE players SET session_token = ?, lang = ? WHERE id = ?').run(sessionToken, lang, player.id);
      } else {
        const result = db.prepare(
          "INSERT INTO players (name, pin, session_token, lang, telegram_chat_id, email_verified) VALUES (?, 'tg-auth', ?, ?, ?, 0)"
        ).run(tgName, sessionToken, lang, String(chatId));
        player = { id: result.lastInsertRowid, name: tgName };

        // Create auto-group for new player
        const GROUP_SUFFIX = { he: 'והחברים', en: 'and friends', es: 'y amigos', fr: 'et amis', pt: 'e amigos', ar: 'والأصدقاء', ru: 'и друзья', de: 'und Freunde', ja: 'と仲間' };
        const suffix = GROUP_SUFFIX[lang] || GROUP_SUFFIX.en;
        const invCode = (() => { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)]; return s; })();
        const DEFAULT_SCORING = db.prepare("SELECT scoring_config FROM groups LIMIT 1").get()?.scoring_config || '{}';
        const gr = db.prepare('INSERT INTO groups (name, invite_code, manager_id, scoring_config) VALUES (?, ?, ?, ?)').run(`${tgName} ${suffix}`, invCode, player.id, DEFAULT_SCORING);
        db.prepare('INSERT INTO group_members (group_id, player_id) VALUES (?, ?)').run(gr.lastInsertRowid, player.id);
      }

      // Complete the login token
      db.prepare('UPDATE tg_login_tokens SET session_token = ?, player_id = ?, player_name = ? WHERE token = ?')
        .run(sessionToken, player.id, player.name, loginToken);

      await sendTelegram(chatId, ns(lang, 'welcome_tg'));

      const inviteCode = getPlayerInviteCode(db, player.id);
      if (inviteCode) {
        const inviteLink = `https://tikitaka.vip/join/${inviteCode}`;
        await sendTelegram(chatId, ns(lang, 'invite_tg').replace('{link}', inviteLink));
      }
      return;
    }

    // Existing account linking: /start XXXXX (non-login tokens)
    if (payload && !payload.startsWith('login_')) {
      const player = db.prepare('SELECT id, name, lang FROM players WHERE tg_link_token = ?').get(payload);
      if (!player) {
        await sendTelegram(chatId, '❌ Invalid or expired link. Try generating a new one from tikitaka.vip');
        return;
      }
      db.prepare('UPDATE players SET telegram_chat_id = ?, tg_link_token = NULL WHERE id = ?').run(String(chatId), player.id);
      const lang = player.lang || 'he';
      await sendTelegram(chatId, ns(lang, 'welcome_tg'));

      const inviteCode = getPlayerInviteCode(db, player.id);
      if (inviteCode) {
        const inviteLink = `https://tikitaka.vip/join/${inviteCode}`;
        await sendTelegram(chatId, ns(lang, 'invite_tg').replace('{link}', inviteLink));
      }
      return;
    }

    // No token: sign-up + in-chat guessing via the rich Telegram UI (inline keyboards).
    await handleTelegramMessage(db, { chatId, tgUser, text })
      .catch(e => console.error('TG message error:', e.message));
  });
}

function startNotificationScheduler(db) {
  const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

  async function checkAndNotify() {
    const now = new Date();

    // 1. Pre-match reminders (2h before kickoff)
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 5 * 60 * 1000); // don't re-notify
    const upcomingMatches = db.prepare(`
      SELECT * FROM matches
      WHERE kickoff_utc > ? AND kickoff_utc <= ?
        AND team_a != 'TBD' AND team_b != 'TBD'
    `).all(now.toISOString(), twoHoursFromNow.toISOString());

    for (const match of upcomingMatches) {
      const alreadyNotified = db.prepare(
        "SELECT 1 FROM notification_log WHERE match_id = ? AND type = 'pre_match'"
      ).get(match.id);
      if (alreadyNotified) continue;

      const minsToKickoff = Math.round((new Date(match.kickoff_utc) - now) / 60000);

      // Find players who haven't predicted this match
      const unpredicted = db.prepare(`
        SELECT p.id, p.lang, p.telegram_chat_id, p.whatsapp_id FROM players p
        WHERE p.id NOT IN (
          SELECT player_id FROM predictions WHERE match_id = ?
        ) AND p.pin != 'monkey-no-login'
      `).all(match.id);

      for (const player of unpredicted) {
        const lang = player.lang || 'he';
        const payload = {
          title: ns(lang, 'pre_match_title'),
          body: ns(lang, 'pre_match_body')
            .replace('{teamA}', match.team_a)
            .replace('{teamB}', match.team_b)
            .replace('{when}', formatLeadTime(minsToKickoff, lang)),
          icon: '/icon-192.png',
          data: { url: '/?tab=predict' }
        };

        await sendToPlayer(db, player, payload);
      }

      db.prepare("INSERT INTO notification_log (match_id, type, sent_at) VALUES (?, 'pre_match', datetime('now'))").run(match.id);
    }

    // 2. Morning digest — matches today without predictions (run between 8:00-8:05 Israel time = UTC+3)
    const israelHour = new Date(now.getTime() + 3 * 60 * 60 * 1000).getUTCHours();
    const israelMinute = new Date(now.getTime() + 3 * 60 * 60 * 1000).getUTCMinutes();
    if (israelHour === 8 && israelMinute < 5) {
      const todayStart = new Date(now);
      todayStart.setUTCHours(0, 0, 0, 0);
      const todayEnd = new Date(todayStart);
      todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

      const todayStr = todayStart.toISOString().slice(0, 10);
      const alreadyDigest = db.prepare(
        "SELECT 1 FROM notification_log WHERE type = 'morning_digest' AND date(sent_at) = ?"
      ).get(todayStr);
      if (!alreadyDigest) {
        const todaysMatches = db.prepare(
          "SELECT * FROM matches WHERE kickoff_utc >= ? AND kickoff_utc < ? AND team_a != 'TBD' AND team_b != 'TBD' ORDER BY kickoff_utc"
        ).all(todayStart.toISOString(), todayEnd.toISOString())
          // Only matches that haven't kicked off yet — the 08:00 digest runs at 05:00 UTC,
          // so without this it nags about early matches that already started (predictions
          // locked), which is exactly the "reminder arrived too late" complaint.
          .filter(m => new Date(m.kickoff_utc) > now);

        if (todaysMatches.length > 0) {
          const players = db.prepare("SELECT id, lang, telegram_chat_id, whatsapp_id FROM players WHERE pin != 'monkey-no-login'").all();

          for (const player of players) {
            const unpredictedToday = todaysMatches.filter(m =>
              !db.prepare('SELECT 1 FROM predictions WHERE match_id = ? AND player_id = ?').get(m.id, player.id)
            );
            if (unpredictedToday.length === 0) continue;

            const lang = player.lang || 'he';
            const first = unpredictedToday[0];
            const time = first.match_time || new Date(first.kickoff_utc).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
            const payload = {
              title: ns(lang, 'unpredicted_title'),
              body: ns(lang, 'unpredicted_body')
                .replace('{count}', unpredictedToday.length)
                .replace('{match}', `${first.team_a} vs ${first.team_b}`)
                .replace('{time}', time),
              icon: '/icon-192.png',
              data: { url: '/?tab=predict' }
            };

            await sendToPlayer(db, player, payload);
          }

          db.prepare("INSERT INTO notification_log (type, sent_at) VALUES ('morning_digest', datetime('now'))").run();
        }
      }
    }

    // 3. Tournament predictions deadline (24h and 1h before June 11)
    const tournamentStart = new Date('2026-06-11T19:00:00Z');
    const hoursUntil = (tournamentStart - now) / (1000 * 60 * 60);
    if ((hoursUntil > 23.9 && hoursUntil < 24.1) || (hoursUntil > 0.9 && hoursUntil < 1.1)) {
      const roundedHours = Math.round(hoursUntil);
      const logKey = `tournament_lock_${roundedHours}h`;
      const alreadySent = db.prepare(
        "SELECT 1 FROM notification_log WHERE type = ?"
      ).get(logKey);

      if (!alreadySent) {
        const players = db.prepare("SELECT id, lang, telegram_chat_id, whatsapp_id FROM players WHERE pin != 'monkey-no-login'").all();
        for (const player of players) {
          const lang = player.lang || 'he';
          const payload = {
            title: ns(lang, 'tournament_lock_title'),
            body: ns(lang, 'tournament_lock_body').replace('{hours}', roundedHours),
            icon: '/icon-192.png',
            data: { url: '/?tab=predict' }
          };
          await sendToPlayer(db, player, payload);
        }
        db.prepare("INSERT INTO notification_log (type, sent_at) VALUES (?, datetime('now'))").run(logKey);
      }
    }
  }

  async function sendToPlayer(db, player, payload) {
    // Channel routing: if the player connected a chat channel (Telegram/WhatsApp),
    // send reminders THERE only — do not also web-push (avoids double notifying).
    // Web push is the fallback for accounts with no connected chat channel.
    let sentToChat = false;

    if (player.telegram_chat_id) {
      const tgText = `<b>${payload.title}</b>\n${payload.body}\n\n<a href="https://tikitaka.vip${payload.data?.url || ''}">Open TikiTaka</a>`;
      await sendTelegram(player.telegram_chat_id, tgText);
      sentToChat = true;
    }

    if (player.whatsapp_id) {
      // NOTE: proactive WhatsApp outside the 24h window needs an approved template;
      // plain text only delivers within the window. Template send to be added with WA launch.
      const waText = `*${payload.title}*\n${payload.body}\n\nhttps://tikitaka.vip${payload.data?.url || ''}`;
      try { await sendWhatsApp(player.whatsapp_id, waText); } catch (e) { console.error('WA notify failed:', e.message); }
      sentToChat = true;
    }

    if (sentToChat) return; // chat channel connected -> skip web push

    // Web push fallback (accounts with no connected chat channel)
    const subs = db.prepare('SELECT * FROM push_subscriptions WHERE player_id = ?').all(player.id);
    for (const sub of subs) {
      const subscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth }
      };
      const result = await sendWebPush(subscription, payload);
      if (result === 'expired') {
        db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(sub.endpoint);
      }
    }
  }

  // Run every 5 minutes
  setInterval(() => checkAndNotify().catch(e => console.error('Notification check error:', e.message)), CHECK_INTERVAL);
  // Run once after 30s startup delay
  setTimeout(() => checkAndNotify().catch(e => console.error('Initial notification check error:', e.message)), 30000);
  console.log('Notification scheduler started (5-min interval)');
}

// Notify on result entry (called from server when admin enters a result)
async function notifyResult(db, matchId) {
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
  const result = db.prepare('SELECT * FROM match_results WHERE match_id = ?').get(matchId);
  if (!match || !result) return;

  const predictions = db.prepare(`
    SELECT pred.*, p.id as pid, p.lang, p.telegram_chat_id, p.whatsapp_id
    FROM predictions pred
    JOIN players p ON p.id = pred.player_id
    WHERE pred.match_id = ? AND p.pin != 'monkey-no-login'
  `).all(matchId);

  for (const pred of predictions) {
    let pts = 0;
    if (pred.score_a === result.score_a && pred.score_b === result.score_b) pts = 5;
    else if ((pred.score_a - pred.score_b) === (result.score_a - result.score_b)) pts = 3;
    else if (Math.sign(pred.score_a - pred.score_b) === Math.sign(result.score_a - result.score_b)) pts = 2;

    const lang = pred.lang || 'he';
    const payload = {
      title: ns(lang, 'result_title'),
      body: ns(lang, 'result_body')
        .replace('{teamA}', match.team_a)
        .replace('{teamB}', match.team_b)
        .replace('{scoreA}', result.score_a)
        .replace('{scoreB}', result.score_b)
        .replace('{pts}', pts),
      icon: '/icon-192.png',
      data: { url: '/?tab=scoring' }
    };

    await sendToPlayer(db, { id: pred.pid, telegram_chat_id: pred.telegram_chat_id, whatsapp_id: pred.whatsapp_id }, payload);
  }

  // Same channel routing as the scheduler: chat channels take priority; web push is the fallback.
  async function sendToPlayer(db, player, payload) {
    let sentToChat = false;
    if (player.telegram_chat_id) {
      const tgText = `<b>${payload.title}</b>\n${payload.body}\n\n<a href="https://tikitaka.vip${payload.data?.url || ''}">Open TikiTaka</a>`;
      await sendTelegram(player.telegram_chat_id, tgText);
      sentToChat = true;
    }
    if (player.whatsapp_id) {
      const waText = `*${payload.title}*\n${payload.body}\n\nhttps://tikitaka.vip${payload.data?.url || ''}`;
      try { await sendWhatsApp(player.whatsapp_id, waText); } catch (e) { console.error('WA notify failed:', e.message); }
      sentToChat = true;
    }
    if (sentToChat) return;
    const subs = db.prepare('SELECT * FROM push_subscriptions WHERE player_id = ?').all(player.id);
    for (const sub of subs) {
      const subscription = { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } };
      const res = await sendWebPush(subscription, payload);
      if (res === 'expired') db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(sub.endpoint);
    }
  }
}

module.exports = {
  VAPID_PUBLIC,
  setupNotificationRoutes,
  startNotificationScheduler,
  notifyResult,
  setTgBotToken
};
