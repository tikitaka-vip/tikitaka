const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

const { sendWelcomeEmail, sendResetEmail, sendVerifyEmail, hashPassword, verifyPassword } = require('./email');
const { setupNotificationRoutes, startNotificationScheduler, notifyResult, setTgBotToken } = require('./notifications');
const app = express();
const db = new Database(path.join(__dirname, 'worldcup.db'));

// Error logging
const logFile = path.join(__dirname, 'error.log');
function logError(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(logFile, line);
  console.error(line.trim());
}
process.on('uncaughtException', e => { logError(`UNCAUGHT: ${e.stack}`); });
process.on('unhandledRejection', e => { logError(`UNHANDLED: ${e}`); });

// Rate limiting (in-memory, per IP)
const rateMap = new Map();
function rateLimit(windowMs, max) {
  return (req, res, next) => {
    const ip = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.ip;
    const key = `${ip}:${req.path}`;
    const now = Date.now();
    const entry = rateMap.get(key) || { count: 0, reset: now + windowMs };
    if (now > entry.reset) { entry.count = 0; entry.reset = now + windowMs; }
    entry.count++;
    rateMap.set(key, entry);
    if (entry.count > max) return res.status(429).json({ error: 'יותר מדי בקשות, נסו שוב בעוד דקה' });
    next();
  };
}
setInterval(() => { const now = Date.now(); for (const [k, v] of rateMap) { if (now > v.reset) rateMap.delete(k); } }, 60000);

app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Rate limits: auth=10/min, predictions=60/min, reads=120/min
app.use('/api/auth', rateLimit(60000, 10));
app.use('/api/login', rateLimit(60000, 10));
app.use('/api/players', rateLimit(60000, 10));
app.use('/api/predictions', rateLimit(60000, 60));
app.use('/api', rateLimit(60000, 120));
app.use('/socials', express.static(path.join(__dirname, 'socials'), {
  maxAge: '1h'
}));
app.use('/brand', express.static(path.join(__dirname, 'brand'), {
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
    }
  }
}));
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('sw.js') || filePath.endsWith('.js') || filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
    } else if (filePath.endsWith('.png') || filePath.endsWith('.json')) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }
}));

