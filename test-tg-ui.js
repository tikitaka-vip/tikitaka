// Tests the rich Telegram inline-keyboard flow against a throwaway DB copy.
// TG API calls no-op (no token), so we assert DB effects + keyboard structure.
process.env.TG_BOT_TOKEN = ''; // ensure tgCall is a no-op (no network)
const fs = require('fs'), path = require('path');
const Database = require('better-sqlite3');

const TMP = path.join('/tmp', 'test-tgui-' + process.pid + '.db');
fs.copyFileSync(path.join(__dirname, 'worldcup.db'), TMP);
const db = new Database(TMP);
for (const [c, sql] of [
  ['session_token', "ALTER TABLE players ADD COLUMN session_token TEXT"],
  ['email', "ALTER TABLE players ADD COLUMN email TEXT"],
  ['google_id', "ALTER TABLE players ADD COLUMN google_id TEXT"],
  ['avatar_url', "ALTER TABLE players ADD COLUMN avatar_url TEXT DEFAULT ''"],
  ['whatsapp_id', "ALTER TABLE players ADD COLUMN whatsapp_id TEXT"],
  ['bot_pending_match_id', "ALTER TABLE players ADD COLUMN bot_pending_match_id INTEGER"],
]) { const cols = new Set(db.prepare('PRAGMA table_info(players)').all().map(x => x.name)); if (!cols.has(c)) db.exec(sql); }

const tg = require('./telegram-bot');
const eng = require('./bot-engine');

let fail = 0;
const ok = (c, l) => { console.log((c ? '  ✅ ' : '  ❌ ') + l); if (!c) fail++; };
const CID = 888000111;
const cb = (data) => ({ id: 'cbq1', data, from: { id: CID }, message: { message_id: 555, chat: { id: CID } } });

(async () => {
  console.log('=== onboarding (/start) ===');
  await tg.handleTelegramMessage(db, { chatId: CID, tgUser: { id: CID, first_name: 'Ariel', language_code: 'he' }, text: '/start' });
  const player = db.prepare('SELECT * FROM players WHERE telegram_chat_id = ?').get(String(CID));
  ok(!!player, 'player created');
  ok(player.bot_pending_match_id != null, 'pending match set after onboarding');
  const mid = player.bot_pending_match_id;

  console.log('=== keyboard structure for the card ===');
  const match = eng.getMatchById(db, mid);
  const card = tg.buildCard(db, player, match, 0, 0);
  const rows = card.reply_markup.inline_keyboard;
  ok(rows.length === 5, '5 keyboard rows (2 steppers, quick, save, skip/mine)');
  const allBtns = rows.flat();
  ok(allBtns.every(b => Buffer.byteLength(b.callback_data) <= 64), 'all callback_data <= 64 bytes');
  ok(rows[0].some(b => b.callback_data === `g|${mid}|0|0|am`), 'stepper a- present');
  ok(rows[2].length === 4 && rows[2][2].callback_data === `q|${mid}|2|1`, 'quick-pick 2-1 present');
  ok(rows[3][0].callback_data === `g|${mid}|0|0|ok`, 'save button present');
  ok(card.text.includes('0 – 0'), 'card shows current score');

  console.log('=== stepper: a+ then b+ (no DB write) ===');
  await tg.handleTelegramCallback(db, cb(`g|${mid}|0|0|ap`)); // a -> 1 (card only)
  let preds = db.prepare('SELECT COUNT(*) c FROM predictions WHERE player_id=?').get(player.id).c;
  ok(preds === 0, 'stepper does not save a prediction');

  console.log('=== quick-pick set 2-1 then SAVE ===');
  await tg.handleTelegramCallback(db, cb(`q|${mid}|2|1`));        // set card to 2-1
  await tg.handleTelegramCallback(db, cb(`g|${mid}|2|1|ok`));     // save 2-1
  const pred = db.prepare('SELECT score_a, score_b FROM predictions WHERE player_id=? AND match_id=?').get(player.id, mid);
  ok(pred && pred.score_a === 2 && pred.score_b === 1, 'saved 2-1 for the match');
  const after = db.prepare('SELECT bot_pending_match_id FROM players WHERE id=?').get(player.id).bot_pending_match_id;
  ok(after !== mid && after != null, 'advanced to next match after save');

  console.log('=== skip current, then save 0-0 via stepper+ok ===');
  const mid2 = after;
  await tg.handleTelegramCallback(db, cb(`g|${mid2}|0|0|sk`));    // skip -> mid3
  const mid3 = db.prepare('SELECT bot_pending_match_id FROM players WHERE id=?').get(player.id).bot_pending_match_id;
  ok(mid3 !== mid2, 'skip advanced past the skipped match');
  ok(!db.prepare('SELECT 1 FROM predictions WHERE player_id=? AND match_id=?').get(player.id, mid2), 'skipped match has no prediction');
  await tg.handleTelegramCallback(db, cb(`g|${mid3}|0|0|ok`));    // save 0-0
  ok(!!db.prepare('SELECT 1 FROM predictions WHERE player_id=? AND match_id=?').get(player.id, mid3), 'saved the un-skipped match');

  console.log('=== lock guard: cannot save a kicked-off match ===');
  // pick a match already started (kickoff in the past) and try to save
  const pastMatch = db.prepare("SELECT * FROM matches WHERE kickoff_utc <= ? ORDER BY kickoff_utc DESC LIMIT 1").get(new Date().toISOString());
  if (pastMatch) {
    await tg.handleTelegramCallback(db, cb(`g|${pastMatch.id}|3|3|ok`));
    ok(!db.prepare('SELECT 1 FROM predictions WHERE player_id=? AND match_id=?').get(player.id, pastMatch.id), 'locked match was NOT saved');
  } else ok(true, '(no past match to test lock)');

  console.log('=== text fallback "4-2" still works ===');
  await tg.handleTelegramMessage(db, { chatId: CID, tgUser: { id: CID, first_name: 'Ariel', language_code: 'he' }, text: '4-2' });
  const total = db.prepare('SELECT COUNT(*) c FROM predictions WHERE player_id=?').get(player.id).c;
  ok(total >= 3, `text-typed score saved (total predictions: ${total})`);

  db.close(); fs.unlinkSync(TMP);
  console.log(`\n${fail === 0 ? '🎉 ALL PASSED' : '💥 ' + fail + ' FAILED'}`);
  process.exit(fail ? 1 : 0);
})();
