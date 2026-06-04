#!/usr/bin/env node
/**
 * WAL-safe SQLite backup for TikiTaka.
 *
 * The production DB runs in WAL journal mode (server.js: journal_mode = WAL).
 * A plain `cp worldcup.db` can miss transactions still living in the -wal file
 * (committed predictions not yet checkpointed) — i.e. a backup that silently
 * loses recent data. This uses SQLite's online backup API (better-sqlite3
 * db.backup), which produces a transactionally-consistent copy of the live DB.
 *
 * Steps: online backup -> integrity check -> gzip -> rotate old backups.
 *
 * Env overrides:
 *   DB_PATH     source DB           (default /opt/worldcup/worldcup.db)
 *   BACKUP_DIR  destination dir     (default /home/agent/backups/worldcup)
 *   KEEP_DAYS   retention in days   (default 7)
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || '/opt/worldcup/worldcup.db';
const BACKUP_DIR = process.env.BACKUP_DIR || '/home/agent/backups/worldcup';
const KEEP_DAYS = parseInt(process.env.KEEP_DAYS || '7', 10);

function ts() {
  // YYYYMMDD-HHMM in UTC
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;
}

async function main() {
  if (!fs.existsSync(DB_PATH)) throw new Error(`source DB not found: ${DB_PATH}`);
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const stamp = ts();
  const tmpPath = path.join(BACKUP_DIR, `worldcup-${stamp}.db.tmp`);
  const finalDb = path.join(BACKUP_DIR, `worldcup-${stamp}.db`);
  const gzPath = `${finalDb}.gz`;

  // 1. Online, WAL-consistent backup
  const src = new Database(DB_PATH, { readonly: true });
  await src.backup(tmpPath);
  src.close();

  // 2. Integrity check on the copy + sanity row count
  const check = new Database(tmpPath, { readonly: true });
  const integ = check.pragma('integrity_check', { simple: true });
  if (integ !== 'ok') throw new Error(`integrity_check failed: ${integ}`);
  const players = check.prepare('SELECT COUNT(*) c FROM players').get().c;
  const preds = check.prepare('SELECT COUNT(*) c FROM predictions').get().c;
  check.close();

  // 3. gzip and drop the uncompressed temp (+ any sidecars left by the read open)
  const gz = zlib.gzipSync(fs.readFileSync(tmpPath), { level: 9 });
  fs.writeFileSync(gzPath, gz);
  for (const sfx of ['', '-shm', '-wal']) {
    try { fs.unlinkSync(tmpPath + sfx); } catch { /* may not exist */ }
  }

  // 4. Rotate: delete .gz backups older than KEEP_DAYS
  const cutoff = Date.now() - KEEP_DAYS * 86400000;
  let pruned = 0;
  for (const f of fs.readdirSync(BACKUP_DIR)) {
    if (!f.startsWith('worldcup-') || !f.endsWith('.db.gz')) continue;
    const fp = path.join(BACKUP_DIR, f);
    if (fs.statSync(fp).mtimeMs < cutoff) { fs.unlinkSync(fp); pruned++; }
  }

  const sizeKb = Math.round(gz.length / 1024);
  console.log(`[backup-db] OK ${path.basename(gzPath)} (${sizeKb}KB, players=${players}, predictions=${preds}, pruned=${pruned})`);
  return { gzPath, sizeKb, players, preds, pruned };
}

main().catch(err => {
  console.error(`[backup-db] FAILED: ${err.message}`);
  process.exit(1);
});