db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event TEXT NOT NULL,
    data TEXT DEFAULT '{}',
    ip TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    google_id TEXT UNIQUE,
    avatar_url TEXT DEFAULT '',
    pin TEXT NOT NULL DEFAULT '',
    session_token TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stage TEXT NOT NULL,
    group_name TEXT,
    team_a TEXT NOT NULL,
    team_b TEXT NOT NULL,
    match_date TEXT,
    match_time TEXT,
    venue TEXT,
    kickoff_utc TEXT,
    match_order INTEGER
  );

  CREATE TABLE IF NOT EXISTS match_results (
    match_id INTEGER PRIMARY KEY REFERENCES matches(id),
    score_a INTEGER NOT NULL,
    score_b INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS match_odds (
    match_id INTEGER PRIMARY KEY REFERENCES matches(id),
    odds_a REAL NOT NULL DEFAULT 2.0,
    odds_draw REAL NOT NULL DEFAULT 3.0,
    odds_b REAL NOT NULL DEFAULT 2.0,
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL REFERENCES players(id),
    match_id INTEGER NOT NULL REFERENCES matches(id),
    score_a INTEGER NOT NULL,
    score_b INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(player_id, match_id)
  );

  CREATE TABLE IF NOT EXISTS tournament_predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL REFERENCES players(id),
    prediction_type TEXT NOT NULL,
    value TEXT NOT NULL,
    UNIQUE(player_id, prediction_type)
  );

  CREATE TABLE IF NOT EXISTS actual_results (
    prediction_type TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS outright_odds (
    team_name TEXT PRIMARY KEY,
    odds_winner REAL NOT NULL DEFAULT 50.0,
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    invite_code TEXT UNIQUE NOT NULL,
    manager_id INTEGER NOT NULL REFERENCES players(id),
    scoring_config TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS group_members (
    group_id INTEGER NOT NULL REFERENCES groups(id),
    player_id INTEGER NOT NULL REFERENCES players(id),
    PRIMARY KEY (group_id, player_id)
  );
`);

// Migrate: add auth + notification columns
const cols = new Set(db.prepare("PRAGMA table_info(players)").all().map(c => c.name));
const migrations = [
  ['lang', "ALTER TABLE players ADD COLUMN lang TEXT DEFAULT 'he'"],
  ['password_hash', "ALTER TABLE players ADD COLUMN password_hash TEXT"],
  ['email_verified', "ALTER TABLE players ADD COLUMN email_verified INTEGER DEFAULT 0"],
  ['verify_token', "ALTER TABLE players ADD COLUMN verify_token TEXT"],
  ['reset_token', "ALTER TABLE players ADD COLUMN reset_token TEXT"],
  ['reset_expires', "ALTER TABLE players ADD COLUMN reset_expires TEXT"],
  ['telegram_chat_id', "ALTER TABLE players ADD COLUMN telegram_chat_id TEXT"],
  ['tg_link_token', "ALTER TABLE players ADD COLUMN tg_link_token TEXT"],
];
for (const [col, sql] of migrations) {
  if (!cols.has(col)) db.exec(sql);
}

// Create notification tables
db.exec(`
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    player_id INTEGER NOT NULL REFERENCES players(id),
    endpoint TEXT NOT NULL UNIQUE,
    keys_p256dh TEXT NOT NULL,
    keys_auth TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS notification_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER,
    type TEXT NOT NULL,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS tg_login_tokens (
    token TEXT PRIMARY KEY,
    session_token TEXT,
    player_id INTEGER,
    player_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// --- Seed matches ---
const count = db.prepare('SELECT COUNT(*) as c FROM matches').get().c;
if (count === 0) {
  const insert = db.prepare('INSERT INTO matches (stage, group_name, team_a, team_b, match_date, match_time, venue, kickoff_utc, match_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');

  // kickoff_utc = ISO string in UTC. Times shown are Israel time (UTC+3).
  // Format: [date_il, time_il, group, teamA, teamB, venue, kickoff_utc]
  const groupMatches = [
    // MD1
    ['11/06','22:00','A','מקסיקו','דרום אפריקה','אצטדיון אצטקה, מקסיקו סיטי','2026-06-11T19:00:00Z'],
    ['12/06','05:00','A','דרום קוריאה','צ\'כיה','אצטדיון אקרון, גוודלחרה','2026-06-12T02:00:00Z'],
    ['12/06','22:00','B','קנדה','בוסניה והרצגובינה','BMO פילד, טורונטו','2026-06-12T19:00:00Z'],
    ['13/06','04:00','D','ארצות הברית','פרגוואי','סופי סטדיום, לוס אנג\'לס','2026-06-13T01:00:00Z'],
    ['13/06','07:00','D','אוסטרליה','טורקיה','BC פלייס, ונקובר','2026-06-13T04:00:00Z'],
    ['13/06','22:00','B','קטאר','שוויץ','ליוויס סטדיום, סנטה קלרה','2026-06-13T19:00:00Z'],
    ['14/06','01:00','C','ברזיל','מרוקו','מטלייף סטדיום, ניו ג\'רזי','2026-06-13T22:00:00Z'],
    ['14/06','04:00','C','האיטי','סקוטלנד','ג\'ילט סטדיום, בוסטון','2026-06-14T01:00:00Z'],
    ['14/06','20:00','E','גרמניה','קוראסאו','NRG סטדיום, יוסטון','2026-06-14T17:00:00Z'],
    ['14/06','23:00','F','הולנד','יפן','AT&T סטדיום, דאלאס','2026-06-14T20:00:00Z'],
    ['15/06','02:00','E','חוף השנהב','אקוודור','לינקולן פילד, פילדלפיה','2026-06-14T23:00:00Z'],
    ['15/06','05:00','F','שוודיה','תוניסיה','BBVA סטדיום, מונטריי','2026-06-15T02:00:00Z'],
    ['15/06','19:00','H','ספרד','כף ורדה','מרצדס-בנץ סטדיום, אטלנטה','2026-06-15T16:00:00Z'],
    ['15/06','22:00','G','בלגיה','מצרים','לומן פילד, סיאטל','2026-06-15T19:00:00Z'],
    ['16/06','01:00','H','ערב הסעודית','אורוגוואי','הארד רוק סטדיום, מיאמי','2026-06-15T22:00:00Z'],
    ['16/06','04:00','G','איראן','ניו זילנד','סופי סטדיום, לוס אנג\'לס','2026-06-16T01:00:00Z'],
    ['16/06','07:00','J','אוסטריה','ירדן','ליוויס סטדיום, סנטה קלרה','2026-06-16T04:00:00Z'],
    ['16/06','22:00','I','צרפת','סנגל','מטלייף סטדיום, ניו ג\'רזי','2026-06-16T19:00:00Z'],
    ['17/06','01:00','I','עיראק','נורבגיה','ג\'ילט סטדיום, בוסטון','2026-06-16T22:00:00Z'],
    ['17/06','04:00','J','ארגנטינה','אלג\'יריה','אָרוֹהד סטדיום, קנזס סיטי','2026-06-17T01:00:00Z'],
    ['17/06','20:00','K','פורטוגל','קונגו','NRG סטדיום, יוסטון','2026-06-17T17:00:00Z'],
    ['17/06','23:00','L','אנגליה','קרואטיה','AT&T סטדיום, דאלאס','2026-06-17T20:00:00Z'],
    ['18/06','02:00','L','גאנה','פנמה','BMO פילד, טורונטו','2026-06-17T23:00:00Z'],
    ['18/06','05:00','K','אוזבקיסטן','קולומביה','אצטדיון אצטקה, מקסיקו סיטי','2026-06-18T02:00:00Z'],
    // MD2
    ['18/06','19:00','A','צ\'כיה','דרום אפריקה','מרצדס-בנץ סטדיום, אטלנטה','2026-06-18T16:00:00Z'],
    ['18/06','22:00','B','שוויץ','בוסניה והרצגובינה','סופי סטדיום, לוס אנג\'לס','2026-06-18T19:00:00Z'],
    ['19/06','01:00','B','קנדה','קטאר','BC פלייס, ונקובר','2026-06-18T22:00:00Z'],
    ['19/06','04:00','A','מקסיקו','דרום קוריאה','אצטדיון אקרון, גוודלחרה','2026-06-19T01:00:00Z'],
    ['19/06','22:00','D','ארצות הברית','אוסטרליה','לומן פילד, סיאטל','2026-06-19T19:00:00Z'],
    ['20/06','01:00','C','סקוטלנד','מרוקו','ג\'ילט סטדיום, בוסטון','2026-06-19T22:00:00Z'],
    ['20/06','03:30','C','ברזיל','האיטי','לינקולן פילד, פילדלפיה','2026-06-20T00:30:00Z'],
    ['20/06','06:00','D','טורקיה','פרגוואי','ליוויס סטדיום, סנטה קלרה','2026-06-20T03:00:00Z'],
    ['20/06','07:00','F','תוניסיה','יפן','BBVA סטדיום, מונטריי','2026-06-20T04:00:00Z'],
    ['20/06','20:00','F','הולנד','שוודיה','NRG סטדיום, יוסטון','2026-06-20T17:00:00Z'],
    ['20/06','23:00','E','גרמניה','חוף השנהב','BMO פילד, טורונטו','2026-06-20T20:00:00Z'],
    ['21/06','03:00','E','אקוודור','קוראסאו','אָרוֹהד סטדיום, קנזס סיטי','2026-06-21T00:00:00Z'],
    ['21/06','19:00','H','ספרד','ערב הסעודית','מרצדס-בנץ סטדיום, אטלנטה','2026-06-21T16:00:00Z'],
    ['21/06','22:00','G','בלגיה','איראן','סופי סטדיום, לוס אנג\'לס','2026-06-21T19:00:00Z'],
    ['22/06','01:00','H','אורוגוואי','כף ורדה','הארד רוק סטדיום, מיאמי','2026-06-21T22:00:00Z'],
    ['22/06','04:00','G','ניו זילנד','מצרים','BC פלייס, ונקובר','2026-06-22T01:00:00Z'],
    ['22/06','20:00','J','ארגנטינה','אוסטריה','AT&T סטדיום, דאלאס','2026-06-22T17:00:00Z'],
    ['23/06','00:00','I','צרפת','עיראק','לינקולן פילד, פילדלפיה','2026-06-22T21:00:00Z'],
    ['23/06','03:00','I','נורבגיה','סנגל','מטלייף סטדיום, ניו ג\'רזי','2026-06-23T00:00:00Z'],
    ['23/06','06:00','J','ירדן','אלג\'יריה','ליוויס סטדיום, סנטה קלרה','2026-06-23T03:00:00Z'],
    ['23/06','20:00','K','פורטוגל','אוזבקיסטן','NRG סטדיום, יוסטון','2026-06-23T17:00:00Z'],
    ['23/06','23:00','L','אנגליה','גאנה','ג\'ילט סטדיום, בוסטון','2026-06-23T20:00:00Z'],
    ['24/06','02:00','L','פנמה','קרואטיה','BMO פילד, טורונטו','2026-06-23T23:00:00Z'],
    ['24/06','05:00','K','קולומביה','קונגו','אצטדיון אקרון, גוודלחרה','2026-06-24T02:00:00Z'],
    // MD3
    ['24/06','22:00','B','שוויץ','קנדה','BC פלייס, ונקובר','2026-06-24T19:00:00Z'],
    ['24/06','22:00','B','בוסניה והרצגובינה','קטאר','לומן פילד, סיאטל','2026-06-24T19:00:00Z'],
    ['25/06','01:00','C','סקוטלנד','ברזיל','הארד רוק סטדיום, מיאמי','2026-06-24T22:00:00Z'],
    ['25/06','01:00','C','מרוקו','האיטי','מרצדס-בנץ סטדיום, אטלנטה','2026-06-24T22:00:00Z'],
    ['25/06','04:00','A','צ\'כיה','מקסיקו','אצטדיון אצטקה, מקסיקו סיטי','2026-06-25T01:00:00Z'],
    ['25/06','04:00','A','דרום אפריקה','דרום קוריאה','BBVA סטדיום, מונטריי','2026-06-25T01:00:00Z'],
    ['25/06','23:00','E','קוראסאו','חוף השנהב','לינקולן פילד, פילדלפיה','2026-06-25T20:00:00Z'],
    ['25/06','23:00','E','אקוודור','גרמניה','מטלייף סטדיום, ניו ג\'רזי','2026-06-25T20:00:00Z'],
    ['26/06','02:00','F','יפן','שוודיה','AT&T סטדיום, דאלאס','2026-06-25T23:00:00Z'],
    ['26/06','02:00','F','תוניסיה','הולנד','אָרוֹהד סטדיום, קנזס סיטי','2026-06-25T23:00:00Z'],
    ['26/06','05:00','D','טורקיה','ארצות הברית','סופי סטדיום, לוס אנג\'לס','2026-06-26T02:00:00Z'],
    ['26/06','05:00','D','פרגוואי','אוסטרליה','ליוויס סטדיום, סנטה קלרה','2026-06-26T02:00:00Z'],
    ['26/06','22:00','I','נורבגיה','צרפת','ג\'ילט סטדיום, בוסטון','2026-06-26T19:00:00Z'],
    ['26/06','22:00','I','סנגל','עיראק','BMO פילד, טורונטו','2026-06-26T19:00:00Z'],
    ['27/06','03:00','H','כף ורדה','ערב הסעודית','NRG סטדיום, יוסטון','2026-06-27T00:00:00Z'],
    ['27/06','03:00','H','אורוגוואי','ספרד','אצטדיון אקרון, גוודלחרה','2026-06-27T00:00:00Z'],
    ['27/06','06:00','G','מצרים','איראן','לומן פילד, סיאטל','2026-06-27T03:00:00Z'],
    ['27/06','06:00','G','ניו זילנד','בלגיה','BC פלייס, ונקובר','2026-06-27T03:00:00Z'],
    ['28/06','00:00','L','פנמה','אנגליה','מטלייף סטדיום, ניו ג\'רזי','2026-06-27T21:00:00Z'],
    ['28/06','00:00','L','קרואטיה','גאנה','לינקולן פילד, פילדלפיה','2026-06-27T21:00:00Z'],
    ['28/06','02:30','K','קולומביה','פורטוגל','הארד רוק סטדיום, מיאמי','2026-06-27T23:30:00Z'],
    ['28/06','02:30','K','קונגו','אוזבקיסטן','מרצדס-בנץ סטדיום, אטלנטה','2026-06-27T23:30:00Z'],
    ['28/06','05:00','J','ירדן','ארגנטינה','AT&T סטדיום, דאלאס','2026-06-28T02:00:00Z'],
    ['28/06','05:00','J','אלג\'יריה','אוסטריה','אָרוֹהד סטדיום, קנזס סיטי','2026-06-28T02:00:00Z'],
  ];

  let order = 0;
  for (const [date, time, group, teamA, teamB, venue, utc] of groupMatches) {
    insert.run('בתים', group, teamA, teamB, date, time, venue, utc, ++order);
  }

  const knockoutRounds = [
    { stage: 'שמינית גמר', count: 16, startDate: '29/06', utcBase: '2026-06-29T' },
    { stage: 'שמונה אחרונות', count: 8, startDate: '04/07', utcBase: '2026-07-04T' },
    { stage: 'רבע גמר', count: 4, startDate: '09/07', utcBase: '2026-07-09T' },
    { stage: 'חצי גמר', count: 2, startDate: '14/07', utcBase: '2026-07-14T' },
    { stage: 'משחק על מקום 3', count: 1, startDate: '18/07', utcBase: '2026-07-18T' },
    { stage: 'גמר', count: 1, startDate: '19/07', utcBase: '2026-07-19T' },
  ];

  for (const round of knockoutRounds) {
    for (let i = 1; i <= round.count; i++) {
      const utc = `${round.utcBase}${String(16 + (i % 4) * 3).padStart(2,'0')}:00:00Z`;
      insert.run(round.stage, null, `TBD`, `TBD`, round.startDate, '', '', utc, ++order);
    }
  }

  // Seed default odds (will be overridden by API fetch)
  const defaultOdds = db.prepare('INSERT OR IGNORE INTO match_odds (match_id, odds_a, odds_draw, odds_b) VALUES (?, ?, ?, ?)');
  const allMatches = db.prepare('SELECT * FROM matches WHERE stage = ?').all('בתים');

  // Rough seed odds based on FIFA rankings — favorites get lower odds
  const teamStrength = {
    'ברזיל':1.4,'ארגנטינה':1.4,'צרפת':1.45,'אנגליה':1.5,'ספרד':1.5,
    'גרמניה':1.55,'הולנד':1.6,'פורטוגל':1.55,'בלגיה':1.7,'קרואטיה':1.8,
    'אורוגוואי':1.8,'קולומביה':1.85,'ארצות הברית':1.9,'מקסיקו':2.0,
    'יפן':2.0,'דרום קוריאה':2.2,'מרוקו':1.7,'סנגל':2.2,'טורקיה':2.1,
    'שוויץ':2.0,'אקוודור':2.3,'חוף השנהב':2.2,'מצרים':2.5,
    'קנדה':2.3,'אוסטרליה':2.5,'נורבגיה':2.3,'שוודיה':2.2,
    'אוסטריה':2.2,'איראן':2.8,'ערב הסעודית':2.8,'קטאר':3.0,
    'צ\'כיה':2.3,'בוסניה והרצגובינה':2.5,'אלג\'יריה':2.6,
    'ירדן':3.2,'עיראק':3.0,'פרגוואי':2.6,'גאנה':2.8,
    'פנמה':3.5,'דרום אפריקה':2.8,'סקוטלנד':2.5,
    'תוניסיה':2.8,'כף ורדה':4.5,'האיטי':6.0,'קוראסאו':7.0,
    'ניו זילנד':4.0,'קונגו':3.5,'אוזבקיסטן':3.2,
  };

  for (const m of allMatches) {
    const sa = teamStrength[m.team_a] || 2.5;
    const sb = teamStrength[m.team_b] || 2.5;
    const ratio = sb / sa;
    let oa, od, ob;
    if (ratio > 1.3) { oa = 1.5 + Math.random()*0.4; od = 3.2 + Math.random()*0.5; ob = 3.5 + Math.random()*2; }
    else if (ratio > 0.77) { oa = 2.2 + Math.random()*0.6; od = 3.0 + Math.random()*0.4; ob = 2.2 + Math.random()*0.6; }
    else { oa = 3.5 + Math.random()*2; od = 3.2 + Math.random()*0.5; ob = 1.5 + Math.random()*0.4; }
    defaultOdds.run(m.id, +oa.toFixed(2), +od.toFixed(2), +ob.toFixed(2));
  }
}

// --- Helpers ---

function isLocked(match) {
  if (!match.kickoff_utc) return false;
  return new Date(match.kickoff_utc) <= new Date();
}

const NAME_MAP = {
  'מקסיקו':'Mexico','דרום אפריקה':'South Africa','דרום קוריאה':'South Korea',
  'צ\'כיה':'Czechia','קנדה':'Canada','בוסניה והרצגובינה':'Bosnia and Herzegovina',
  'קטאר':'Qatar','שוויץ':'Switzerland','ברזיל':'Brazil','מרוקו':'Morocco',
  'האיטי':'Haiti','סקוטלנד':'Scotland','ארצות הברית':'United States',
  'פרגוואי':'Paraguay','אוסטרליה':'Australia','טורקיה':'Turkey',
  'גרמניה':'Germany','קוראסאו':'Curacao','חוף השנהב':'Ivory Coast',
  'אקוודור':'Ecuador','הולנד':'Netherlands','יפן':'Japan','שוודיה':'Sweden',
  'תוניסיה':'Tunisia','בלגיה':'Belgium','מצרים':'Egypt','איראן':'Iran',
  'ניו זילנד':'New Zealand','ספרד':'Spain','כף ורדה':'Cape Verde',
  'ערב הסעודית':'Saudi Arabia','אורוגוואי':'Uruguay','צרפת':'France',
  'סנגל':'Senegal','עיראק':'Iraq','נורבגיה':'Norway','ארגנטינה':'Argentina',
  'אלג\'יריה':'Algeria','אוסטריה':'Austria','ירדן':'Jordan',
  'פורטוגל':'Portugal','קונגו':'DR Congo','אוזבקיסטן':'Uzbekistan',
  'קולומביה':'Colombia','אנגליה':'England','קרואטיה':'Croatia',
  'גאנה':'Ghana','פנמה':'Panama',
};
const REVERSE_NAME_MAP = {};
Object.entries(NAME_MAP).forEach(([he, en]) => REVERSE_NAME_MAP[en.toLowerCase()] = he);

// Also match alternate names the API might use
const NAME_ALIASES = {
  'czech republic': 'czechia', 'republic of ireland': 'ireland',
  'south korea': 'south korea', 'korea republic': 'south korea',
  'ivory coast': 'ivory coast', "cote d'ivoire": 'ivory coast',
  'cape verde islands': 'cape verde', 'cabo verde': 'cape verde',
  'congo dr': 'dr congo', 'democratic republic of congo': 'dr congo',
  'dem. rep. congo': 'dr congo', 'bosnia-herzegovina': 'bosnia and herzegovina',
  'bosnia & herzegovina': 'bosnia and herzegovina',
  'usa': 'united states', 'us': 'united states',
  'türkiye': 'turkey', 'turkiye': 'turkey',
  'curacao': 'curacao', 'curaçao': 'curacao',
};

function normalizeTeamName(name) {
  if (!name) return '';
  const lower = name.toLowerCase().trim();
  return NAME_ALIASES[lower] || lower;
}

function findDbMatch(matchesList, homeTeam, awayTeam) {
  const homeNorm = normalizeTeamName(homeTeam);
  const awayNorm = normalizeTeamName(awayTeam);
  return matchesList.find(m => {
    const ma = normalizeTeamName(NAME_MAP[m.team_a]);
    const mb = normalizeTeamName(NAME_MAP[m.team_b]);
    return (ma === homeNorm && mb === awayNorm) || (ma === awayNorm && mb === homeNorm);
  });
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, resp => {
      let d = '';
      resp.on('data', chunk => d += chunk);
      resp.on('end', () => {
        if (resp.statusCode !== 200) return reject(new Error(`HTTP ${resp.statusCode}: ${d.slice(0, 200)}`));
        try { resolve(JSON.parse(d)); } catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function getOddsMultiplier(matchId, predScoreA, predScoreB) {
  const odds = db.prepare('SELECT * FROM match_odds WHERE match_id = ?').get(matchId);
  if (!odds) return 1.0;
  if (predScoreA > predScoreB) return Math.min(odds.odds_a, 8.0);
  if (predScoreA < predScoreB) return Math.min(odds.odds_b, 8.0);
  return Math.min(odds.odds_draw, 8.0);
}

// --- API ---

app.get('/api/players', (req, res) => {
  const players = db.prepare('SELECT id, name, created_at FROM players ORDER BY name').all();
  res.json(players);
});

// Analytics
function track(req, event, data) {
  try {
    const ip = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.ip;
    db.prepare('INSERT INTO analytics (event, data, ip) VALUES (?, ?, ?)').run(event, JSON.stringify(data || {}), ip);
  } catch(e) {}
}

function generateToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 48; i++) token += chars[Math.floor(Math.random() * chars.length)];
  return token;
}

function authPlayer(req) {
  const token = req.headers['x-session-token'] || req.query.token;
  if (!token) return null;
  return db.prepare('SELECT id, name, email, avatar_url, telegram_chat_id FROM players WHERE session_token = ?').get(token) || null;
}

function verifyPlayer(playerId, pinOrToken) {
  if (!pinOrToken) return false;
  const player = db.prepare('SELECT pin, session_token FROM players WHERE id = ?').get(playerId);
  if (!player) return false;
  return player.pin === pinOrToken || player.session_token === pinOrToken;
}

// Google Sign-In
app.post('/api/auth/google', async (req, res) => {
  const { credential, lang } = req.body;
  if (!credential) return res.status(400).json({ error: 'Missing credential' });

  const clientId = db.prepare("SELECT value FROM settings WHERE key = 'google_client_id'").get()?.value;
  if (!clientId) return res.status(500).json({ error: 'Google auth not configured' });

  try {
    // Verify Google token
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
    const payload = await fetchJson(url);

    if (payload.aud !== clientId) return res.status(401).json({ error: 'Invalid token audience' });
    if (!payload.email) return res.status(401).json({ error: 'No email in token' });

    const { email, name, sub: googleId, picture } = payload;
    const token = generateToken();

    // Find or create player
    let player = db.prepare('SELECT * FROM players WHERE google_id = ? OR email = ?').get(googleId, email);
    const playerLang = lang || 'he';
    if (player) {
      db.prepare('UPDATE players SET session_token = ?, google_id = ?, avatar_url = ?, name = ?, lang = ?, email_verified = 1 WHERE id = ?')
        .run(token, googleId, picture || '', name || player.name, playerLang, player.id);
    } else {
      const playerName = name || email.split('@')[0];
      const result = db.prepare('INSERT INTO players (name, email, google_id, avatar_url, pin, session_token, lang, email_verified) VALUES (?, ?, ?, ?, ?, ?, ?, 1)')
        .run(playerName, email, googleId, picture || '', 'google-auth', token, playerLang);
      player = { id: result.lastInsertRowid, name: playerName };
      const inviteCode = createAutoGroup(player.id, playerName, playerLang);
      sendWelcomeEmail(email, playerName, playerLang, player.id, inviteCode).catch(e => console.error('Welcome email failed:', e.message));
    }

    track(req, 'login_google', { player_id: player.id, name: player.name || name });
    res.json({ id: player.id, name: player.name || name, email, avatar_url: picture, token });
  } catch (e) {
    console.error('Google auth error:', e.message);
    res.status(401).json({ error: 'אימות Google נכשל' });
  }
});

// Legacy PIN auth (still works, now returns session token)
app.post('/api/players', (req, res) => {
  const { name, pin } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'צריך שם' });
  if (!pin || pin.length < 4) return res.status(400).json({ error: 'צריך קוד בן 4 ספרות לפחות' });
  const token = generateToken();
  try {
    const result = db.prepare('INSERT INTO players (name, pin, session_token) VALUES (?, ?, ?)').run(name.trim(), pin, token);
    res.json({ id: result.lastInsertRowid, name: name.trim(), token });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'השם או האימייל כבר תפוסים' });
    throw e;
  }
});

app.post('/api/login', (req, res) => {
  const { name, pin } = req.body;
  const player = db.prepare('SELECT id, name, pin FROM players WHERE name = ?').get(name);
  if (!player) return res.status(404).json({ error: 'שחקן לא נמצא' });
  if (player.pin !== pin) return res.status(401).json({ error: 'קוד שגוי' });
  const token = generateToken();
  db.prepare('UPDATE players SET session_token = ? WHERE id = ?').run(token, player.id);
  track(req, "login_pin", { player_id: player.id });
  res.json({ id: player.id, name: player.name, token });
});

// Update language preference
app.post('/api/auth/update-lang', (req, res) => {
  const player = authPlayer(req);
  if (!player) return res.status(401).json({ error: 'not logged in' });
  const { lang } = req.body;
  if (lang) db.prepare('UPDATE players SET lang = ? WHERE id = ?').run(lang, player.id);
  res.json({ ok: true });
});

// Session restore
app.get('/api/auth/me', (req, res) => {
  const player = authPlayer(req);
  if (!player) return res.status(401).json({ error: 'not logged in' });
  res.json(player);
});

// Email + password signup
app.post('/api/auth/signup', async (req, res) => {
  const { email, password, name, lang } = req.body;
  if (!email?.trim()) return res.status(400).json({ error: 'Email required' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const playerName = (name || email.split('@')[0]).trim();
  const playerLang = lang || 'he';

  const existing = db.prepare('SELECT id FROM players WHERE email = ?').get(email.toLowerCase().trim());
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const token = generateToken();
  const verifyToken = generateToken();
  const pwHash = hashPassword(password);

  try {
    const result = db.prepare(
      'INSERT INTO players (name, email, password_hash, pin, session_token, lang, email_verified, verify_token) VALUES (?, ?, ?, ?, ?, ?, 0, ?)'
    ).run(playerName, email.toLowerCase().trim(), pwHash, 'email-auth', token, playerLang, verifyToken);

    const inviteCode = createAutoGroup(result.lastInsertRowid, playerName, playerLang);
    const verifyUrl = `https://tikitaka.vip/api/auth/verify-email?token=${verifyToken}`;
    sendVerifyEmail(email, playerName, verifyUrl, playerLang).catch(e => console.error('Verify email failed:', e.message));
    sendWelcomeEmail(email, playerName, playerLang, result.lastInsertRowid, inviteCode).catch(e => console.error('Welcome email failed:', e.message));

    track(req, 'signup_email', { player_id: result.lastInsertRowid, name: playerName });
    res.json({ id: result.lastInsertRowid, name: playerName, email, token });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email or name already taken' });
    throw e;
  }
});

// Email + password login
app.post('/api/auth/login', (req, res) => {
  const { email, password, lang } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const player = db.prepare('SELECT * FROM players WHERE email = ?').get(email.toLowerCase().trim());
  if (!player || !player.password_hash) return res.status(401).json({ error: 'Invalid email or password' });

  try {
    if (!verifyPassword(password, player.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
  } catch {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = generateToken();
  const updates = lang ? 'session_token = ?, lang = ?' : 'session_token = ?';
  const params = lang ? [token, lang, player.id] : [token, player.id];
  db.prepare(`UPDATE players SET ${updates} WHERE id = ?`).run(...params);

  track(req, 'login_email', { player_id: player.id });
  res.json({ id: player.id, name: player.name, email: player.email, avatar_url: player.avatar_url, token });
});

// Email verification
app.get('/api/auth/verify-email', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('Missing token');

  const player = db.prepare('SELECT id, lang FROM players WHERE verify_token = ?').get(token);
  if (!player) return res.status(400).send('Invalid or expired token');

  db.prepare('UPDATE players SET email_verified = 1, verify_token = NULL WHERE id = ?').run(player.id);
  res.redirect('/?verified=1');
});

// Request password reset
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email, lang } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const player = db.prepare('SELECT id, name, lang, password_hash FROM players WHERE email = ?').get(email.toLowerCase().trim());
  if (!player || !player.password_hash) {
    return res.json({ ok: true });
  }

  const resetToken = generateToken();
  const expires = new Date(Date.now() + 3600000).toISOString();
  db.prepare('UPDATE players SET reset_token = ?, reset_expires = ? WHERE id = ?').run(resetToken, expires, player.id);

  const playerLang = lang || player.lang || 'he';
  const resetUrl = `https://tikitaka.vip/?reset=${resetToken}`;
  sendResetEmail(email, player.name, resetUrl, playerLang).catch(e => console.error('Reset email failed:', e.message));

  res.json({ ok: true });
});

// Confirm password reset
app.post('/api/auth/reset-password', (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const player = db.prepare('SELECT id, reset_expires FROM players WHERE reset_token = ?').get(token);
  if (!player) return res.status(400).json({ error: 'Invalid or expired token' });
  if (new Date(player.reset_expires) < new Date()) return res.status(400).json({ error: 'Token expired' });

  const pwHash = hashPassword(password);
  const sessionToken = generateToken();
  db.prepare('UPDATE players SET password_hash = ?, reset_token = NULL, reset_expires = NULL, session_token = ? WHERE id = ?')
    .run(pwHash, sessionToken, player.id);

  res.json({ ok: true, token: sessionToken });
});

app.get('/api/auth/google-client-id', (req, res) => {
  const clientId = db.prepare("SELECT value FROM settings WHERE key = 'google_client_id'").get()?.value;
  res.json({ clientId: clientId || null });
});

app.get('/api/matches', (req, res) => {
  const matches = db.prepare('SELECT * FROM matches ORDER BY match_order').all();
  const results = db.prepare('SELECT * FROM match_results').all();
  const resultMap = {};
  results.forEach(r => resultMap[r.match_id] = { score_a: r.score_a, score_b: r.score_b });
  const odds = db.prepare('SELECT * FROM match_odds').all();
  const oddsMap = {};
  odds.forEach(o => oddsMap[o.match_id] = { odds_a: o.odds_a, odds_draw: o.odds_draw, odds_b: o.odds_b });
  const now = new Date();
  res.json(matches.map(m => ({
    ...m,
    result: resultMap[m.id] || null,
    odds: oddsMap[m.id] || null,
    locked: m.kickoff_utc ? new Date(m.kickoff_utc) <= now : false,
  })));
});

app.post('/api/matches/:id/update-teams', (req, res) => {
  const { team_a, team_b } = req.body;
  db.prepare('UPDATE matches SET team_a = ?, team_b = ? WHERE id = ?').run(team_a, team_b, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/matches/:id/result', (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'אין הרשאה' });
  db.prepare('DELETE FROM match_results WHERE match_id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.post('/api/matches/:id/odds', (req, res) => {
  const { odds_a, odds_draw, odds_b } = req.body;
  db.prepare('INSERT OR REPLACE INTO match_odds (match_id, odds_a, odds_draw, odds_b) VALUES (?, ?, ?, ?)').run(req.params.id, odds_a, odds_draw, odds_b);
  res.json({ ok: true });
});

app.get('/api/predictions/:playerId', (req, res) => {
  const { pin, token } = req.query;
  const playerId = parseInt(req.params.playerId);
  const isOwner = verifyPlayer(playerId, pin || token);

  const match_preds = db.prepare('SELECT * FROM predictions WHERE player_id = ?').all(playerId);
  const tournament_preds = db.prepare('SELECT * FROM tournament_predictions WHERE player_id = ?').all(playerId);

  if (isOwner) {
    res.json({ match_preds, tournament_preds });
  } else {
    const now = new Date();
    const matchesAll = db.prepare('SELECT * FROM matches').all();
    const lockedIds = new Set(matchesAll.filter(m => m.kickoff_utc && new Date(m.kickoff_utc) <= now).map(m => m.id));
    const tournamentStarted = now >= new Date('2026-06-11T19:00:00Z');

    res.json({
      match_preds: match_preds.filter(p => lockedIds.has(p.match_id)),
      tournament_preds: tournamentStarted ? tournament_preds : [],
    });
  }
});

app.post('/api/predictions/:playerId/match', (req, res) => {
  const { match_id, score_a, score_b, pin } = req.body;
  if (!verifyPlayer(req.params.playerId, pin)) return res.status(401).json({ error: 'אימות נכשל' });

  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(match_id);
  if (match && isLocked(match)) return res.status(403).json({ error: 'המשחק כבר התחיל, אי אפשר לשנות' });

  db.prepare('INSERT OR REPLACE INTO predictions (player_id, match_id, score_a, score_b) VALUES (?, ?, ?, ?)')
    .run(req.params.playerId, match_id, score_a, score_b);
  res.json({ ok: true });
});

app.post('/api/predictions/:playerId/tournament', (req, res) => {
  const { prediction_type, value, pin } = req.body;
  if (!verifyPlayer(req.params.playerId, pin)) return res.status(401).json({ error: 'אימות נכשל' });

  const tournamentStart = new Date('2026-06-11T19:00:00Z');
  if (new Date() >= tournamentStart) return res.status(403).json({ error: 'הניחושים ננעלו! הטורניר כבר התחיל' });

  db.prepare('INSERT OR REPLACE INTO tournament_predictions (player_id, prediction_type, value) VALUES (?, ?, ?)')
    .run(req.params.playerId, prediction_type, value);
  res.json({ ok: true });
});

app.get('/api/actual-results', (req, res) => {
  res.json(db.prepare('SELECT * FROM actual_results').all());
});

app.get('/api/leaderboard', (req, res) => {
  const players = db.prepare('SELECT id, name FROM players').all();
  const results = db.prepare('SELECT * FROM match_results').all();
  const resultMap = {};
  results.forEach(r => resultMap[r.match_id] = { score_a: r.score_a, score_b: r.score_b });
  const actuals = db.prepare('SELECT * FROM actual_results').all();
  const actualMap = Object.fromEntries(actuals.map(a => [a.prediction_type, a.value]));
  const matchesAll = db.prepare('SELECT * FROM matches').all();
  const matchMap = Object.fromEntries(matchesAll.map(m => [m.id, m]));
  const oddsAll = db.prepare('SELECT * FROM match_odds').all();
  const oddsMap = {};
  oddsAll.forEach(o => oddsMap[o.match_id] = o);

  const stageBase = {
    'בתים': 1, 'שמינית גמר': 2, 'שמונה אחרונות': 3,
    'רבע גמר': 4, 'חצי גמר': 5, 'משחק על מקום 3': 4, 'גמר': 6,
  };

  const board = players.map(p => {
    const preds = db.prepare('SELECT * FROM predictions WHERE player_id = ?').all(p.id);
    const tpreds = db.prepare('SELECT * FROM tournament_predictions WHERE player_id = ?').all(p.id);
    let points = 0, exact = 0, correctResult = 0, total = 0, upsets = 0;

    for (const pred of preds) {
      const res = resultMap[pred.match_id];
      if (!res) continue;
      total++;
      const match = matchMap[pred.match_id];
      const mult = stageBase[match?.stage] || 1;
      const pOut = pred.score_a > pred.score_b ? 'a' : pred.score_a < pred.score_b ? 'b' : 'd';
      const rOut = res.score_a > res.score_b ? 'a' : res.score_a < res.score_b ? 'b' : 'd';

      if (pOut !== rOut) continue;

      const odds = oddsMap[pred.match_id];
      let oddsVal = 1.0;
      if (odds) {
        if (rOut === 'a') oddsVal = odds.odds_a;
        else if (rOut === 'b') oddsVal = odds.odds_b;
        else oddsVal = odds.odds_draw;
      }
      oddsVal = Math.min(oddsVal, 8.0);
      if (oddsVal >= 3.0) upsets++;

      if (pred.score_a === res.score_a && pred.score_b === res.score_b) {
        exact++; correctResult++;
        points += Math.round(5 * mult * oddsVal);
      } else if (pred.score_a - pred.score_b === res.score_a - res.score_b) {
        correctResult++;
        points += Math.round(3 * mult * oddsVal);
      } else {
        correctResult++;
        points += Math.round(2 * mult * oddsVal);
      }
    }

    for (const tp of tpreds) {
      if (actualMap[tp.prediction_type] && tp.value === actualMap[tp.prediction_type]) {
        if (tp.prediction_type === 'winner') points += 30;
        else if (tp.prediction_type === 'top_scorer') points += 20;
        else if (tp.prediction_type === 'runner_up') points += 15;
      }
    }

    const totalMatches = matchesAll.filter(m => resultMap[m.id]).length;
    const predicted = preds.filter(p => resultMap[p.match_id]).length;
    const missed = totalMatches - predicted;

    return { ...p, points, exact, correctResult, total, upsets, missed };
  });

  board.sort((a, b) => b.points - a.points || b.exact - a.exact);
  res.json(board);
});

app.get('/api/all-predictions', (req, res) => {
  const { group_id } = req.query;
  if (!group_id) return res.json({});

  const members = db.prepare('SELECT p.id, p.name FROM group_members gm JOIN players p ON p.id = gm.player_id WHERE gm.group_id = ?').all(group_id);
  const memberIds = new Set(members.map(m => m.id));
  const allPreds = db.prepare('SELECT * FROM predictions').all();
  const allTPreds = db.prepare('SELECT * FROM tournament_predictions').all();
  const matchesAll = db.prepare('SELECT * FROM matches').all();
  const now = new Date();
  const lockedMatchIds = new Set(matchesAll.filter(m => m.kickoff_utc && new Date(m.kickoff_utc) <= now).map(m => m.id));
  const tournamentStarted = now >= new Date('2026-06-11T19:00:00Z');

  const byPlayer = {};
  members.forEach(p => byPlayer[p.id] = { name: p.name, matches: {}, tournament: {} });
  allPreds.forEach(p => {
    if (memberIds.has(p.player_id) && lockedMatchIds.has(p.match_id)) {
      byPlayer[p.player_id].matches[p.match_id] = { score_a: p.score_a, score_b: p.score_b };
    }
  });
  if (tournamentStarted) {
    allTPreds.forEach(p => {
      if (memberIds.has(p.player_id)) byPlayer[p.player_id].tournament[p.prediction_type] = p.value;
    });
  }
  res.json(byPlayer);
});

// --- Groups API ---

const DEFAULT_SCORING = {
  exact: 5, diff: 3, result: 2,
  stage_בתים: 1, 'stage_שמינית גמר': 2, 'stage_שמונה אחרונות': 3,
  'stage_רבע גמר': 4, 'stage_חצי גמר': 5, 'stage_משחק על מקום 3': 4, 'stage_גמר': 6,
  bonus_winner: 30, bonus_runner_up: 15, bonus_top_scorer: 20,
  use_odds: true, odds_cap: 8,
};

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const GROUP_NAME_SUFFIX = {
  he: 'והחברים', en: 'and friends', es: 'y amigos', fr: 'et amis',
  pt: 'e amigos', ar: 'والأصدقاء', ru: 'и друзья', de: 'und Freunde', ja: 'と仲間'
};

function createAutoGroup(playerId, playerName, lang) {
  const suffix = GROUP_NAME_SUFFIX[lang] || GROUP_NAME_SUFFIX.en;
  const groupName = `${playerName} ${suffix}`;
  const inviteCode = generateInviteCode();
  const result = db.prepare('INSERT INTO groups (name, invite_code, manager_id, scoring_config) VALUES (?, ?, ?, ?)')
    .run(groupName, inviteCode, playerId, JSON.stringify(DEFAULT_SCORING));
  db.prepare('INSERT INTO group_members (group_id, player_id) VALUES (?, ?)').run(result.lastInsertRowid, playerId);
  ensureMonkeyExists(result.lastInsertRowid);
  return inviteCode;
}

function getGroupScoring(group) {
  try { return { ...DEFAULT_SCORING, ...JSON.parse(group.scoring_config) }; }
  catch { return DEFAULT_SCORING; }
}

function calcPlayerPoints(playerId, scoring) {
  const preds = db.prepare('SELECT * FROM predictions WHERE player_id = ?').all(playerId);
  const tpreds = db.prepare('SELECT * FROM tournament_predictions WHERE player_id = ?').all(playerId);
  const results = db.prepare('SELECT * FROM match_results').all();
  const resultMap = {};
  results.forEach(r => resultMap[r.match_id] = { score_a: r.score_a, score_b: r.score_b });
  const matchesAll = db.prepare('SELECT * FROM matches').all();
  const matchMap = Object.fromEntries(matchesAll.map(m => [m.id, m]));
  const oddsAll = db.prepare('SELECT * FROM match_odds').all();
  const oddsMap = {};
  oddsAll.forEach(o => oddsMap[o.match_id] = o);
  const actuals = db.prepare('SELECT * FROM actual_results').all();
  const actualMap = Object.fromEntries(actuals.map(a => [a.prediction_type, a.value]));

  let points = 0, exact = 0, correctResult = 0, total = 0;

  for (const pred of preds) {
    const res = resultMap[pred.match_id];
    if (!res) continue;
    total++;
    const match = matchMap[pred.match_id];
    const stageMult = scoring[`stage_${match?.stage}`] || 1;
    const pOut = pred.score_a > pred.score_b ? 'a' : pred.score_a < pred.score_b ? 'b' : 'd';
    const rOut = res.score_a > res.score_b ? 'a' : res.score_a < res.score_b ? 'b' : 'd';

    if (pOut !== rOut) continue;

    let oddsVal = 1.0;
    if (scoring.use_odds) {
      const odds = oddsMap[pred.match_id];
      if (odds) {
        if (rOut === 'a') oddsVal = odds.odds_a;
        else if (rOut === 'b') oddsVal = odds.odds_b;
        else oddsVal = odds.odds_draw;
      }
      oddsVal = Math.min(oddsVal, scoring.odds_cap || 8);
    }

    if (pred.score_a === res.score_a && pred.score_b === res.score_b) {
      exact++; correctResult++;
      points += Math.round((scoring.exact || 5) * stageMult * oddsVal);
    } else if (pred.score_a - pred.score_b === res.score_a - res.score_b) {
      correctResult++;
      points += Math.round((scoring.diff || 3) * stageMult * oddsVal);
    } else {
      correctResult++;
      points += Math.round((scoring.result || 2) * stageMult * oddsVal);
    }
  }

  const outrightOdds = {};
  db.prepare('SELECT * FROM outright_odds').all().forEach(o => outrightOdds[o.team_name] = o.odds_winner);

  for (const tp of tpreds) {
    if (actualMap[tp.prediction_type] && tp.value === actualMap[tp.prediction_type]) {
      let bonus = scoring[`bonus_${tp.prediction_type}`] || 0;
      if (scoring.use_odds && (tp.prediction_type === 'winner' || tp.prediction_type === 'runner_up')) {
        const teamOdds = outrightOdds[tp.value];
        if (teamOdds) {
          const oddsMult = Math.min(teamOdds / 5, 20);
          bonus = Math.round(bonus * oddsMult);
        }
      }
      points += bonus;
    }
  }

  return { points, exact, correctResult, total };
}

// Monkey Oracle: predictions derived from live zoo webcam analysis
// Generated by monkey-oracle.js (cron), falls back to random if file missing
function loadMonkeyOracle() {
  const oraclePath = path.join(__dirname, 'monkey-predictions.json');
  try {
    if (fs.existsSync(oraclePath)) {
      return JSON.parse(fs.readFileSync(oraclePath, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load monkey oracle:', e.message);
  }
  return null;
}

function generateMonkeyPrediction(matchId) {
  const oracle = loadMonkeyOracle();
  if (oracle && oracle.predictions && oracle.predictions[matchId]) {
    const p = oracle.predictions[matchId];
    return { score_a: p.score_a, score_b: p.score_b };
  }
  const scores = [0,0,0,1,1,1,1,2,2,2,3,3,4];
  return {
    score_a: scores[Math.floor(Math.random() * scores.length)],
    score_b: scores[Math.floor(Math.random() * scores.length)],
  };
}

function ensureMonkeyExists(groupId) {
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId);
  if (!group) return null;
  const monkeyName = `🐒 קוף (${group.name})`;
  let monkey = db.prepare('SELECT * FROM players WHERE name = ?').get(monkeyName);
  if (!monkey) {
    const result = db.prepare('INSERT INTO players (name, pin) VALUES (?, ?)').run(monkeyName, 'monkey-no-login');
    monkey = { id: result.lastInsertRowid, name: monkeyName };
    db.prepare('INSERT OR IGNORE INTO group_members (group_id, player_id) VALUES (?, ?)').run(groupId, monkey.id);
    const matches = db.prepare('SELECT * FROM matches').all();
    const insert = db.prepare('INSERT OR IGNORE INTO predictions (player_id, match_id, score_a, score_b) VALUES (?, ?, ?, ?)');
    for (const m of matches) {
      const p = generateMonkeyPrediction(m.id);
      insert.run(monkey.id, m.id, p.score_a, p.score_b);
    }

    // Tournament predictions from oracle or random fallback
    const oracle = loadMonkeyOracle();
    const insertTP = db.prepare('INSERT OR IGNORE INTO tournament_predictions (player_id, prediction_type, value) VALUES (?, ?, ?)');
    if (oracle && oracle.tournament) {
      insertTP.run(monkey.id, 'winner', oracle.tournament.winner);
      insertTP.run(monkey.id, 'runner_up', oracle.tournament.runner_up);
      insertTP.run(monkey.id, 'top_scorer', oracle.tournament.top_scorer);
    } else {
      const allTeams = [...new Set(matches.filter(m => m.stage === 'בתים').flatMap(m => [m.team_a, m.team_b]))];
      const randomTeam = () => allTeams[Math.floor(Math.random() * allTeams.length)];
      const topScorers = ['אמבפה','הולאנד','סלאח','קיין','וינסיוס ג\'וניור','מסי','רונאלדו','יאמל','סאקה','לוקאקו'];
      const randomScorer = () => topScorers[Math.floor(Math.random() * topScorers.length)];
      insertTP.run(monkey.id, 'winner', randomTeam());
      insertTP.run(monkey.id, 'runner_up', randomTeam());
      insertTP.run(monkey.id, 'top_scorer', randomScorer());
    }
  }
  return monkey;
}

// Auto-fill: assign 0-0 (or pattern-based) for players who forgot to predict
function autoFillMissing() {
  const results = db.prepare('SELECT * FROM match_results').all();
  const matchesAll = db.prepare('SELECT * FROM matches').all();
  const insert = db.prepare('INSERT OR IGNORE INTO predictions (player_id, match_id, score_a, score_b) VALUES (?, ?, ?, ?)');
  const players = db.prepare('SELECT id FROM players').all();

  let filled = 0;
  for (const r of results) {
    const match = matchesAll.find(m => m.id === r.match_id);
    if (!match) continue;

    for (const p of players) {
      const existing = db.prepare('SELECT 1 FROM predictions WHERE player_id = ? AND match_id = ?').get(p.id, r.match_id);
      if (existing) continue;

      // Check if player has any predictions — use average, otherwise 0-0
      const prev = db.prepare('SELECT AVG(score_a) as avg_a, AVG(score_b) as avg_b, COUNT(*) as c FROM predictions WHERE player_id = ?').get(p.id);
      let sa = 0, sb = 0;
      if (prev && prev.c > 0) {
        sa = Math.round(prev.avg_a);
        sb = Math.round(prev.avg_b);
      }
      insert.run(p.id, r.match_id, sa, sb);
      filled++;
    }
  }
  return filled;
}

app.post('/api/groups', (req, res) => {
  const { name, manager_id, pin } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'צריך שם לקבוצה' });
  if (!verifyPlayer(manager_id, pin)) return res.status(401).json({ error: 'אימות נכשל' });

  const invite_code = generateInviteCode();
  const result = db.prepare('INSERT INTO groups (name, invite_code, manager_id, scoring_config) VALUES (?, ?, ?, ?)')
    .run(name.trim(), invite_code, manager_id, JSON.stringify(DEFAULT_SCORING));
  db.prepare('INSERT INTO group_members (group_id, player_id) VALUES (?, ?)').run(result.lastInsertRowid, manager_id);

  const monkey = ensureMonkeyExists(result.lastInsertRowid);
  track(req, 'group_create', { group_id: result.lastInsertRowid, name: name.trim() });
  res.json({ id: result.lastInsertRowid, invite_code });
});

app.post('/api/groups/join', (req, res) => {
  const { invite_code, player_id } = req.body;
  const group = db.prepare('SELECT * FROM groups WHERE UPPER(invite_code) = ?').get((invite_code || '').toUpperCase());
  if (!group) return res.status(404).json({ error: 'קוד הזמנה לא נמצא' });
  const existing = db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND player_id = ?').get(group.id, player_id);
  if (existing) return res.status(409).json({ error: 'כבר בקבוצה הזו' });
  db.prepare('INSERT INTO group_members (group_id, player_id) VALUES (?, ?)').run(group.id, player_id);
  track(req, 'group_join', { group_id: group.id, player_id });
  res.json({ ok: true, group_id: group.id, name: group.name });
});

app.get('/api/groups/my', (req, res) => {
  const { player_id } = req.query;
  if (!player_id) return res.json([]);
  const groups = db.prepare(`
    SELECT g.*, gm.player_id FROM groups g
    JOIN group_members gm ON gm.group_id = g.id
    WHERE gm.player_id = ?
  `).all(player_id);
  res.json(groups.map(g => ({ id: g.id, name: g.name, invite_code: g.invite_code, is_manager: g.manager_id == player_id })));
});

app.get('/api/groups/:id', (req, res) => {
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'קבוצה לא נמצאה' });
  const members = db.prepare('SELECT p.id, p.name FROM group_members gm JOIN players p ON p.id = gm.player_id WHERE gm.group_id = ? ORDER BY p.name').all(req.params.id);
  const scoring = getGroupScoring(group);
  res.json({ ...group, scoring_config: scoring, members });
});

app.get('/api/groups/:id/leaderboard', (req, res) => {
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'קבוצה לא נמצאה' });
  const scoring = getGroupScoring(group);
  const members = db.prepare('SELECT p.id, p.name FROM group_members gm JOIN players p ON p.id = gm.player_id WHERE gm.group_id = ?').all(req.params.id);

  autoFillMissing();

  const board = members.map(m => {
    const stats = calcPlayerPoints(m.id, scoring);
    const isMonkey = m.name.startsWith('🐒');
    return { ...m, ...stats, isMonkey };
  });

  board.sort((a, b) => b.points - a.points || b.exact - a.exact);
  res.json(board);
});

