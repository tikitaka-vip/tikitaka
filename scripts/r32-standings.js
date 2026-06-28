#!/usr/bin/env node
// scripts/r32-standings.js
// Read-only tool: compute final group standings + the 8 best third-placed
// teams from the live DB, so the operator can fill the Round-of-32 ("שמינית
// גמר") bracket accurately on the 29/06 fill. This NEVER writes to the DB.
//
// Usage:  node scripts/r32-standings.js [path-to-db]
//   default db: ./worldcup.db   (prod: /opt/worldcup/worldcup.db, readonly)
//
// Also exports computeStandings(dbPath) for scripts/fill-r32.js.
//
// FIFA tiebreakers applied, in order:
//   1. Points  2. Goal difference  3. Goals for
//   4..6. Head-to-head points / GD / GF among the still-tied teams
//   (fair-play and drawing-of-lots cannot be computed — such ties are flagged)

const path = require('path');
const Database = require('better-sqlite3');

const GROUP_STAGE = 'בתים';
const GD = t => t.GF - t.GA;

function computeStandings(dbPath) {
const db = new Database(dbPath, { readonly: true });

// Pull every resulted group match.
const rows = db.prepare(`
  SELECT m.group_name AS grp, m.team_a, m.team_b, r.score_a, r.score_b
  FROM matches m JOIN match_results r ON r.match_id = m.id
  WHERE m.stage = ?
`).all(GROUP_STAGE);

const expected = db.prepare(`SELECT COUNT(*) n FROM matches WHERE stage = ?`).get(GROUP_STAGE).n;
const complete = rows.length === expected;

// Build per-group team stats.
const groups = {}; // grp -> { team -> stats }
function team(grp, name) {
  groups[grp] = groups[grp] || {};
  return (groups[grp][name] = groups[grp][name] ||
    { name, grp, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, pts: 0 });
}

for (const r of rows) {
  const a = team(r.grp, r.team_a), b = team(r.grp, r.team_b);
  a.P++; b.P++;
  a.GF += r.score_a; a.GA += r.score_b;
  b.GF += r.score_b; b.GA += r.score_a;
  if (r.score_a > r.score_b) { a.W++; b.L++; a.pts += 3; }
  else if (r.score_a < r.score_b) { b.W++; a.L++; b.pts += 3; }
  else { a.D++; b.D++; a.pts++; b.pts++; }
}
// Head-to-head mini-table among a set of tied teams.
function h2h(tied) {
  const set = new Set(tied.map(t => t.name));
  const mini = {};
  tied.forEach(t => (mini[t.name] = { pts: 0, gf: 0, ga: 0 }));
  for (const r of rows) {
    if (r.grp !== tied[0].grp) continue;
    if (!set.has(r.team_a) || !set.has(r.team_b)) continue;
    const A = mini[r.team_a], B = mini[r.team_b];
    A.gf += r.score_a; A.ga += r.score_b;
    B.gf += r.score_b; B.ga += r.score_a;
    if (r.score_a > r.score_b) A.pts += 3;
    else if (r.score_a < r.score_b) B.pts += 3;
    else { A.pts++; B.pts++; }
  }
  return mini;
}

// Sort one group, resolving ties with overall then head-to-head criteria.
function rankGroup(grp) {
  const teams = Object.values(groups[grp]);
  teams.sort((x, y) => y.pts - x.pts || GD(y) - GD(x) || y.GF - x.GF || 0);
  // Detect blocks tied on overall pts/GD/GF and re-sort each block by H2H.
  const out = [];
  let i = 0;
  while (i < teams.length) {
    let j = i + 1;
    while (j < teams.length &&
      teams[j].pts === teams[i].pts && GD(teams[j]) === GD(teams[i]) && teams[j].GF === teams[i].GF) j++;
    const block = teams.slice(i, j);
    if (block.length > 1) {
      const mini = h2h(block);
      block.sort((x, y) =>
        mini[y.name].pts - mini[x.name].pts ||
        (mini[y.name].gf - mini[y.name].ga) - (mini[x.name].gf - mini[x.name].ga) ||
        mini[y.name].gf - mini[x.name].gf || 0);
      // Flag any pair still identical after H2H (needs fair-play / lots).
      for (let k = 1; k < block.length; k++) {
        const p = block[k - 1], q = block[k];
        if (mini[p.name].pts === mini[q.name].pts &&
            (mini[p.name].gf - mini[p.name].ga) === (mini[q.name].gf - mini[q.name].ga) &&
            mini[p.name].gf === mini[q.name].gf) {
          p.tieFlag = q.tieFlag = true;
        }
      }
    }
    out.push(...block);
    i = j;
  }
  return out;
}

const ordered = {};
for (const g of Object.keys(groups).sort()) ordered[g] = rankGroup(g);

const thirds = Object.keys(ordered).sort().map(g => ordered[g][2]).filter(Boolean);
thirds.sort((x, y) => y.pts - x.pts || GD(y) - GD(x) || y.GF - x.GF || 0);

db.close();
const sortedGroups = Object.keys(ordered).sort();
return {
  complete, expected, played: rows.length,
  ordered, thirds,
  winners: Object.fromEntries(sortedGroups.map(g => [g, ordered[g][0].name])),
  runners: Object.fromEntries(sortedGroups.map(g => [g, ordered[g][1].name])),
  thirdByGroup: Object.fromEntries(sortedGroups.map(g => [g, ordered[g][2] ? ordered[g][2].name : null])),
  qualifiedThirdGroups: thirds.slice(0, 8).map(t => t.grp).sort(),
  anyTie: Object.values(ordered).some(arr => arr.some(t => t.tieFlag)),
};
}

