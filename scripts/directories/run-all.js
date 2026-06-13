#!/usr/bin/env node
// Master runner for directory submissions
//
// Runs each directory script in sequence.
// Auto scripts run fully, manual ones print instructions.
//
// Prerequisites:
//   - Chrome running with --remote-debugging-port=9222
//   - npm install puppeteer-core (in /tmp or globally)
//   - GitHub logged in (for PitchWall)
//
// Run: node run-all.js [--auto-only] [--manual-only] [--list]

const { execSync } = require('child_process');
const path = require('path');

const DIRECTORIES = [
  { name: 'StoreBoard',    script: 'storeboard.js',    auto: true,  da: 61, notes: 'Fully automated' },
  { name: 'BrownBook',     script: 'brownbook.js',     auto: false, da: 61, notes: 'Country dropdown needs manual click' },
  { name: 'BetaList',      script: 'betalist.js',      auto: false, da: 55, notes: 'Signup auto, submission manual' },
  { name: 'PitchWall',     script: 'pitchwall.js',     auto: false, da: 45, notes: 'GitHub auth, tags broken' },
  { name: 'StartupBuffer', script: 'startupbuffer.js', auto: false, da: 40, notes: 'Step 1 auto, steps 2-3 manual' },
  { name: 'LaunchingNext',  script: 'launchingnext.js', auto: false, da: 38, notes: 'Fully manual (prints copy to paste)' },
  { name: 'Crunchbase',    script: 'crunchbase.js',    auto: false, da: 91, notes: 'Cloudflare blocks — fully manual' },
];

const args = process.argv.slice(2);
const autoOnly = args.includes('--auto-only');
const manualOnly = args.includes('--manual-only');
const listOnly = args.includes('--list');

if (listOnly) {
  console.log('Directory submissions:\n');
  console.log('  Name             DA   Auto   Notes');
  console.log('  ' + '-'.repeat(60));
  DIRECTORIES.forEach(d => {
    const auto = d.auto ? '✅' : '🖐';
    console.log(`  ${d.name.padEnd(17)} ${String(d.da).padEnd(5)} ${auto}    ${d.notes}`);
  });
  process.exit(0);
}

console.log('=== Directory Submission Runner ===\n');

for (const d of DIRECTORIES) {
  if (autoOnly && !d.auto) continue;
  if (manualOnly && d.auto) continue;

  console.log(`\n${'='.repeat(50)}`);
  console.log(`${d.auto ? '🤖' : '🖐'}  ${d.name} (DA ${d.da}) — ${d.notes}`);
  console.log('='.repeat(50));

  try {
    const scriptPath = path.join(__dirname, d.script);
    execSync(`node ${scriptPath}`, { stdio: 'inherit', timeout: 120000 });
  } catch (e) {
    console.error(`❌ ${d.name} failed: ${e.message.substring(0, 80)}`);
  }
}

console.log('\n=== Done ===');