app.get('/api/groups/:id/predictions', (req, res) => {
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'קבוצה לא נמצאה' });
  const members = db.prepare('SELECT p.id, p.name FROM group_members gm JOIN players p ON p.id = gm.player_id WHERE gm.group_id = ?').all(req.params.id);
  const now = new Date();
  const matchesAll = db.prepare('SELECT * FROM matches').all();
  const lockedIds = new Set(matchesAll.filter(m => m.kickoff_utc && new Date(m.kickoff_utc) <= now).map(m => m.id));
  const tournamentStarted = now >= new Date('2026-06-11T19:00:00Z');

  const byPlayer = {};
  for (const m of members) {
    const preds = db.prepare('SELECT * FROM predictions WHERE player_id = ?').all(m.id);
    const tpreds = db.prepare('SELECT * FROM tournament_predictions WHERE player_id = ?').all(m.id);
    byPlayer[m.id] = {
      name: m.name,
      matches: {},
      tournament: {},
    };
    for (const p of preds) {
      if (lockedIds.has(p.match_id)) {
        byPlayer[m.id].matches[p.match_id] = { score_a: p.score_a, score_b: p.score_b };
      }
    }
    if (tournamentStarted) {
      for (const tp of tpreds) {
        byPlayer[m.id].tournament[tp.prediction_type] = tp.value;
      }
    }
  }
  res.json(byPlayer);
});

