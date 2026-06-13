// Platform-agnostic chat bot engine for TikiTaka.
// Both the Telegram (notifications.js) and WhatsApp (whatsapp.js) webhooks call
// handleBotMessage() with a platform-specific `send(text)` function. All sign-up
// and in-chat guessing logic lives here so the two platforms stay identical.

const crypto = require('crypto');

// Hebrew -> English team names (kept in sync with NAME_MAP in server.js).
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

const GROUP_NAME_SUFFIX = {
  he: 'והחברים', en: 'and friends', es: 'y amigos', fr: 'et amis',
  pt: 'e amigos', ar: 'والأصدقاء', ru: 'и друзья', de: 'und Freunde', ja: 'と仲間'
};

const S = {
  he: {
    welcome: '🐒 ברוכים הבאים ל-TikiTaka — משחק ניחושי המונדיאל נגד קוף אמיתי!\nאפשר לנחש את כל המשחקים פה בצ׳אט, בלי להיכנס לאתר.',
    invite: '⚽ הקבוצה שלכם מוכנה! הזמינו חברים — מי שמפסיד לקוף מביא בירות 🍺\n👉 {link}',
    prompt: '⚽ משחק {n}/{total}\n{teamA} 🆚 {teamB}\n🏟️ {stage} {grp} · {date} {time} (שעון ישראל)\n\nמה הניחוש? שלחו תוצאה כמו 2-1',
    saved: '✅ נשמר! {teamA} {a}-{b} {teamB}',
    allDone: '🎉 ניחשתם את כל המשחקים הקרובים! נשלח תזכורת כשייפתחו משחקים חדשים.\nלצפייה בטבלה: {link}',
    badScore: '🤔 לא הבנתי. שלחו תוצאה כמו 2-1 (מספרים 0-20).',
    locked: '⏰ המשחק הזה כבר התחיל ונעול. ממשיכים למשחק הבא.',
    skipped: '⏭️ דילגנו. הנה המשחק הבא:',
    mineHdr: '📋 הניחושים שלכם למשחקים הקרובים:',
    mineEmpty: 'עוד לא ניחשתם משחקים קרובים. שלחו "התחל" כדי להתחיל.',
    help: 'פקודות:\n• תוצאה כמו 2-1 — לנחש\n• "הבא" — לדלג למשחק הבא\n• "שלי" — הניחושים שלי\n• "טבלה" — קישור לטבלה\n• "עצור" — להפסיק',
    stopped: '👍 הפסקנו. שלחו "התחל" מתי שתרצו להמשיך לנחש.',
    table: '🏆 הטבלה שלכם מול הקוף: {link}',
  },
  en: {
    welcome: '🐒 Welcome to TikiTaka — the World Cup prediction game against a REAL monkey!\nYou can predict every match right here in chat, no website needed.',
    invite: '⚽ Your group is ready! Invite friends — whoever loses to the monkey buys beers 🍺\n👉 {link}',
    prompt: '⚽ Match {n}/{total}\n{teamA} 🆚 {teamB}\n🏟️ {stage} {grp} · {date} {time} (Israel time)\n\nYour prediction? Send a score like 2-1',
    saved: '✅ Saved! {teamA} {a}-{b} {teamB}',
    allDone: '🎉 You\'ve predicted all upcoming matches! We\'ll ping you when new ones open.\nSee the table: {link}',
    badScore: '🤔 Didn\'t catch that. Send a score like 2-1 (numbers 0-20).',
    locked: '⏰ That match already kicked off and is locked. Moving to the next one.',
    skipped: '⏭️ Skipped. Here\'s the next match:',
    mineHdr: '📋 Your predictions for upcoming matches:',
    mineEmpty: 'No upcoming predictions yet. Send "start" to begin.',
    help: 'Commands:\n• a score like 2-1 — predict\n• "next" — skip to next match\n• "mine" — my predictions\n• "table" — leaderboard link\n• "stop" — pause',
    stopped: '👍 Paused. Send "start" whenever you want to keep predicting.',
    table: '🏆 Your table vs the monkey: {link}',
  },
};

const BASE = 'https://tikitaka.vip';
function t(lang, key, vars = {}) {
  let s = (S[lang] || S.en)[key] || S.en[key];
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
}
function teamName(heName, lang) { return lang === 'he' ? heName : (NAME_MAP[heName] || heName); }
function genToken(n = 48) {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let s = ''; for (let i = 0; i < n; i++) s += c[crypto.randomInt(c.length)];
  return s;
}
function genInviteCode() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = ''; for (let i = 0; i < 6; i++) s += c[crypto.randomInt(c.length)];
  return s;
}

const PLATFORM_COL = { telegram: 'telegram_chat_id', whatsapp: 'whatsapp_id' };
const PLATFORM_PIN = { telegram: 'tg-auth', whatsapp: 'wa-auth' };

