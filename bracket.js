'use strict';
// Official FIFA 2026 knockout bracket resolver.
// Computes group standings from entered results, picks the 8 best third-placed
// teams, applies FIFA's published Round-of-32 template + third-place allocation
// table (Annex C), then propagates winners through R16 -> Final.
//
// Match ids in the `matches` table line up 1:1 with the official match numbers:
//   R32 = 73..88, R16 = 89..96, QF = 97..100, SF = 101..102, 3rd = 103, Final = 104.

const THIRD_PLACE_TABLE = require('./thirdplace-table.json'); // key: sorted 8 group letters -> { assign: {1A:'E',...} }

// Round of 32: official slot template (matchId -> [sourceA, sourceB]).
// Tokens: '1X'/'2X' = winner/runner-up of group X; '3@1X' = the third-placed
// team allocated to group-winner X's slot (resolved via THIRD_PLACE_TABLE).
const R32 = {
  73: ['2B', '2A'],
  74: ['1E', '3@1E'],
  75: ['1F', '2C'],
  76: ['1C', '2F'],
  77: ['1I', '3@1I'],
  78: ['2E', '2I'],
  79: ['1A', '3@1A'],
  80: ['1L', '3@1L'],
  81: ['1D', '3@1D'],
  82: ['1G', '3@1G'],
  83: ['2K', '2L'],
  84: ['1H', '2J'],
  85: ['1B', '3@1B'],
  86: ['1J', '2H'],
  87: ['1K', '3@1K'],
  88: ['2D', '2G'],
};

// Later rounds: tokens 'W<id>' / 'L<id>' = winner / loser of an earlier match.
const LATER = {
  89: ['W74', 'W77'],
  90: ['W73', 'W75'],
  91: ['W76', 'W78'],
  92: ['W79', 'W80'],
  93: ['W83', 'W84'],
  94: ['W81', 'W82'],
  95: ['W86', 'W88'],
  96: ['W85', 'W87'],
  97: ['W89', 'W90'],
  98: ['W93', 'W94'],
  99: ['W91', 'W92'],
  100: ['W95', 'W96'],
  101: ['W97', 'W98'],
  102: ['W99', 'W100'],
  103: ['L101', 'L102'],
  104: ['W101', 'W102'],
};

const GROUP_STAGE = 'בתים';
const TBD = 'TBD';

// Build win/draw/loss records for one group's four teams.
function groupStandings(groupMatches) {
  const teams = {};
  const ensure = (name) => (teams[name] = teams[name] || { team: name, pts: 0, gf: 0, ga: 0, played: 0 });
  for (const m of groupMatches) {
    const a = ensure(m.team_a), b = ensure(m.team_b);
    if (!m.result) continue;
    const sa = m.result.score_a, sb = m.result.score_b;
    a.gf += sa; a.ga += sb; b.gf += sb; b.ga += sa; a.played++; b.played++;
    if (sa > sb) a.pts += 3; else if (sa < sb) b.pts += 3; else { a.pts++; b.pts++; }
  }
  for (const t of Object.values(teams)) t.gd = t.gf - t.ga;

  // Head-to-head mini-league among a tied subset.
  const h2h = (subset) => {
    const names = new Set(subset.map(t => t.team));
    const mini = {};
    subset.forEach(t => mini[t.team] = { pts: 0, gd: 0, gf: 0 });
    for (const m of groupMatches) {
      if (!m.result || !names.has(m.team_a) || !names.has(m.team_b)) continue;
      const sa = m.result.score_a, sb = m.result.score_b;
      mini[m.team_a].gf += sa; mini[m.team_b].gf += sb;
      mini[m.team_a].gd += sa - sb; mini[m.team_b].gd += sb - sa;
      if (sa > sb) mini[m.team_a].pts += 3; else if (sa < sb) mini[m.team_b].pts += 3;
      else { mini[m.team_a].pts++; mini[m.team_b].pts++; }
    }
    return mini;
  };

  const cmp = (x, y) => {
    if (y.pts !== x.pts) return y.pts - x.pts;
    if (y.gd !== x.gd) return y.gd - x.gd;
    if (y.gf !== x.gf) return y.gf - x.gf;
    // tie on overall points/GD/GF -> head-to-head among everyone sharing this triple
    return 0;
  };

  let sorted = Object.values(teams).sort(cmp);
  // Apply head-to-head within blocks that remain tied on (pts,gd,gf).
  const out = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && cmp(sorted[i], sorted[j + 1]) === 0) j++;
    const block = sorted.slice(i, j + 1);
    if (block.length > 1) {
      const mini = h2h(block);
      block.sort((x, y) => {
        const mx = mini[x.team], my = mini[y.team];
        if (my.pts !== mx.pts) return my.pts - mx.pts;
        if (my.gd !== mx.gd) return my.gd - mx.gd;
        if (my.gf !== mx.gf) return my.gf - mx.gf;
        return x.team.localeCompare(y.team); // deterministic fallback (real WC: drawing of lots)
      });
    }
    out.push(...block);
    i = j + 1;
  }
  return out;
}