app.post('/api/groups/:id/scoring', (req, res) => {
  const { scoring, player_id, pin } = req.body;
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'קבוצה לא נמצאה' });
  if (group.manager_id !== player_id) return res.status(403).json({ error: 'רק המנהל יכול לשנות ניקוד' });
  if (!verifyPlayer(player_id, pin)) return res.status(401).json({ error: 'אימות נכשל' });
  db.prepare('UPDATE groups SET scoring_config = ? WHERE id = ?').run(JSON.stringify(scoring), req.params.id);
  res.json({ ok: true });
});

app.post('/api/groups/:id/leave', (req, res) => {
  const { player_id } = req.body;
  db.prepare('DELETE FROM group_members WHERE group_id = ? AND player_id = ?').run(req.params.id, player_id);
  res.json({ ok: true });
});

app.get('/api/stats', (req, res) => {
  const humanPlayers = db.prepare("SELECT COUNT(*) as c FROM players WHERE name NOT LIKE '%קוף%'").get().c;
  const preds = db.prepare('SELECT COUNT(*) as c FROM predictions').get().c;
  const results = db.prepare('SELECT COUNT(*) as c FROM match_results').get().c;
  const totalMatches = db.prepare('SELECT COUNT(*) as c FROM matches').get().c;
  const groups = db.prepare('SELECT COUNT(*) as c FROM groups').get().c;
  res.json({ players: humanPlayers, predictions: preds, results, totalMatches, groups });
});

