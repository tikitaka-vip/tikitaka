// Rich Telegram UX for TikiTaka: sign up + guess scores using inline-keyboard
// buttons (stepper + quick picks), editing one message in place. Uses the shared
// data primitives from bot-engine.js. Telegram-specific; WhatsApp keeps the
// text flow in bot-engine's handleBotMessage.

const https = require('https');
const eng = require('./bot-engine');

function tgCall(method, params) {
  const token = process.env.TG_BOT_TOKEN;
  if (!token) return Promise.resolve(null);
  return new Promise((resolve) => {
    const data = JSON.stringify(params);
    const req = https.request({
      hostname: 'api.telegram.org', path: `/bot${token}/${method}`, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } }); });
    req.on('error', () => resolve(null));
    req.setTimeout(10000, () => { req.destroy(); resolve(null); });
    req.write(data); req.end();
  });
}
const sendMessage = (chat_id, text, reply_markup) => tgCall('sendMessage', { chat_id, text, parse_mode: 'HTML', reply_markup, disable_web_page_preview: true });
const editMessage = (chat_id, message_id, text, reply_markup) => tgCall('editMessageText', { chat_id, message_id, text, parse_mode: 'HTML', reply_markup, disable_web_page_preview: true });
const answer = (callback_query_id, text, show_alert = false) => tgCall('answerCallbackQuery', { callback_query_id, text, show_alert });

// Telegram-specific UI strings (he default, en fallback).
const TS = {
  he: {
    welcome: '🐒 <b>ברוכים הבאים ל-TikiTaka!</b>\nמשחק ניחושי המונדיאל — נגד קוף אמיתי שצופה במצלמות בגן חיות 🙈\nמנחשים את כל המשחקים פה בצ׳אט, בלי אתר.',
    invite: '⚽ הקבוצה שלכם מוכנה! הזמינו חברים — מי שמפסיד לקוף מביא בירות 🍺\n👉 {link}',
    card: '⚽ <b>משחק {n}/{total}</b>\n<b>{teamA}</b>  🆚  <b>{teamB}</b>\n🗓️ {date} {time} · {stage} {grp}\n\n🎯 הניחוש שלכם:  <b>{a} – {b}</b>',
    saved: '✅ נשמר {a}–{b}',
    savedToast: '✅ נשמר!',
    locked: '⏰ המשחק כבר התחיל',
    allDone: '🎉 <b>סיימתם!</b>\nניחשתם את כל המשחקים הקרובים. נעדכן כשייפתחו חדשים.\n\n📊 הטבלה מול הקוף: {link}',
    mineHdr: '📋 <b>הניחושים שלכם:</b>',
    mineEmpty: 'עוד אין ניחושים. שלחו /start כדי להתחיל 🎯',
    help: '🎯 פשוט לחצו על הכפתורים כדי לנחש!\n➖➕ לכוונון · ⚡ תוצאות נפוצות · ✅ לשמירה · ⏭️ לדלג\nאפשר גם לכתוב תוצאה כמו <code>2-1</code>.\nפקודות: /start · /mine · /stop',
    stopped: '👍 הפסקנו. /start כדי להמשיך.',
    save: '✅ שמור {a}–{b}', skip: '⏭️ דלג', mine: '📋 שלי',
  },
  en: {
    welcome: '🐒 <b>Welcome to TikiTaka!</b>\nThe World Cup prediction game — against a REAL monkey watching zoo webcams 🙈\nPredict every match right here, no website.',
    invite: '⚽ Your group is ready! Invite friends — whoever loses to the monkey buys beers 🍺\n👉 {link}',
    card: '⚽ <b>Match {n}/{total}</b>\n<b>{teamA}</b>  🆚  <b>{teamB}</b>\n🗓️ {date} {time} · {stage} {grp}\n\n🎯 Your prediction:  <b>{a} – {b}</b>',
    saved: '✅ Saved {a}–{b}',
    savedToast: '✅ Saved!',
    locked: '⏰ Match already started',
    allDone: '🎉 <b>All done!</b>\nYou predicted every upcoming match. We\'ll ping you when new ones open.\n\n📊 Your table vs the monkey: {link}',
    mineHdr: '📋 <b>Your predictions:</b>',
    mineEmpty: 'No predictions yet. Send /start to begin 🎯',
    help: '🎯 Just tap the buttons to predict!\n➖➕ adjust · ⚡ common scores · ✅ save · ⏭️ skip\nYou can also type a score like <code>2-1</code>.\nCommands: /start · /mine · /stop',
    stopped: '👍 Paused. /start to continue.',
    save: '✅ Save {a}–{b}', skip: '⏭️ Skip', mine: '📋 Mine',
  },
};
const langOf = (p) => (TS[p?.lang] ? p.lang : 'he');
function ts(lang, key, vars = {}) { let s = (TS[lang] || TS.en)[key] || TS.en[key]; for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v); return s; }
function short(name) { return name.length > 12 ? name.slice(0, 11) + '…' : name; }

