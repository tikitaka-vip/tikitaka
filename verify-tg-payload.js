// Build a REAL card payload via buildCard and emit it as JSON, so we can POST it
// to Telegram's API and confirm the structure (HTML + inline_keyboard) is accepted.
const fs = require('fs'), path = require('path');
const Database = require('better-sqlite3');
const TMP = '/tmp/verify-tg-' + process.pid + '.db';
fs.copyFileSync(path.join(__dirname, 'worldcup.db'), TMP);
const db = new Database(TMP);
for (const [c, sql] of [
  ['session_token', "ALTER TABLE players ADD COLUMN session_token TEXT"],
  ['whatsapp_id', "ALTER TABLE players ADD COLUMN whatsapp_id TEXT"],
  ['bot_pending_match_id', "ALTER TABLE players ADD COLUMN bot_pending_match_id INTEGER"],
]) { const cols = new Set(db.prepare('PRAGMA table_info(players)').all().map(x => x.name)); if (!cols.has(c)) db.exec(sql); }

const tg = require('./telegram-bot');
const eng = require('./bot-engine');
const r = db.prepare("INSERT INTO players (name, pin, lang) VALUES ('PayloadProbe','x','he')").run();
const player = db.prepare('SELECT * FROM players WHERE id=?').get(r.lastInsertRowid);
const match = eng.nextUnpredictedMatch(db, player.id);
const card = tg.buildCard(db, player, match, 2, 1);
const payload = { chat_id: 999, text: card.text, parse_mode: 'HTML', reply_markup: card.reply_markup, disable_web_page_preview: true };
fs.writeFileSync('/tmp/tg-card.json', JSON.stringify(payload));
console.log('matchId', match.id, '| text bytes', Buffer.byteLength(card.text), '| rows', card.reply_markup.inline_keyboard.length);
db.close(); fs.unlinkSync(TMP);