// --- Shared fetch logic ---

async function doFetchOdds() {
  const apiKey = db.prepare("SELECT value FROM settings WHERE key = 'odds_api_key'").get()?.value;
  if (!apiKey) throw new Error('הגדירו ODDS_API_KEY בהגדרות');

  const url = `https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds?apiKey=${encodeURIComponent(apiKey)}&regions=eu&markets=h2h&oddsFormat=decimal`;
  const data = await fetchJson(url);

  const upsert = db.prepare('INSERT OR REPLACE INTO match_odds (match_id, odds_a, odds_draw, odds_b) VALUES (?, ?, ?, ?)');
  const matchesList = db.prepare('SELECT * FROM matches').all();
  let updated = 0;

  for (const apiMatch of data) {
    const dbMatch = findDbMatch(matchesList, apiMatch.home_team, apiMatch.away_team);
    if (dbMatch && apiMatch.bookmakers?.length) {
      const bm = apiMatch.bookmakers[0].markets?.find(m => m.key === 'h2h');
      if (bm) {
        const outcomes = {};
        bm.outcomes.forEach(o => outcomes[normalizeTeamName(o.name)] = o.price);
        const teamANorm = normalizeTeamName(NAME_MAP[dbMatch.team_a]);
        const teamBNorm = normalizeTeamName(NAME_MAP[dbMatch.team_b]);
        const oa = outcomes[teamANorm] || 2.5;
        const od = outcomes['draw'] || 3.2;
        const ob = outcomes[teamBNorm] || 2.5;
        upsert.run(dbMatch.id, oa, od, ob);
        updated++;
      }
    }
  }
  // Also fetch outright winner odds
  try {
    const winnerUrl = `https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup_winner/odds?apiKey=${encodeURIComponent(apiKey)}&regions=eu&markets=outrights&oddsFormat=decimal`;
    const winnerData = await fetchJson(winnerUrl);
    if (Array.isArray(winnerData) && winnerData.length > 0 && winnerData[0].bookmakers?.length) {
      const outcomes = winnerData[0].bookmakers[0].markets?.[0]?.outcomes || [];
      const upsertOutright = db.prepare('INSERT OR REPLACE INTO outright_odds (team_name, odds_winner) VALUES (?, ?)');
      for (const o of outcomes) {
        const hebrewName = REVERSE_NAME_MAP[normalizeTeamName(o.name)];
        if (hebrewName) {
          upsertOutright.run(hebrewName, o.price);
        }
      }
      console.log(`Outright odds: updated ${outcomes.length} teams`);
    }
  } catch (e) {
    console.error('Outright odds fetch failed:', e.message);
  }

  return { updated, total: data.length };
}