// Compute everything needed to place knockout teams.
function computeStandings(matchArray) {
  const groups = {};
  for (const m of matchArray) {
    if (m.stage !== GROUP_STAGE || !m.group_name) continue;
    (groups[m.group_name] = groups[m.group_name] || []).push(m);
  }
  const groupLetters = Object.keys(groups).sort();
  const pos = {};        // '1A','2A','3A' -> team name
  const thirds = [];     // {group, team, pts, gd, gf}
  let complete = true;

  for (const g of groupLetters) {
    const gm = groups[g];
    const allPlayed = gm.length > 0 && gm.every(m => m.result);
    if (!allPlayed) complete = false;
    const table = groupStandings(gm);
    if (table[0]) pos['1' + g] = table[0].team;
    if (table[1]) pos['2' + g] = table[1].team;
    if (table[2]) { pos['3' + g] = table[2].team; thirds.push({ group: g, team: table[2].team, pts: table[2].pts, gd: table[2].gd, gf: table[2].gf }); }
  }

  // Rank third-placed teams (points, GD, GF; deterministic fallback).
  thirds.sort((x, y) => (y.pts - x.pts) || (y.gd - x.gd) || (y.gf - x.gf) || x.group.localeCompare(y.group));
  const qualifyingThirdGroups = thirds.slice(0, 8).map(t => t.group).sort();

  return { complete, pos, thirds, qualifyingThirdGroups, groupCount: groupLetters.length };
}

// Resolve a slot token to a concrete team name, or null if not yet known.
function makeResolver(standings, winners, losers, thirdAssign) {
  return function resolve(token) {
    if (token[0] === '1' || token[0] === '2') return standings.pos[token] || null;
    if (token.startsWith('3@')) {
      const slot = token.slice(2);          // e.g. '1E'
      const grp = thirdAssign[slot];        // group letter of the allocated third
      return grp ? (standings.pos['3' + grp] || null) : null;
    }
    if (token[0] === 'W') return winners[token.slice(1)] || null;
    if (token[0] === 'L') return losers[token.slice(1)] || null;
    return null;
  };
}

// Core: given the full match array, return the desired team_a/team_b for every
// knockout match id (only where determinable). Pure — no DB writes.
function computeBracket(matchArray) {
  const standings = computeStandings(matchArray);

  // Third-place allocation table lookup (needs the full group stage done).
  let thirdAssign = {};
  if (standings.complete && standings.qualifyingThirdGroups.length === 8) {
    const key = standings.qualifyingThirdGroups.join('');
    const entry = THIRD_PLACE_TABLE[key];
    if (entry) thirdAssign = entry.assign; // {'1A':'E',...}
  }

  // Winners/losers of already-decided knockout matches.
  const byId = {};
  for (const m of matchArray) byId[m.id] = m;
  const winners = {}, losers = {};
  for (const m of matchArray) {
    if (m.stage === GROUP_STAGE || !m.result) continue;
    if (m.team_a === TBD || m.team_b === TBD) continue;
    const { score_a: sa, score_b: sb, pens_a: pa, pens_b: pb } = m.result;
    let aWon;
    if (sa !== sb) aWon = sa > sb;
    else if (pa != null && pb != null && pa !== pb) aWon = pa > pb; // shootout decider
    else continue; // tied, no shootout data stored -> undecided
    winners[m.id] = aWon ? m.team_a : m.team_b;
    losers[m.id] = aWon ? m.team_b : m.team_a;
  }

  const resolve = makeResolver(standings, winners, losers, thirdAssign);
  const desired = {}; // matchId -> {team_a, team_b}
  for (const [id, [ta, tb]] of [...Object.entries(R32), ...Object.entries(LATER)]) {
    const a = resolve(ta), b = resolve(tb);
    if (a && b) desired[id] = { team_a: a, team_b: b };
  }
  return { desired, standings };
}

// Apply to a live better-sqlite3 db. Returns a summary of what changed.
// opts.computeDefaultOdds(teamA, teamB) -> {odds_a,odds_draw,odds_b}: if given,
// seed strength-based default odds (INSERT OR IGNORE) for each newly-filled
// match, mirroring the manual /update-teams endpoint so a knockout match scored
// before the daily odds fetch still gets a real multiplier instead of flat 1.0.
function resolveBracket(db, opts = {}) {
  const matches = db.prepare('SELECT * FROM matches').all();
  const results = db.prepare('SELECT * FROM match_results').all();
  const rmap = {};
  results.forEach(r => rmap[r.match_id] = { score_a: r.score_a, score_b: r.score_b, pens_a: r.pens_a, pens_b: r.pens_b });
  const arr = matches.map(m => ({ ...m, result: rmap[m.id] || null }));

  const { desired, standings } = computeBracket(arr);
  const upd = db.prepare('UPDATE matches SET team_a = ?, team_b = ? WHERE id = ?');
  const oddsStmt = db.prepare('INSERT OR IGNORE INTO match_odds (match_id, odds_a, odds_draw, odds_b) VALUES (?, ?, ?, ?)');
  const cur = {};
  matches.forEach(m => cur[m.id] = m);
  let changed = 0;
  const changes = [];
  const tx = db.transaction(() => {
    for (const [id, d] of Object.entries(desired)) {
      const m = cur[id];
      if (!m) continue;
      if (m.team_a === d.team_a && m.team_b === d.team_b) continue;
      upd.run(d.team_a, d.team_b, id);
      if (typeof opts.computeDefaultOdds === 'function') {
        const o = opts.computeDefaultOdds(d.team_a, d.team_b);
        if (o) oddsStmt.run(+id, o.odds_a, o.odds_draw, o.odds_b);
      }
      changed++;
      changes.push({ id: +id, from: `${m.team_a} / ${m.team_b}`, to: `${d.team_a} / ${d.team_b}` });
    }
  });
  tx();
  return { changed, changes, complete: standings.complete, qualifyingThirds: standings.qualifyingThirdGroups };
}

module.exports = { resolveBracket, computeBracket, computeStandings, R32, LATER };
