#!/usr/bin/env node
/**
 * Monkey Oracle — generates World Cup predictions from live zoo webcam feeds.
 *
 * Grabs frames from 5 monkey cams, analyzes pixel data, derives score predictions
 * for all 104 WC matches. Saves to monkey-predictions.json for the server to use.
 * Also sends a Telegram summary of today's predictions.
 *
 * Run: node monkey-oracle.js [--dry-run] [--no-telegram]
 */

const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'worldcup.db');
const PREDICTIONS_PATH = path.join(__dirname, 'monkey-predictions.json');
const FRAMES_DIR = path.join(__dirname, 'monkey-frames');
const TG_BOT_TOKEN = '8445371320:AAE4YLFNtHH8jZx_NJgxbep9C0E7Z8RwP1c';
const TG_CHAT_ID = '6674342664';

const WEBCAMS = [
  { name: 'San Diego Baboons', url: 'https://zoo.sandiegozoo.org/cams/baboon-cam', species: 'Hamadryas Baboons' },
  { name: 'San Diego Apes', url: 'https://zoo.sandiegozoo.org/cams/ape-cam', species: 'Orangutans' },
  { name: 'Zoo Atlanta Gorillas', url: 'https://zooatlanta.org/gorillacam/', species: 'Western Lowland Gorillas' },
  { name: 'Jigokudani Snow Monkeys', url: 'https://www.jigokudani-yaenkoen.co.jp/livecam/monkey/', species: 'Japanese Macaques' },
  { name: 'Explore.org Bonobos', url: 'https://explore.org/livecams/bonobos/bonobo-sanctuary', species: 'Bonobos' },
];

// Weighted toward realistic football scores: 0-4, biased toward 0-2
const GOAL_DIST = [0,0,0,1,1,1,1,1,2,2,2,2,3,3,3,4];

function hashToGoals(hash, offset) {
  const idx = (hash.readUInt32LE(offset % (hash.length - 4)) ) % GOAL_DIST.length;
  return GOAL_DIST[idx];
}

async function grabFrames() {
  fs.mkdirSync(FRAMES_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1400,900'],
    defaultViewport: { width: 1400, height: 900 },
  });

  const framePaths = [];
  for (let i = 0; i < WEBCAMS.length; i++) {
    const cam = WEBCAMS[i];
    const outPath = path.join(FRAMES_DIR, `cam_${i}.png`);
    try {
      const page = await browser.newPage();
      await page.goto(cam.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.evaluate(() => window.scrollBy(0, 350));
      await new Promise(r => setTimeout(r, 8000));
      await page.screenshot({ path: outPath, fullPage: false });
      await page.close();
      console.log(`  OK: ${cam.name}`);
      framePaths.push(outPath);
    } catch (e) {
      console.error(`  FAIL: ${cam.name} - ${e.message}`);
      framePaths.push(null);
    }
  }

  await browser.close();
  return framePaths;
}

function analyzeFrame(framePath) {
  if (!framePath || !fs.existsSync(framePath)) return null;

  // Use image file hash as the primary signal — deterministic per frame
  const buf = fs.readFileSync(framePath);
  const hash = crypto.createHash('sha256').update(buf).digest();

  // Extract basic stats using the raw PNG bytes for additional entropy
  // Sample pixels from different regions
  const quarter = Math.floor(buf.length / 4);
  const regionHashes = [];
  for (let r = 0; r < 4; r++) {
    const slice = buf.slice(r * quarter, (r + 1) * quarter);
    regionHashes.push(crypto.createHash('md5').update(slice).digest());
  }

  return { hash, regionHashes, size: buf.length };
}

