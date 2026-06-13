#!/usr/bin/env node

/**
 * Folkd Registration and Bookmark Script
 *
 * Status: SITE PIVOTED - No longer a bookmarking site
 *
 * Investigation (2026-06-03):
 * folkd.com was originally a social bookmarking/URL sharing platform (founded 2006).
 * As of 2026, the domain has been completely repurposed as a dating site:
 *   "Looking for love? Or just a hot date tonight?"
 *
 * The registration wizard (members.folkd.com/s/register/) asks for gender/age/dating
 * preferences — there is no URL submission, bookmarking, or link-sharing functionality.
 *
 * Conclusion: Cannot bookmark tikitaka.vip here. Site has no bookmarking features.
 *
 * Credentials (unused):
 * - Email: tikitaka.vip@aiemailservice.com
 * - Password: TK!v1p_2026WC#secure
 * - Username: tikitaka_vip
 * - Display Name: Tiki Taka
 */

const puppeteer = require('puppeteer-core');
const https = require('https');
const { execSync } = require('child_process');

const CONFIG = {
  siteUrl: 'https://www.folkd.com',
  status: 'site_pivoted',
  note: 'folkd.com is now a dating site, not a bookmarking platform. No URL submission available.',
  bookmarkUrl: 'https://tikitaka.vip',
  bookmarkTitle: 'TikiTaka - World Cup 2026 Prediction Game',
  bookmarkDesc: 'Predict all 104 World Cup matches. Make groups with friends. Beat a monkey that watches real zoo webcams.',
  bookmarkTags: 'world-cup football soccer predictions sports game',
};

async function checkFolkd() {
  let browser;
  try {
    console.log('=== Folkd Script ===\n');
    console.log('NOTE: folkd.com has pivoted to a dating site.');
    console.log('Original social bookmarking functionality no longer exists.');
    console.log('No registration or bookmarking is possible.\n');

    browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
    const pages = await browser.pages();
    const page = pages[0];

    await page.goto(CONFIG.siteUrl, { waitUntil: 'networkidle2', timeout: 20000 });
    await page.bringToFront();
    await new Promise(r => setTimeout(r, 2000));

    const info = await page.evaluate(() => ({
      title: document.title,
      url: window.location.href,
      bodyText: document.body.innerText.substring(0, 300),
    }));

    console.log('Site info:', JSON.stringify(info, null, 2));

    await page.screenshot({ path: '/tmp/folkd_check.png' });
    try { execSync('python3 /home/ubuntu/.claude/hooks/resize-images.py /tmp/folkd_check.png --max-dim 1800'); } catch(e) {}

    await browser.disconnect();
    return { status: 'site_pivoted', config: CONFIG };

  } catch (err) {
    console.error('ERROR:', err.message);
    if (browser) { try { await browser.disconnect(); } catch(e) {} }
    return { status: 'error', error: err.message };
  }
}

checkFolkd().then(result => {
  console.log('\n=== RESULT ===');
  console.log(JSON.stringify(result, null, 2));
}).catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
