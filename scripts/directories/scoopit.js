#!/usr/bin/env node

/**
 * Scoop.it Registration and Topic Creation Script
 * Creates account and topic page with backlink to tikitaka.vip
 *
 * Status: BLOCKED ON hCAPTCHA (requires manual human solving)
 *
 * Credentials:
 * - Email: tikitaka.vip@aiemailservice.com
 * - Password: TK!v1p_2026WC#secure
 * - Username: tikitakavip
 * - Display Name: Tiki Taka
 *
 * Manual Steps Required:
 * 1. Navigate to https://www.scoop.it/subscribe
 * 2. Fill in form with above credentials
 * 3. Select "Read content" for "I will use Scoop.it for"
 * 4. Click on "I am human" checkbox to open hCaptcha challenge
 * 5. Solve the CAPTCHA puzzle
 * 6. Click "Sign Up"
 * 7. Check email at tikitaka.vip@aiemailservice.com for verification link
 * 8. Click verification link to confirm account
 * 9. Create topic "World Cup 2026 Predictions"
 * 10. Add tikitaka.vip content with description:
 *     "Predict all 104 World Cup matches. Create groups with friends.
 *      Try to beat a monkey that watches real zoo webcams to make its picks."
 * 11. Update profile bio to mention tikitaka.vip
 */

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const https = require('https');

// Configuration
const CONFIG = {
  email: 'tikitaka.vip@aiemailservice.com',
  password: 'TK!v1p_2026WC#secure',
  username: 'tikitakavip',
  displayName: 'Tiki Taka',
  useCase: 'Read content',
  profileUrl: '',
  topicUrl: '',
  topicName: 'World Cup 2026 Predictions',
  contentUrl: 'https://tikitaka.vip',
  contentDescription: 'Predict all 104 World Cup matches. Create groups with friends. Try to beat a monkey that watches real zoo webcams to make its picks.',
};

// CDP typing helper
async function cdpType(client, page, selector, text) {
  console.log(`    Typing in ${selector}`);
  await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (el) {
      el.focus();
      el.value = '';
    }
  }, selector);

  await new Promise(r => setTimeout(r, 100));

  for (const c of text) {
    await client.send('Input.dispatchKeyEvent', { type: 'keyDown', text: c });
    await client.send('Input.dispatchKeyEvent', { type: 'keyUp', text: c });
    await new Promise(r => setTimeout(r, 10));
  }

  await new Promise(r => setTimeout(r, 200));
}

// Send Telegram notification
function sendTelegramAlert(message) {
  const encoded = encodeURIComponent(message);
  const botToken = '8445371320:AAE4YLFNtHH8jZx_NJgxbep9C0E7Z8RwP1c';
  const chatId = '6674342664';
  const url = `https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${encoded}`;

  return new Promise((resolve) => {
    https.get(url, (res) => {
      console.log(`Telegram notification sent (status: ${res.statusCode})`);
      resolve(true);
    }).on('error', (err) => {
      console.log('Telegram error:', err.message);
      resolve(false);
    });
  });
}

// Main registration flow
async function registerOnScoopIt() {
  let browser;
  try {
    console.log('=== Scoop.it Registration Script ===\n');

    console.log('Connecting to Chrome...');
    browser = await puppeteer.connect({
      browserURL: 'http://localhost:9222',
      defaultViewport: null
    });

    const pages = await browser.pages();
    for (let i = 1; i < pages.length; i++) {
      try {
        await pages[i].close();
      } catch (e) {}
    }

    const page = pages[0];
    const client = await page.target().createCDPSession();

    console.log('Setting viewport...');
    await page.setViewport({ width: 1400, height: 900 });

    console.log('\n1. Navigating to Scoop.it subscription page...');
    await page.goto('https://www.scoop.it/subscribe', {
      timeout: 20000,
      waitUntil: 'load'
    }).catch(() => {});

    await new Promise(r => setTimeout(r, 2000));

    console.log('2. Filling registration form...');
    console.log(`   - Display Name: ${CONFIG.displayName}`);
    await cdpType(client, page, 'input[name="displayName"]', CONFIG.displayName);

    console.log(`   - Username: ${CONFIG.username}`);
    await cdpType(client, page, 'input[name="shortName"]', CONFIG.username);

    console.log(`   - Email: ${CONFIG.email}`);
    await cdpType(client, page, 'input[name="email"]', CONFIG.email);

    console.log(`   - Password: (hidden)`);
    await cdpType(client, page, 'input[name="password"]', CONFIG.password);

    console.log('3. Selecting use case...');
    await page.evaluate(() => {
      const select = document.querySelector('select');
      if (select && select.options.length > 1) {
        select.value = select.options[1].value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    console.log('4. Taking screenshot before CAPTCHA...');
    let ss = await page.screenshot();
    fs.writeFileSync('/home/ubuntu/Pictures/Screenshots/scoopit_ready_for_captcha.png', ss);

    console.log('\n⚠️  CAPTCHA REQUIRED ⚠️');
    console.log('This script cannot automatically solve hCaptcha.');
    console.log('The form is filled and ready. You must manually:');
    console.log('  1. Click on "I am human" checkbox');
    console.log('  2. Solve the CAPTCHA puzzle');
    console.log('  3. Click "Sign Up"');
    console.log('  4. Verify your email');

    console.log('\nSending Telegram alert...');
    const msg = `CAPTCHA REQUIRED on Scoop.it\n\nForm filled with:\n- Name: ${CONFIG.displayName}\n- Email: ${CONFIG.email}\n- Username: ${CONFIG.username}\n\nURL: https://www.scoop.it/subscribe\n\nPlease solve manually and proceed with topic creation.`;
    await sendTelegramAlert(msg);

    console.log('\n5. Waiting for manual CAPTCHA completion...');
    console.log('   (Script paused - awaiting manual intervention)');

    await client.detach();
    await browser.disconnect();

    return {
      status: 'awaiting_captcha',
      message: 'Form filled, CAPTCHA requires manual solving',
      credentials: CONFIG
    };

  } catch (err) {
    console.error('ERROR:', err.message);
    if (browser) await browser.disconnect();
    return {
      status: 'error',
      error: err.message
    };
  }
}

// Topic creation flow (runs after email verification)
async function createTopic() {
  let browser;
  try {
    console.log('\n=== Creating Scoop.it Topic ===\n');

    browser = await puppeteer.connect({
      browserURL: 'http://localhost:9222',
      defaultViewport: null
    });

    const pages = await browser.pages();
    const page = pages[0];

    // This would be the next step after account verification
    // 1. Log in
    // 2. Navigate to create new topic
    // 3. Fill topic details
    // 4. Add tikitaka.vip content
    // 5. Publish

    console.log('⏳ Placeholder for topic creation');
    console.log('   (Run after account verification)');

    await browser.disconnect();

  } catch (err) {
    console.error('ERROR:', err.message);
  }
}

// Main execution
async function main() {
  const result = await registerOnScoopIt();

  console.log('\n=== Result ===');
  console.log(JSON.stringify(result, null, 2));

  if (result.status === 'success') {
    await createTopic();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