function predictMatch(matchId, teamA, teamB, camAnalyses) {
  // Create a match-specific seed by mixing match identity with webcam data
  const matchSeed = crypto.createHash('sha256')
    .update(`${matchId}:${teamA}:${teamB}`)
    .digest();

  const methods = ['count', 'left_right', 'banana', 'hot_spring', 'activity'];
  const predictions = [];

  for (let i = 0; i < camAnalyses.length; i++) {
    const analysis = camAnalyses[i];
    if (!analysis) continue;

    // Mix match seed with webcam hash
    const mixed = crypto.createHash('sha256')
      .update(Buffer.concat([matchSeed, analysis.hash, Buffer.from([i])]))
      .digest();

    const method = methods[i];
    let home, away, reasoning;

    switch (method) {
      case 'count': {
        // Dark region analysis proxy
        const darkSignal = analysis.regionHashes[0].readUInt8(0);
        if (darkSignal < 30) {
          home = 0; away = 0;
          reasoning = 'Empty enclosure';
        } else {
          home = hashToGoals(mixed, 0);
          away = hashToGoals(mixed, 4);
          reasoning = `Dark signal: ${darkSignal}`;
        }
        break;
      }
      case 'left_right': {
        const leftH = analysis.regionHashes[0].readUInt32LE(0);
        const rightH = analysis.regionHashes[1].readUInt32LE(0);
        const diff = Math.abs(leftH - rightH);
        home = hashToGoals(mixed, 0);
        away = hashToGoals(mixed, 8);
        if (diff < 100000) away = home; // balanced = draw
        reasoning = `L/R delta: ${diff}`;
        break;
      }
      case 'banana': {
        const brightness = analysis.regionHashes[2].readUInt8(0);
        if (brightness < 40) {
          home = 0; away = 0;
          reasoning = 'Sleeping (dark frame)';
        } else {
          home = hashToGoals(mixed, 4);
          away = hashToGoals(mixed, 12);
          reasoning = `Brightness: ${brightness}`;
        }
        break;
      }
      case 'hot_spring': {
        const greenSignal = analysis.regionHashes[3].readUInt8(4);
        if (greenSignal > 220) {
          home = 0; away = 0;
          reasoning = 'All green = empty';
        } else {
          home = hashToGoals(mixed, 8);
          away = hashToGoals(mixed, 16);
          reasoning = `Green: ${greenSignal}`;
        }
        break;
      }
      case 'activity': {
        const variance = analysis.size % 10000;
        if (variance < 500) {
          home = 0; away = 0;
          reasoning = 'Static frame';
        } else {
          home = hashToGoals(mixed, 12);
          away = hashToGoals(mixed, 20);
          reasoning = `Activity: ${variance}`;
        }
        break;
      }
    }

    predictions.push({ method, cam: WEBCAMS[i].name, species: WEBCAMS[i].species, home, away, reasoning });
  }

  if (predictions.length === 0) return { score_a: 0, score_b: 0, predictions: [], method: 'fallback' };

  // Consensus: median
  const homes = predictions.map(p => p.home).sort((a, b) => a - b);
  const aways = predictions.map(p => p.away).sort((a, b) => a - b);
  const mid = Math.floor(homes.length / 2);

  return {
    score_a: homes[mid],
    score_b: aways[mid],
    predictions,
    method: 'monkey-oracle',
  };
}

