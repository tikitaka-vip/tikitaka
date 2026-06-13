// End-to-end test of the shared bot engine on a throwaway DB copy.
const fs = require('fs'), path = require('path');
const Database = require('better-sqlite3');

const SRC = path.join(__dirname, 'worldcup.db');
const TMP = path.join('/tmp', 'test-wc-' + process.pid + '.db');
fs.copyFileSync(SRC, TMP);
const db = new Database(TMP);
// The stale dev copy predates some base columns; prod has them. Ensure the full
// set the engine touches so we test against a prod-like schema.
for (const [c, sql] of [
  ['session_token', "ALTER TABLE players ADD COLUMN session_token TEXT"],
  ['email', "ALTER TABLE players ADD COLUMN email TEXT"],
  ['google_id', "ALTER TABLE players ADD COLUMN google_id TEXT"],
  ['avatar_url', "ALTER TABLE players ADD COLUMN avatar_url TEXT DEFAULT ''"],
  ['whatsapp_id', "ALTER TABLE players ADD COLUMN whatsapp_id TEXT"],
  ['bot_pending_match_id', "ALTER TABLE players ADD COLUMN bot_pending_match_id INTEGER"],
]) {
  const cols = new Set(db.prepare('PRAGMA table_info(players)').all().map(x => x.name));
  if (!cols.has(c)) db.exec(sql);
}

const { handleBotMessage } = require('./bot-engine');

let failures = 0;
function assert(cond, label) { console.log((cond ? '  ✅ ' : '  ❌ ') + label); if (!cond) failures++; }

async function convo(platform, chatId) {
  const out = [];
  const send = (msg) => { out.push(msg); return Promise.resolve(true); };
  const ctx = (text) => ({ platform, chatId, name: 'Tester', lang: 'he', text, send });

  console.log(`\n=== ${platform} : new user "/start" ===`);
  await handleBotMessage(db, ctx('/start'));
  out.forEach(m => console.log('  > ' + m.split('\n')[0]));
  assert(out.some(m => m.includes('ברוכים הבאים')), 'sends welcome');
  assert(out.some(m => m.includes('/join/')), 'sends group invite link');
  assert(out.some(m => m.includes('משחק 1/')), 'prompts first match');

  const col = platform === 'telegram' ? 'telegram_chat_id' : 'whatsapp_id';
  const player = db.prepare(`SELECT * FROM players WHERE ${col} = ?`).get(String(chatId));
  assert(!!player, 'player created in DB');
  assert(player.pin === (platform === 'telegram' ? 'tg-auth' : 'wa-auth'), 'correct auth pin');
  assert(player.bot_pending_match_id != null, 'pending match set');
  const pendingBefore = player.bot_pending_match_id;

  console.log(`=== ${platform} : submit guess "2-1" ===`);
  out.length = 0;
  await handleBotMessage(db, ctx('2-1'));
  out.forEach(m => console.log('  > ' + m.split('\n')[0]));
  assert(out.some(m => m.includes('נשמר')), 'confirms saved');
  const pred = db.prepare('SELECT * FROM predictions WHERE player_id = ? AND match_id = ?').get(player.id, pendingBefore);
  assert(pred && pred.score_a === 2 && pred.score_b === 1, 'prediction 2-1 stored for the pending match');
  const after = db.prepare(`SELECT bot_pending_match_id FROM players WHERE id = ?`).get(player.id);
  assert(after.bot_pending_match_id !== pendingBefore && after.bot_pending_match_id != null, 'advanced to next match');

  console.log(`=== ${platform} : "הבא" (skip) then guess "0-0" ===`);
  out.length = 0;
  await handleBotMessage(db, ctx('הבא'));
  const skipped = db.prepare(`SELECT bot_pending_match_id FROM players WHERE id = ?`).get(player.id).bot_pending_match_id;
  assert(out.some(m => m.includes('דילגנו')), 'skip acknowledged');
  out.length = 0;
  await handleBotMessage(db, ctx('0:0'));
  const pred2 = db.prepare('SELECT * FROM predictions WHERE player_id = ? AND match_id = ?').get(player.id, skipped);
  assert(pred2 && pred2.score_a === 0 && pred2.score_b === 0, 'accepts "0:0" colon format on skipped match');

  console.log(`=== ${platform} : bad input + "שלי" + "טבלה" + returning "/start" ===`);
  out.length = 0; await handleBotMessage(db, ctx('lol not a score'));
  assert(out.some(m => m.includes('לא הבנתי')), 'rejects non-score gracefully');
  out.length = 0; await handleBotMessage(db, ctx('שלי'));
  assert(out.some(m => m.includes('הניחושים שלכם')), '"mine" lists predictions');
  out.length = 0; await handleBotMessage(db, ctx('טבלה'));
  assert(out.some(m => m.includes('/join/') || m.includes('tikitaka')), '"table" returns a link');
  out.length = 0; await handleBotMessage(db, ctx('/start'));
  const players = db.prepare(`SELECT COUNT(*) c FROM players WHERE ${col} = ?`).get(String(chatId)).c;
  assert(players === 1, 'returning "/start" does NOT create a duplicate player');
  assert(out.some(m => m.includes('משחק')), 'returning user gets next prompt, not welcome again');

  const totalPreds = db.prepare('SELECT COUNT(*) c FROM predictions WHERE player_id = ?').get(player.id).c;
  console.log(`  (player ${player.id} now has ${totalPreds} predictions)`);
}

(async () => {
  await convo('telegram', 999000001);
  await convo('whatsapp', '972500000001');
  db.close(); fs.unlinkSync(TMP);
  console.log(`\n${failures === 0 ? '🎉 ALL PASSED' : '💥 ' + failures + ' FAILED'}`);
  process.exit(failures === 0 ? 0 : 1);
})();