async function doFetchScores() {
  const apiKey = db.prepare("SELECT value FROM settings WHERE key = 'odds_api_key'").get()?.value;
  if (!apiKey) throw new Error('הגדירו ODDS_API_KEY בהגדרות');

  const url = `https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/scores?apiKey=${encodeURIComponent(apiKey)}&daysFrom=3`;
  const data = await fetchJson(url);

  const upsertResult = db.prepare('INSERT OR REPLACE INTO match_results (match_id, score_a, score_b) VALUES (?, ?, ?)');
  const matchesList = db.prepare('SELECT * FROM matches').all();
  const existingResults = new Set(db.prepare('SELECT match_id FROM match_results').all().map(r => r.match_id));
  let updated = 0;

  for (const apiMatch of data) {
    if (!apiMatch.completed) continue;
    if (!apiMatch.scores || apiMatch.scores.length < 2) continue;

    const dbMatch = findDbMatch(matchesList, apiMatch.home_team, apiMatch.away_team);
    if (!dbMatch) continue;
    if (existingResults.has(dbMatch.id)) continue;

    const homeNorm = normalizeTeamName(apiMatch.home_team);
    const teamANorm = normalizeTeamName(NAME_MAP[dbMatch.team_a]);

    let scoreA, scoreB;
    const homeScore = apiMatch.scores.find(s => normalizeTeamName(s.name) === homeNorm);
    const awayScore = apiMatch.scores.find(s => normalizeTeamName(s.name) !== homeNorm);

    if (!homeScore || !awayScore) continue;

    if (teamANorm === homeNorm) {
      scoreA = parseInt(homeScore.score);
      scoreB = parseInt(awayScore.score);
    } else {
      scoreA = parseInt(awayScore.score);
      scoreB = parseInt(homeScore.score);
    }

    if (isNaN(scoreA) || isNaN(scoreB)) continue;

    upsertResult.run(dbMatch.id, scoreA, scoreB);
    updated++;
    console.log(`Auto-result: ${dbMatch.team_a} ${scoreA}-${scoreB} ${dbMatch.team_b}`);
    autoFillMissing();
  }

  return { updated, total: data.filter(m => m.completed).length };
}