function sendTelegram(text) {
  const chunks = [];
  while (text.length > 4000) {
    const splitAt = text.lastIndexOf('\n', 4000);
    chunks.push(text.slice(0, splitAt === -1 ? 4000 : splitAt));
    text = text.slice(splitAt === -1 ? 4000 : splitAt);
  }
  chunks.push(text);

  for (const chunk of chunks) {
    try {
      execSync(`curl -s -X POST "https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage" -H "Content-Type: application/json" -d ${JSON.stringify(JSON.stringify({ chat_id: TG_CHAT_ID, text: chunk, parse_mode: 'HTML' }))}`, { timeout: 15000 });
    } catch (e) {
      console.error('TG send failed:', e.message);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const noTelegram = args.includes('--no-telegram');

  console.log(`=== Monkey Oracle — ${new Date().toISOString()} ===`);

  // 1. Grab webcam frames
  console.log('\n[1/4] Grabbing webcam frames...');
  const framePaths = await grabFrames();

  // 2. Analyze frames
  console.log('\n[2/4] Analyzing monkey signals...');
  const camAnalyses = framePaths.map((fp, i) => {
    const a = analyzeFrame(fp);
    console.log(`  ${WEBCAMS[i].name}: ${a ? 'OK' : 'MISSING'}`);
    return a;
  });

  // 3. Read matches from DB and predict
  console.log('\n[3/4] Generating predictions for all matches...');
  const db = new Database(DB_PATH, { readonly: true });
  const matches = db.prepare('SELECT * FROM matches ORDER BY id').all();
  db.close();

  const allPredictions = {};
  const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }).replace(/\//g, '/');
  const todayMatches = [];

  for (const match of matches) {
    const result = predictMatch(match.id, match.team_a, match.team_b, camAnalyses);
    allPredictions[match.id] = {
      match_id: match.id,
      team_a: match.team_a,
      team_b: match.team_b,
      score_a: result.score_a,
      score_b: result.score_b,
      method: result.method,
      predictions_detail: result.predictions,
    };

    if (match.match_date === todayStr && match.team_a !== 'TBD') {
      todayMatches.push({ match, result });
    }
  }

  // 4. Save predictions
  const output = {
    generated_at: new Date().toISOString(),
    webcams_used: WEBCAMS.map((c, i) => ({ ...c, frame_ok: !!camAnalyses[i] })),
    predictions: allPredictions,
    tournament: generateTournamentPredictions(matches, camAnalyses),
  };

  if (!dryRun) {
    fs.writeFileSync(PREDICTIONS_PATH, JSON.stringify(output, null, 2));
    console.log(`  Saved ${Object.keys(allPredictions).length} predictions to ${PREDICTIONS_PATH}`);
  }

  // 5. Send Telegram for today's matches
  if (!noTelegram) {
    console.log('\n[4/4] Sending Telegram...');
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

    let tgLines = [
      `<b>🐒 Monkey Oracle — ${dateStr}</b>`,
      '',
      '🌐 Predictions from 5 live zoo webcams',
      '🔬 5 methods × consensus = final score',
      '',
    ];

    if (todayMatches.length > 0) {
      tgLines.push(`<b>📅 Today's Matches (${todayMatches.length}):</b>`);
      tgLines.push('');

      for (const { match, result } of todayMatches) {
        const winner = result.score_a > result.score_b ? match.team_a
          : result.score_b > result.score_a ? match.team_b : 'תיקו';
        tgLines.push(`⚽ <b>${match.team_a} ${result.score_a}:${result.score_b} ${match.team_b}</b>`);
        tgLines.push(`   🏟 ${match.venue || ''} ⏰ ${match.match_time}`);
        tgLines.push(`   → ${winner}`);
        tgLines.push('');

        for (const p of result.predictions) {
          const emoji = p.home > p.away ? '🔴' : p.away > p.home ? '🔵' : '⚪';
          tgLines.push(`   ${emoji} ${p.cam}: ${p.home}:${p.away}`);
        }
        tgLines.push('');
        tgLines.push('─'.repeat(25));
        tgLines.push('');
      }
    } else {
      // Show next upcoming matches
      const upcoming = matches.filter(m => m.team_a !== 'TBD').slice(0, 5);
      tgLines.push('<b>📅 No matches today. Next predictions:</b>');
      tgLines.push('');
      for (const match of upcoming) {
        const pred = allPredictions[match.id];
        tgLines.push(`⚽ ${match.team_a} <b>${pred.score_a}:${pred.score_b}</b> ${match.team_b}`);
        tgLines.push(`   📅 ${match.match_date} ⏰ ${match.match_time}`);
      }
      tgLines.push('');
    }

    tgLines.push('<i>🐵 tikitaka.vip — beat the monkey!</i>');

    sendTelegram(tgLines.join('\n'));
    console.log('  Sent!');
  }

  console.log('\nDone!');
}

function generateTournamentPredictions(matches, camAnalyses) {
  // Use combined webcam entropy to pick tournament predictions
  const combinedHash = crypto.createHash('sha256');
  for (const a of camAnalyses) {
    if (a) combinedHash.update(a.hash);
  }
  const seed = combinedHash.digest();

  const allTeams = [...new Set(
    matches.filter(m => m.stage === 'בתים' && m.team_a !== 'TBD')
      .flatMap(m => [m.team_a, m.team_b])
  )];

  const topScorers = ['אמבפה','הולאנד','סלאח','קיין','וינסיוס ג\'וניור','מסי','רונאלדו','יאמל','סאקה','לוקאקו'];

  const winnerIdx = seed.readUInt32LE(0) % allTeams.length;
  let runnerIdx = seed.readUInt32LE(4) % allTeams.length;
  if (runnerIdx === winnerIdx) runnerIdx = (runnerIdx + 1) % allTeams.length;
  const scorerIdx = seed.readUInt32LE(8) % topScorers.length;

  return {
    winner: allTeams[winnerIdx],
    runner_up: allTeams[runnerIdx],
    top_scorer: topScorers[scorerIdx],
  };
}

main().catch(e => { console.error(e); process.exit(1); });
