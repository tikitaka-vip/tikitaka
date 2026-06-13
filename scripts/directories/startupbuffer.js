#!/usr/bin/env node
// StartupBuffer.com — startup promotion directory
//
// What works:  step 1 fields (name, url, email) via page.type()
// What breaks: multi-step wizard transitions, logo upload (requires file picker)
// Result:      step 1 auto-filled, steps 2-3 need manual completion
//
// Run: node startupbuffer.js

const { PRODUCT, IDENTITY, connectBrowser } = require('./config');

(async () => {
  const browser = await connectBrowser();
  const page = await browser.newPage();

  console.log('Opening StartupBuffer submit...');
  await page.goto('https://startupbuffer.com/site/submit', { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));

  // Step 1: Basic Info (name, url, email)
  const step1 = await page.evaluate(() => !!document.querySelector('input[name=name]'));
  if (step1) {
    await page.focus('input[name=name]');
    await page.evaluate(() => document.querySelector('input[name=name]').value = '');
    await page.type('input[name=name]', PRODUCT.name, { delay: 10 });

    await page.focus('input[name=url]');
    await page.evaluate(() => document.querySelector('input[name=url]').value = '');
    await page.type('input[name=url]', PRODUCT.url, { delay: 10 });

    await page.focus('input[name=email]');
    await page.evaluate(() => document.querySelector('input[name=email]').value = '');
    await page.type('input[name=email]', IDENTITY.email, { delay: 10 });

    console.log('Step 1 filled');
  }

  // Manual steps
  console.log(`
⚠️  MANUAL STEPS:
1. Click CONTINUE
2. Step 2 — Elevator Pitch: ${PRODUCT.tagline}
3. Step 2 — Description: ${PRODUCT.fullDesc.substring(0, 200)}...
4. Click CONTINUE
5. Step 3 — Upload logo from: ${PRODUCT.logoPath}
6. Click SUBMIT
`);

  console.log('✅ StartupBuffer step 1 ready');
  await browser.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
