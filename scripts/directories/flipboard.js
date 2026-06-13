#!/usr/bin/env node
/**
 * Flipboard registration and magazine creation script for TikiTaka
 *
 * Status: Account registered, profile set up (avatar, bio with tikitaka.vip link).
 *         Email verification NOT completed (verification email not arriving to aiemailservice.com).
 *         Magazine creation BLOCKED until email is verified.
 *
 * Profile URL: https://flipboard.com/@tikitaka_vip
 *
 * To complete setup after email verification:
 *   1. Verify email (click link in Flipboard verification email)
 *   2. Create magazine "World Cup 2026 Predictions"
 *   3. Flip tikitaka.vip content into the magazine
 */

const puppeteer = require('puppeteer-core');

const CONFIG = {
  email: 'tikitaka.vip@aiemailservice.com',
  password: 'TK!v1p_2026WC#secure',
  username: 'tikitaka_vip',
  name: 'Tiki Taka',
  bio: 'Free World Cup 2026 prediction game. Compete against a monkey that watches real zoo webcams to make its picks. Play now at https://tikitaka.vip',
  avatarPath: '/home/ubuntu/projects/worldcup/brand/profile-pic.png',
  magazineTitle: 'World Cup 2026 Predictions',
  magazineDescription: 'World Cup 2026 match predictions, previews, and the best prediction game on the web. Play free at tikitaka.vip!',
  profileUrl: 'https://flipboard.com/@tikitaka_vip',
};

async function cdpType(client, page, sel, text) {
  await page.evaluate(s => {
    const el = document.querySelector(s);
    if (el) { el.focus(); el.click(); el.value = ''; }
  }, sel);
  await new Promise(r => setTimeout(r, 80));
  for (const c of text) {
    await client.send('Input.dispatchKeyEvent', { type: 'keyDown', text: c });
    await client.send('Input.dispatchKeyEvent', { type: 'keyUp', text: c });
    await new Promise(r => setTimeout(r, 5));
  }
}

async function login(page, client) {
  await page.goto('https://flipboard.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  await cdpType(client, page, 'input[name="email"]', CONFIG.email);
  await cdpType(client, page, 'input[name="password"]', CONFIG.password);
  await new Promise(r => setTimeout(r, 500));

  await page.evaluate(() => {
    const btns = document.querySelectorAll('button[type="submit"]');
    for (const b of btns) {
      if (b.textContent.includes('Log in') || b.type === 'submit') {
        b.click();
        return;
      }
    }
  });

  await new Promise(r => setTimeout(r, 5000));
  console.log('Logged in. URL:', page.url());
}

async function createMagazine(page, client) {
  // Click "Create a Flip" to open the magazine picker
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) {
      if (b.textContent.includes('Create a Flip')) { b.click(); return; }
    }
  });
  await new Promise(r => setTimeout(r, 3000));

  // Click "NEW MAGAZINE" button
  await page.click('button[data-vars-button-name="flip-compose-create-magazine"]');
  await new Promise(r => setTimeout(r, 2000));

  // Fill title
  await cdpType(client, page, 'textarea[name="title"]', CONFIG.magazineTitle);
  await new Promise(r => setTimeout(r, 300));

  // Fill description
  await cdpType(client, page, 'textarea[name="description"]', CONFIG.magazineDescription);
  await new Promise(r => setTimeout(r, 300));

  // Click Create
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) {
      if (b.textContent.trim() === 'Create' && b.className.includes('primary')) {
        b.click();
        return;
      }
    }
  });
  await new Promise(r => setTimeout(r, 5000));
  console.log('Magazine created');
}

async function flipUrl(page, client, url) {
  // Navigate to the flip compose with URL
  await page.goto(`https://flipboard.com/compose?url=${encodeURIComponent(url)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await new Promise(r => setTimeout(r, 5000));
  console.log('Flipped URL:', url);
}

async function main() {
  const browser = await puppeteer.connect({
    browserURL: 'http://localhost:9222',
    defaultViewport: null,
  });
  const pages = await browser.pages();
  const page = pages[0];
  const client = await page.createCDPSession();

  try {
    await login(page, client);
    await createMagazine(page, client);
    await flipUrl(page, client, 'https://tikitaka.vip');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.detach();
    await browser.disconnect();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { CONFIG, login, createMagazine, flipUrl };