// Find player by platform id, or create one (with auto-group), mirroring the
// website/TG onboarding. Returns { player, isNew, inviteCode }.
function getOrCreatePlayer(db, { platform, chatId, name, lang }) {
  const col = PLATFORM_COL[platform];
  let player = db.prepare(`SELECT * FROM players WHERE ${col} = ?`).get(String(chatId));
  if (player) return { player, isNew: false, inviteCode: inviteCodeFor(db, player.id) };

  const sessionToken = genToken();
  // Display names aren't unique among chat users ("Mom", "David"), but the
  // players table may enforce UNIQUE(name). Retry with a short suffix on clash.
  const ins = db.prepare(
    `INSERT INTO players (name, pin, session_token, lang, ${col}, email_verified) VALUES (?, ?, ?, ?, ?, 0)`
  );
  let finalName = name, playerId;
  for (let attempt = 0; ; attempt++) {
    try { playerId = ins.run(finalName, PLATFORM_PIN[platform], sessionToken, lang, String(chatId)).lastInsertRowid; break; }
    catch (e) {
      if (!String(e.message).includes('UNIQUE') || attempt >= 5) throw e;
      finalName = `${name} ${crypto.randomInt(1000, 9999)}`;
    }
  }
  name = finalName;

  // Auto-group (matches the TG onboarding in notifications.js)
  const suffix = GROUP_NAME_SUFFIX[lang] || GROUP_NAME_SUFFIX.en;
  const inviteCode = genInviteCode();
  const defaultScoring = db.prepare('SELECT scoring_config FROM groups LIMIT 1').get()?.scoring_config || '{}';
  const gr = db.prepare('INSERT INTO groups (name, invite_code, manager_id, scoring_config) VALUES (?, ?, ?, ?)')
    .run(`${name} ${suffix}`, inviteCode, playerId, defaultScoring);
  db.prepare('INSERT INTO group_members (group_id, player_id) VALUES (?, ?)').run(gr.lastInsertRowid, playerId);

  player = db.prepare('SELECT * FROM players WHERE id = ?').get(playerId);
  return { player, isNew: true, inviteCode };
}

function inviteCodeFor(db, playerId) {
  return db.prepare('SELECT invite_code FROM groups WHERE manager_id = ? LIMIT 1').get(playerId)?.invite_code || null;
}

function nowIso() { return new Date().toISOString(); }

function nextUnpredictedMatch(db, playerId) {
  return db.prepare(
    `SELECT * FROM matches
     WHERE kickoff_utc > ? AND id NOT IN (SELECT match_id FROM predictions WHERE player_id = ?)
     ORDER BY kickoff_utc ASC LIMIT 1`
  ).get(nowIso(), playerId);
}
function upcomingCount(db) {
  return db.prepare('SELECT COUNT(*) c FROM matches WHERE kickoff_utc > ?').get(nowIso()).c;
}
function predictedUpcomingCount(db, playerId) {
  return db.prepare(
    `SELECT COUNT(*) c FROM predictions p JOIN matches m ON m.id = p.match_id
     WHERE p.player_id = ? AND m.kickoff_utc > ?`
  ).get(playerId, nowIso()).c;
}
function isLocked(match) {
  return match.kickoff_utc ? new Date(match.kickoff_utc) <= new Date() : false;
}
function getMatchById(db, id) { return db.prepare('SELECT * FROM matches WHERE id = ?').get(id); }
function getUpcomingPredictions(db, playerId, limit = 15) {
  return db.prepare(
    `SELECT m.id match_id, m.team_a, m.team_b, m.match_date, m.match_time, p.score_a, p.score_b
     FROM predictions p JOIN matches m ON m.id = p.match_id
     WHERE p.player_id = ? AND m.kickoff_utc > ? ORDER BY m.kickoff_utc ASC LIMIT ?`
  ).all(playerId, nowIso(), limit);
}

function promptForMatch(db, player, match) {
  const lang = player.lang || 'he';
  const total = upcomingCount(db);
  const n = predictedUpcomingCount(db, player.id) + 1;
  return t(lang, 'prompt', {
    n, total,
    teamA: teamName(match.team_a, lang),
    teamB: teamName(match.team_b, lang),
    stage: match.stage || '',
    grp: match.group_name || '',
    date: match.match_date || '',
    time: match.match_time || '',
  });
}

// Send the next match prompt and remember it as the pending match.
async function promptNext(db, player, send, prefix = '') {
  const match = nextUnpredictedMatch(db, player.id);
  if (!match) {
    db.prepare('UPDATE players SET bot_pending_match_id = NULL WHERE id = ?').run(player.id);
    await send(t(player.lang || 'he', 'allDone', { link: BASE }));
    return;
  }
  db.prepare('UPDATE players SET bot_pending_match_id = ? WHERE id = ?').run(match.id, player.id);
  await send((prefix ? prefix + '\n\n' : '') + promptForMatch(db, player, match));
}

const SCORE_RE = /^\s*(\d{1,2})\s*[-:xX× ]\s*(\d{1,2})\s*$/;

