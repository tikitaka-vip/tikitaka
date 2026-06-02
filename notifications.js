const webpush = require('web-push');
const https = require('https');

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
    pre_match_title: '⏰ עוד שעתיים!',
    pre_match_body: '{teamA} נגד {teamB} מתחיל עוד שעתיים. נעלו ניחוש!',
    result_title: '📊 התוצאה נכנסה!',
    result_body: '{teamA} {scoreA}-{scoreB} {teamB}. קיבלת {pts} נקודות!',
    tournament_lock_title: '🏆 ניחושי טורניר ננעלים!',
    tournament_lock_body: 'ניחושי אלוף, סגן ומלך שערים ננעלים עוד {hours} שעות!',
    welcome_tg: '🐒 ברוכים הבאים ל-TikiTaka!\nתקבלו התראות לפני משחקים כדי שלא תשכחו לנחש.\n\nהחשבון שלכם חובר בהצלחה ✅',
    enable_push: 'קבלו התראות כדי לא לשכוח לנחש ⚽',
    enable_push_btn: 'הפעילו התראות',
    connect_tg: 'חברו טלגרם לקבלת תזכורות',
    connect_tg_btn: '🔗 חברו טלגרם',
  },
  en: {
    unpredicted_title: '⚽ Unpredicted matches today!',
    unpredicted_body: "{count} matches today without predictions. First: {match} at {time}",
    pre_match_title: '⏰ 2 hours to kickoff!',
    pre_match_body: "{teamA} vs {teamB} starts in 2 hours. Lock in your prediction!",
    result_title: '📊 Result is in!',
    result_body: '{teamA} {scoreA}-{scoreB} {teamB}. You scored {pts} points!',
    tournament_lock_title: '🏆 Tournament predictions locking!',
    tournament_lock_body: 'Winner, runner-up & top scorer predictions lock in {hours} hours!',
    welcome_tg: "🐒 Welcome to TikiTaka!\nYou'll get reminders before matches so you never forget to predict.\n\nYour account is linked ✅",
    enable_push: "Get notified so you never forget to predict ⚽",
    enable_push_btn: 'Enable notifications',
    connect_tg: 'Connect Telegram for reminders',
    connect_tg_btn: '🔗 Connect Telegram',
  },
};

function ns(lang, key) {
  return NOTIFY_STRINGS[lang]?.[key] || NOTIFY_STRINGS.en[key];
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
    res.json({ ok: true });
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

    res.json({ url: `https://t.me/${botUsername}?start=${linkToken}` });
  });

  // Telegram webhook handler
  app.post('/api/telegram/webhook', (req, res) => {
    res.json({ ok: true }); // respond immediately

    const msg = req.body?.message;
    if (!msg?.text) return;

    const chatId = msg.chat.id;
    const text = msg.text.trim();

    // Handle /start with link token
    if (text.startsWith('/start ')) {
      const linkToken = text.slice(7).trim();
      const player = db.prepare('SELECT id, name, lang FROM players WHERE tg_link_token = ?').get(linkToken);
      if (!player) {
        sendTelegram(chatId, '❌ Invalid or expired link. Try generating a new one from tikitaka.vip');
        return;
      }
      db.prepare('UPDATE players SET telegram_chat_id = ?, tg_link_token = NULL WHERE id = ?').run(String(chatId), player.id);
      sendTelegram(chatId, ns(player.lang || 'he', 'welcome_tg'));
      return;
    }

    // Handle plain /start
    if (text === '/start') {
      sendTelegram(chatId, '🐒 TikiTaka World Cup 2026\n\nTo get reminders, link your account from tikitaka.vip → click "Connect Telegram"');
      return;
    }
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
    `).all(now.toISOString(), twoHoursFromNow.toISOString());

    for (const match of upcomingMatches) {
      const alreadyNotified = db.prepare(
        "SELECT 1 FROM notification_log WHERE match_id = ? AND type = 'pre_match'"
      ).get(match.id);
      if (alreadyNotified) continue;

      // Find players who haven't predicted this match
      const unpredicted = db.prepare(`
        SELECT p.id, p.lang, p.telegram_chat_id FROM players p
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
            .replace('{teamB}', match.team_b),
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
          'SELECT * FROM matches WHERE kickoff_utc >= ? AND kickoff_utc < ? ORDER BY kickoff_utc'
        ).all(todayStart.toISOString(), todayEnd.toISOString());

        if (todaysMatches.length > 0) {
          const players = db.prepare("SELECT id, lang, telegram_chat_id FROM players WHERE pin != 'monkey-no-login'").all();

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
        const players = db.prepare("SELECT id, lang, telegram_chat_id FROM players WHERE pin != 'monkey-no-login'").all();
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
    // Web push
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

    // Telegram
    if (player.telegram_chat_id) {
      const tgText = `<b>${payload.title}</b>\n${payload.body}\n\n<a href="https://tikitaka.vip${payload.data?.url || ''}">Open TikiTaka</a>`;
      await sendTelegram(player.telegram_chat_id, tgText);
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
    SELECT pred.*, p.id as pid, p.lang, p.telegram_chat_id
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

    await sendToPlayer(db, { id: pred.pid, telegram_chat_id: pred.telegram_chat_id }, payload);
  }

  async function sendToPlayer(db, player, payload) {
    const subs = db.prepare('SELECT * FROM push_subscriptions WHERE player_id = ?').all(player.id);
    for (const sub of subs) {
      const subscription = { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } };
      const res = await sendWebPush(subscription, payload);
      if (res === 'expired') db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(sub.endpoint);
    }
    if (player.telegram_chat_id) {
      const tgText = `<b>${payload.title}</b>\n${payload.body}\n\n<a href="https://tikitaka.vip${payload.data?.url || ''}">Open TikiTaka</a>`;
      await sendTelegram(player.telegram_chat_id, tgText);
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
