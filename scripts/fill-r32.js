#!/usr/bin/env node
// scripts/fill-r32.js
// Turn the 29/06 Round-of-32 fill into one safe, verified command.
//
// It computes the live group standings (scripts/r32-standings.js), resolves the
// official FIFA 2026 R32 bracket (matches 73-88) to real team names, prints the
// 16 matchups, and ONLY with --execute + a valid admin token POSTs them to
// /api/matches/:id/update-teams. Dry-run by default. Idempotent + verifies each
// response. Refuses to run if standings are incomplete, ties are unresolved, or
// the set of qualified third-placed groups differs from the encoded bracket.
//
// Usage:
//   node scripts/fill-r32.js                 # dry-run against ./worldcup.db
//   node scripts/fill-r32.js --db /opt/worldcup/worldcup.db
//   node scripts/fill-r32.js --execute --token <ADMIN_SESSION_TOKEN> [--url http://127.0.0.1:3000] [--db <path>]
//
// The admin token is the session_token of the admin player (evyatar.kaplan@gmail.com).

const path = require('path');
const { computeStandings } = require('./r32-standings');

// ---- args ----
const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const dbPath = val('--db', path.join(__dirname, '..', 'worldcup.db'));
const baseUrl = (val('--url', 'http://127.0.0.1:3000')).replace(/\/$/, '');
const token = val('--token', process.env.ADMIN_TOKEN);
const execute = has('--execute');

// ---- Official FIFA 2026 Round-of-32 bracket: DB match id -> [slotA, slotB] ----
// Slot codes: 1X = winner of group X, 2X = runner-up of X, 3X = 3rd of X.
// The 3rd-place slot groups below are the assignment for the ACTUAL qualified
// combination {B,D,E,F,I,J,K,L}; the guard further down enforces that.
// Cross-checked against en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage.
const BRACKET = {
  73: ['2A', '2B'], 74: ['1E', '3D'], 75: ['1F', '2C'], 76: ['1C', '2F'],
  77: ['1I', '3F'], 78: ['2E', '2I'], 79: ['1A', '3E'], 80: ['1L', '3K'],
  81: ['1D', '3B'], 82: ['1G', '3I'], 83: ['2K', '2L'], 84: ['1H', '2J'],
  85: ['1B', '3J'], 86: ['1J', '2H'], 87: ['1K', '3L'], 88: ['2D', '2G'],
};
const EXPECTED_THIRD_GROUPS = ['B', 'D', 'E', 'F', 'I', 'J', 'K', 'L'];

const s = computeStandings(dbPath);

// ---- safety guards ----
const fail = m => { console.error('REFUSING TO FILL: ' + m); process.exit(1); };
if (!s.complete) fail(`group stage not complete (${s.played}/${s.expected} resulted).`);
if (s.anyTie) fail('a group has an unresolved tie (needs fair-play/lots) — fill manually.');
if (s.qualifiedThirdGroups.join('') !== EXPECTED_THIRD_GROUPS.join('')) {
  fail(`qualified third-placed groups are {${s.qualifiedThirdGroups.join(',')}} but the encoded `
     + `bracket assumes {${EXPECTED_THIRD_GROUPS.join(',')}}. The FIFA 3rd-place slot table `
     + `is combination-specific; update BRACKET before filling.`);
}

function resolve(slot) {
  const pos = slot[0], g = slot.slice(1);
  if (pos === '1') return s.winners[g];
  if (pos === '2') return s.runners[g];
  if (pos === '3') return s.thirdByGroup[g];
  throw new Error('bad slot ' + slot);
}

const plan = Object.entries(BRACKET).map(([id, [a, b]]) => ({
  id: Number(id), slotA: a, slotB: b, team_a: resolve(a), team_b: resolve(b),
}));
if (plan.some(p => !p.team_a || !p.team_b)) fail('a slot resolved to an empty team name.');

console.log(`\n=== ROUND OF 32 FILL PLAN (${execute ? 'EXECUTE' : 'DRY-RUN'}) ===`);
console.log(`db: ${dbPath}`);
for (const p of plan) {
  console.log(`  Match ${p.id}: ${p.team_a}  vs  ${p.team_b}   [${p.slotA} vs ${p.slotB}]`);
}

if (!execute) {
  console.log('\nDry-run only. Re-run with: --execute --token <ADMIN_SESSION_TOKEN> [--url <base>]');
  process.exit(0);
}
if (!token) fail('--execute requires --token <ADMIN_SESSION_TOKEN> (or ADMIN_TOKEN env).');

(async () => {
  let ok = 0;
  for (const p of plan) {
    const res = await fetch(`${baseUrl}/api/matches/${p.id}/update-teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-session-token': token },
      body: JSON.stringify({ team_a: p.team_a, team_b: p.team_b }),
    });
    const body = await res.text();
    if (res.ok) { ok++; console.log(`  ✓ Match ${p.id} filled`); }
    else { console.error(`  ✗ Match ${p.id} FAILED ${res.status}: ${body}`); }
  }
  console.log(`\nDone: ${ok}/${plan.length} matches filled.`);
  process.exit(ok === plan.length ? 0 : 1);
})();