function parseScore(text) {
  const m = String(text).match(SCORE_RE);
  if (!m) return null;
  const a = parseInt(m[1], 10), b = parseInt(m[2], 10);
  if (a < 0 || b < 0 || a > 20 || b > 20) return null;
  return { a, b };
}

function detectCommand(text) {
  const x = String(text).trim().toLowerCase();
  if (['/start', 'start', 'התחל', 'היי', 'hi', 'hello', 'שלום'].includes(x)) return 'start';
  if (['/help', 'help', 'עזרה', '?'].includes(x)) return 'help';
  if (['next', 'skip', 'הבא', 'דלג'].includes(x)) return 'next';
  if (['mine', 'my', 'שלי', 'הניחושים שלי'].includes(x)) return 'mine';
  if (['table', 'standings', 'leaderboard', 'טבלה'].includes(x)) return 'table';
  if (['stop', 'pause', 'עצור', 'הפסק'].includes(x)) return 'stop';
  return null;
}

async function sendMine(db, player, send) {
  const lang = player.lang || 'he';
  const rows = db.prepare(
    `SELECT m.team_a, m.team_b, m.match_date, m.match_time, p.score_a, p.score_b
     FROM predictions p JOIN matches m ON m.id = p.match_id
     WHERE p.player_id = ? AND m.kickoff_utc > ?
     ORDER BY m.kickoff_utc ASC LIMIT 15`
  ).all(player.id, nowIso());
  if (!rows.length) return send(t(lang, 'mineEmpty'));
  const lines = rows.map(r =>
    `• ${teamName(r.team_a, lang)} ${r.score_a}-${r.score_b} ${teamName(r.team_b, lang)} (${r.match_date} ${r.match_time})`
  );
  return send(t(lang, 'mineHdr') + '\n' + lines.join('\n'));
}

// Main entry point. ctx = { platform, chatId, name, lang, text, send }.
// send(text) -> Promise, platform-specific.
async function handleBotMessage(db, ctx) {
  const { platform, chatId, text, send } = ctx;
  const name = (ctx.name || 'Player').trim();
  const lang = S[ctx.lang] ? ctx.lang : 'he';

  const { player, isNew, inviteCode } = getOrCreatePlayer(db, { platform, chatId, name, lang });

  if (isNew) {
    await send(t(lang, 'welcome'));
    if (inviteCode) await send(t(lang, 'invite', { link: `${BASE}/join/${inviteCode}` }));
    await promptNext(db, player, send);
    return;
  }

  const cmd = detectCommand(text);
  if (cmd === 'start') return promptNext(db, player, send);
  if (cmd === 'help') return send(t(player.lang || lang, 'help'));
  if (cmd === 'stop') {
    db.prepare('UPDATE players SET bot_pending_match_id = NULL WHERE id = ?').run(player.id);
    return send(t(player.lang || lang, 'stopped'));
  }
  if (cmd === 'mine') return sendMine(db, player, send);
  if (cmd === 'table') return send(t(player.lang || lang, 'table', { link: inviteCode ? `${BASE}/join/${inviteCode}` : BASE }));
  if (cmd === 'next') {
    db.prepare('UPDATE players SET bot_pending_match_id = NULL WHERE id = ?').run(player.id);
    return promptNext(db, player, send, t(player.lang || lang, 'skipped'));
  }

  const score = parseScore(text);
  if (!score) return send(t(player.lang || lang, 'badScore'));

  // Resolve target: the pending match if still valid, else the next unpredicted one.
  let target = null;
  if (player.bot_pending_match_id) {
    const pend = db.prepare('SELECT * FROM matches WHERE id = ?').get(player.bot_pending_match_id);
    if (pend && !isLocked(pend)) target = pend;
  }
  if (!target) target = nextUnpredictedMatch(db, player.id);
  if (!target) return promptNext(db, player, send); // nothing left -> allDone

  if (isLocked(target)) {
    db.prepare('UPDATE players SET bot_pending_match_id = NULL WHERE id = ?').run(player.id);
    return promptNext(db, player, send, t(player.lang || lang, 'locked'));
  }

  db.prepare('INSERT OR REPLACE INTO predictions (player_id, match_id, score_a, score_b) VALUES (?, ?, ?, ?)')
    .run(player.id, target.id, score.a, score.b);

  const plang = player.lang || lang;
  const saved = t(plang, 'saved', {
    teamA: teamName(target.team_a, plang), teamB: teamName(target.team_b, plang),
    a: score.a, b: score.b,
  });
  await promptNext(db, player, send, saved);
}

module.exports = {
  handleBotMessage, getOrCreatePlayer, parseScore, NAME_MAP,
  // primitives for the rich Telegram UI layer
  nextUnpredictedMatch, getMatchById, getUpcomingPredictions, isLocked,
  teamName, upcomingCount, predictedUpcomingCount, inviteCodeFor, t, S, BASE,
};