// --- API endpoints ---

app.post('/api/fetch-odds', async (req, res) => {
  try {
    const result = await doFetchOdds();
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/fetch-scores', async (req, res) => {
  try {
    const result = await doFetchScores();
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Auto-fetch: check for new scores every 5 minutes
let autoFetchInterval = null;

function startAutoFetch() {
  if (autoFetchInterval) return;
  autoFetchInterval = setInterval(async () => {
    const apiKey = db.prepare("SELECT value FROM settings WHERE key = 'odds_api_key'").get()?.value;
    if (!apiKey) return;

    const now = new Date();
    const matchesToday = db.prepare('SELECT * FROM matches WHERE kickoff_utc IS NOT NULL').all()
      .filter(m => {
        const kick = new Date(m.kickoff_utc);
        const diff = (now - kick) / 1000 / 60;
        return diff > 90 && diff < 360; // finished 1.5-6 hours ago
      });

    if (matchesToday.length === 0) return;

    const unresolved = matchesToday.filter(m => {
      return !db.prepare('SELECT 1 FROM match_results WHERE match_id = ?').get(m.id);
    });

    if (unresolved.length === 0) return;

    try {
      const result = await doFetchScores();
      if (result.updated > 0) {
        console.log(`Auto-fetch: updated ${result.updated} match results`);
      }
    } catch (e) {
      console.error('Auto-fetch scores failed:', e.message);
    }
  }, 5 * 60 * 1000);
}

startAutoFetch();

const ADMIN_EMAIL = 'evyatar.kaplan@gmail.com';

function isAdmin(req) {
  const player = authPlayer(req);
  if (!player) return false;
  return player.email === ADMIN_EMAIL;
}

app.post('/api/settings', (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'אין הרשאה' });
  const { key, value } = req.body;
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  res.json({ ok: true });
});

app.get('/api/settings/:key', (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'אין הרשאה' });
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(req.params.key);
  res.json({ value: row?.value || '' });
});