// Build the match-card text + inline keyboard for a given (match, a, b).
function buildCard(db, player, match, a, b) {
  const lang = langOf(player);
  const total = eng.upcomingCount(db);
  const n = eng.predictedUpcomingCount(db, player.id) + 1;
  const teamA = eng.teamName(match.team_a, lang), teamB = eng.teamName(match.team_b, lang);
  const text = ts(lang, 'card', {
    n, total, teamA, teamB, a, b,
    date: match.match_date || '', time: match.match_time || '',
    stage: match.stage || '', grp: match.group_name || '',
  });
  const mid = match.id;
  const g = (op) => `g|${mid}|${a}|${b}|${op}`;
  const reply_markup = { inline_keyboard: [
    [{ text: '➖', callback_data: g('am') }, { text: `${short(teamA)}: ${a}`, callback_data: 'no' }, { text: '➕', callback_data: g('ap') }],
    [{ text: '➖', callback_data: g('bm') }, { text: `${short(teamB)}: ${b}`, callback_data: 'no' }, { text: '➕', callback_data: g('bp') }],
    [
      { text: '0-0', callback_data: `q|${mid}|0|0` }, { text: '1-0', callback_data: `q|${mid}|1|0` },
      { text: '2-1', callback_data: `q|${mid}|2|1` }, { text: '1-1', callback_data: `q|${mid}|1|1` },
    ],
    [{ text: ts(lang, 'save', { a, b }), callback_data: g('ok') }],
    [{ text: ts(lang, 'skip'), callback_data: g('sk') }, { text: ts(lang, 'mine'), callback_data: `mine` }],
  ] };
  return { text, reply_markup };
}

// The next match to show: earliest upcoming unpredicted, optionally after a kickoff.
function nextCardMatch(db, player, afterKickoff) {
  if (afterKickoff) {
    return db.prepare(
      `SELECT * FROM matches WHERE kickoff_utc > ? AND id NOT IN (SELECT match_id FROM predictions WHERE player_id = ?)
       ORDER BY kickoff_utc ASC LIMIT 1`
    ).get(afterKickoff, player.id);
  }
  return eng.nextUnpredictedMatch(db, player.id);
}

function startScore(db, player, match) {
  const ex = db.prepare('SELECT score_a, score_b FROM predictions WHERE player_id = ? AND match_id = ?').get(player.id, match.id);
  return ex ? { a: ex.score_a, b: ex.score_b } : { a: 0, b: 0 };
}

// Send (new message) the next card, or the all-done message. Used on onboarding/commands.
async function sendNextCard(db, player, chatId) {
  const match = nextCardMatch(db, player);
  if (!match) { await sendMessage(chatId, ts(langOf(player), 'allDone', { link: eng.BASE })); return; }
  db.prepare('UPDATE players SET bot_pending_match_id = ? WHERE id = ?').run(match.id, player.id);
  const { a, b } = startScore(db, player, match);
  const card = buildCard(db, player, match, a, b);
  await sendMessage(chatId, card.text, card.reply_markup);
}

async function sendMine(db, player, chatId) {
  const lang = langOf(player);
  const rows = eng.getUpcomingPredictions(db, player.id);
  if (!rows.length) return sendMessage(chatId, ts(lang, 'mineEmpty'));
  const lines = rows.map(r => `• ${eng.teamName(r.team_a, lang)} <b>${r.score_a}-${r.score_b}</b> ${eng.teamName(r.team_b, lang)}  <i>${r.match_date}</i>`);
  return sendMessage(chatId, ts(lang, 'mineHdr') + '\n' + lines.join('\n'));
}

// ---- entry points called from notifications.js webhook ----