// ---- CLI ----
function printReport(s) {
  const fmt = t => `${String(t.pts).padStart(2)}p  ${String(t.W)}-${t.D}-${t.L}  GF${t.GF} GA${t.GA} GD${(GD(t) >= 0 ? '+' : '') + GD(t)}`;
  if (!s.complete) console.error(`WARNING: ${s.played}/${s.expected} group matches resulted — standings NOT final.`);
  console.log('\n=== FINAL GROUP STANDINGS ===');
  for (const g of Object.keys(s.ordered).sort()) {
    console.log(`\nGroup ${g}:`);
    s.ordered[g].forEach((t, idx) => {
      const pos = idx + 1;
      const mark = pos <= 2 ? '✓' : pos === 3 ? '·' : ' ';
      console.log(`  ${pos}. ${mark} ${t.name.padEnd(16)} ${fmt(t)}${t.tieFlag ? '   <-- TIE: needs fair-play/lots' : ''}`);
    });
  }
  console.log('\n=== THIRD-PLACED TEAMS (ranked) — top 8 advance ===');
  s.thirds.forEach((t, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. ${i < 8 ? 'IN ' : 'OUT'} Group ${t.grp}  ${t.name.padEnd(16)} ${fmt(t)}`);
  });
  console.log('\nWinners (1st):', Object.entries(s.winners).map(([g, n]) => `${g}=${n}`).join('  '));
  console.log('Runners (2nd):', Object.entries(s.runners).map(([g, n]) => `${g}=${n}`).join('  '));
  console.log('Best thirds  :', s.thirds.slice(0, 8).map(t => `${t.grp}:${t.name}`).join('  '));
  console.log('\nNOTE: Round-of-32 slot assignment uses the official FIFA 2026 bracket table');
  console.log('      (winners/runners are fixed by slot; the 8 thirds map by which groups qualified).');
}

module.exports = { computeStandings };

if (require.main === module) {
  const dbPath = process.argv[2] || path.join(__dirname, '..', 'worldcup.db');
  printReport(computeStandings(dbPath));
}