app.post('/api/matches/:id/result', (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'אין הרשאה' });
  const { score_a, score_b } = req.body;
  db.prepare('INSERT OR REPLACE INTO match_results (match_id, score_a, score_b) VALUES (?, ?, ?)').run(req.params.id, score_a, score_b);
  res.json({ ok: true });
});

app.post('/api/actual-results', (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'אין הרשאה' });
  const { prediction_type, value } = req.body;
  db.prepare('INSERT OR REPLACE INTO actual_results (prediction_type, value) VALUES (?, ?)').run(prediction_type, value);
  res.json({ ok: true });
});

app.get('/api/auth/is-admin', (req, res) => {
  res.json({ admin: isAdmin(req) });
});

app.get('/api/analytics', (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'אין הרשאה' });
  const summary = {
    total_events: db.prepare('SELECT COUNT(*) as c FROM analytics').get().c,
    logins_google: db.prepare("SELECT COUNT(*) as c FROM analytics WHERE event='login_google'").get().c,
    logins_pin: db.prepare("SELECT COUNT(*) as c FROM analytics WHERE event='login_pin'").get().c,
    groups_created: db.prepare("SELECT COUNT(*) as c FROM analytics WHERE event='group_create'").get().c,
    group_joins: db.prepare("SELECT COUNT(*) as c FROM analytics WHERE event='group_join'").get().c,
    total_players: db.prepare('SELECT COUNT(*) as c FROM players').get().c,
    total_predictions: db.prepare('SELECT COUNT(*) as c FROM predictions').get().c,
    total_groups: db.prepare('SELECT COUNT(*) as c FROM groups').get().c,
    recent: db.prepare('SELECT event, data, created_at FROM analytics ORDER BY id DESC LIMIT 20').all(),
  };
  res.json(summary);
});

app.get('/api/outright-odds', (req, res) => {
  res.json(db.prepare('SELECT * FROM outright_odds ORDER BY odds_winner ASC').all());
});

const OG_DESC = {
  he: 'קוף אמיתי מגן החיות מנחש את המונדיאל. אתם יכולים לנצח אותו? ניחושי הפתעה שווים יותר נקודות!',
  en: 'A real zoo monkey predicts every World Cup match. Can you beat it? Upset predictions earn way more points!',
  es: 'Un mono real del zoológico pronostica cada partido del Mundial. ¿Puedes ganarle?',
  fr: 'Un vrai singe du zoo pronostique chaque match de la Coupe du Monde. Tu peux le battre ?',
  pt: 'Um macaco de verdade do zoológico dá palpites em todos os jogos da Copa. Consegue vencer ele?',
  ar: 'قرد حقيقي من حديقة الحيوان يتوقع كل مباريات كأس العالم. هل تقدر تغلبه؟',
  ru: 'Настоящая обезьяна из зоопарка прогнозирует все матчи ЧМ. Сможешь её обыграть?',
  de: 'Ein echter Zoo-Affe tippt jedes WM-Spiel. Kannst du ihn schlagen?',
  ja: '動物園の本物のサルがW杯全試合を予想。勝てる？',
};

function detectLangFromReq(req) {
  const accept = req.headers['accept-language'] || '';
  const langs = Object.keys(OG_DESC);
  for (const part of accept.split(',')) {
    const code = part.trim().split(';')[0].split('-')[0].toLowerCase();
    if (langs.includes(code)) return code;
  }
  return 'he';
}

// Invite link: /join/CODE — serve HTML with dynamic OG tags, then redirect client-side
app.get('/join/:code', (req, res) => {
  const group = db.prepare('SELECT * FROM groups WHERE UPPER(invite_code) = ?').get(req.params.code.toUpperCase());
  const groupName = group ? group.name : 'TikiTaka';
  const memberCount = group ? db.prepare('SELECT COUNT(*) as c FROM group_members WHERE group_id = ?').get(group.id).c : 0;
  const lang = detectLangFromReq(req);
  const desc = OG_DESC[lang] || OG_DESC.en;
  const dir = (lang === 'he' || lang === 'ar') ? 'rtl' : 'ltr';

  res.send(`<!DOCTYPE html><html lang="${lang}" dir="${dir}"><head>
    <meta charset="UTF-8">
    <title>${groupName} — TikiTaka</title>
    <meta property="og:title" content="${groupName} — TikiTaka World Cup 2026">
    <meta property="og:description" content="${memberCount > 1 ? memberCount + ' players. ' : ''}${desc}">
    <meta property="og:image" content="https://tikitaka.vip/og-image.png">
    <meta property="og:url" content="https://tikitaka.vip/join/${req.params.code}">
    <meta http-equiv="refresh" content="0;url=/?join=${encodeURIComponent(req.params.code)}">
  </head><body></body></html>`);
});

// Notifications — Web Push + Telegram
setTgBotToken('8959296229:AAElcVWPberJ3UT0RmrSxfSDWvHpQkNS9MY');
db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('tg_bot_username', 'TikiTakaVipBot')").run();
setupNotificationRoutes(app, db);
startNotificationScheduler(db);

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`World Cup predictor running on port ${PORT}`));