async function handleTelegramMessage(db, { chatId, tgUser, text }) {
  const name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || tgUser.username || 'Player';
  const lang = tgUser.language_code && TS[tgUser.language_code] ? tgUser.language_code : 'he';
  const { player, isNew, inviteCode } = eng.getOrCreatePlayer(db, { platform: 'telegram', chatId, name, lang });

  if (isNew) {
    await sendMessage(chatId, ts(lang, 'welcome'));
    if (inviteCode) await sendMessage(chatId, ts(lang, 'invite', { link: `${eng.BASE}/join/${inviteCode}` }));
    await sendNextCard(db, player, chatId);
    return;
  }

  const x = text.trim().toLowerCase();
  if (['/mine', 'mine', 'שלי'].includes(x)) return sendMine(db, player, chatId);
  if (['/help', 'help', 'עזרה', '?'].includes(x)) return sendMessage(chatId, ts(langOf(player), 'help'));
  if (['/stop', 'stop', 'עצור'].includes(x)) {
    db.prepare('UPDATE players SET bot_pending_match_id = NULL WHERE id = ?').run(player.id);
    return sendMessage(chatId, ts(langOf(player), 'stopped'));
  }
  // Text fallback: typed a score like "2-1"
  const score = eng.parseScore(text);
  if (score) {
    let match = player.bot_pending_match_id ? eng.getMatchById(db, player.bot_pending_match_id) : null;
    if (!match || eng.isLocked(match)) match = eng.nextUnpredictedMatch(db, player.id);
    if (match && !eng.isLocked(match)) {
      db.prepare('INSERT OR REPLACE INTO predictions (player_id, match_id, score_a, score_b) VALUES (?, ?, ?, ?)')
        .run(player.id, match.id, score.a, score.b);
    }
    return sendNextCard(db, player, chatId);
  }
  // Anything else (incl. /start, greetings): show the current/next card.
  return sendNextCard(db, player, chatId);
}

async function handleTelegramCallback(db, cbq) {
  const chatId = cbq.message?.chat?.id;
  const messageId = cbq.message?.message_id;
  const data = cbq.data || '';
  const player = db.prepare('SELECT * FROM players WHERE telegram_chat_id = ?').get(String(chatId));
  if (!player) { await answer(cbq.id, 'שלחו /start'); return; }
  const lang = langOf(player);
  const p = data.split('|');
  const kind = p[0];

  if (kind === 'no') return answer(cbq.id);
  if (kind === 'mine') { await answer(cbq.id); return sendMine(db, player, chatId); }

  const mid = parseInt(p[1], 10);
  const match = eng.getMatchById(db, mid);
  if (!match) return answer(cbq.id);

  // Quick-pick: set the card to an absolute scoreline.
  if (kind === 'q') {
    const a = parseInt(p[2], 10), b = parseInt(p[3], 10);
    const card = buildCard(db, player, match, a, b);
    await editMessage(chatId, messageId, card.text, card.reply_markup);
    return answer(cbq.id);
  }

  if (kind === 'g') {
    let a = parseInt(p[2], 10), b = parseInt(p[3], 10);
    const op = p[4];
    const clamp = (x) => Math.max(0, Math.min(20, x));

    if (op === 'am') a = clamp(a - 1);
    else if (op === 'ap') a = clamp(a + 1);
    else if (op === 'bm') b = clamp(b - 1);
    else if (op === 'bp') b = clamp(b + 1);

    if (['am', 'ap', 'bm', 'bp'].includes(op)) {
      const card = buildCard(db, player, match, a, b);
      await editMessage(chatId, messageId, card.text, card.reply_markup);
      return answer(cbq.id);
    }

    if (op === 'sk') {
      await answer(cbq.id, '⏭️');
      const next = nextCardMatch(db, player, match.kickoff_utc);
      if (!next) return editMessage(chatId, messageId, ts(lang, 'allDone', { link: eng.BASE }), { inline_keyboard: [] });
      db.prepare('UPDATE players SET bot_pending_match_id = ? WHERE id = ?').run(next.id, player.id);
      const s = startScore(db, player, next);
      const card = buildCard(db, player, next, s.a, s.b);
      return editMessage(chatId, messageId, card.text, card.reply_markup);
    }

    if (op === 'ok') {
      if (eng.isLocked(match)) { await answer(cbq.id, ts(lang, 'locked'), true); }
      else {
        db.prepare('INSERT OR REPLACE INTO predictions (player_id, match_id, score_a, score_b) VALUES (?, ?, ?, ?)')
          .run(player.id, mid, a, b);
        await answer(cbq.id, ts(lang, 'savedToast'));
      }
      const next = nextCardMatch(db, player, match.kickoff_utc);
      if (!next) return editMessage(chatId, messageId, ts(lang, 'allDone', { link: eng.BASE }), { inline_keyboard: [] });
      db.prepare('UPDATE players SET bot_pending_match_id = ? WHERE id = ?').run(next.id, player.id);
      const s = startScore(db, player, next);
      const card = buildCard(db, player, next, s.a, s.b);
      return editMessage(chatId, messageId, card.text, card.reply_markup);
    }
  }
  return answer(cbq.id);
}

module.exports = { handleTelegramMessage, handleTelegramCallback, buildCard, _ts: ts };
