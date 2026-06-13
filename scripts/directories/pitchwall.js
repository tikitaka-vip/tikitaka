#!/usr/bin/env node
// PitchWall.co — startup pitch directory
//
// What works:  GitHub OAuth (if session exists), profile setup, URL submission,
//              auto-scrapes product details, fills name/summary/description
// What breaks: tags dropdown (empty database as of June 2026), Hebrew scraping
//              (need to replace scraped Hebrew with English)
// Result:      product page created at pitchwall.co/product/slug
//
// Prerequisites: Chrome must be logged into GitHub (tikitaka-vip account)
//
// Run: node pitchwall.js

const { PRODUCT, IDENTITY, connectBrowser } = require('./config');

(async () => {
  const browser = await connectBrowser();
  const page = await browser.newPage();

  // Step 1: Auth via GitHub
  console.log('Opening PitchWall GitHub auth...');
  await page.goto('https://pitchwall.co/auth/login?redirect=/product/submit?plan=free', {
    waitUntil: 'networkidle2', timeout: 15000
  }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));

  // Check if we landed on GitHub authorize page
  if (page.url().includes('github.com')) {
    console.log('On GitHub OAuth page. Clicking Authorize...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Authorize'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 5000));
  }

  // Check if profile setup needed
  if (page.url().includes('profile')) {
    console.log('Setting up profile...');
    await page.click('input[name=name]');
    await page.keyboard.type(IDENTITY.displayName);
    await page.click('input[name=username]');
    await page.keyboard.type('tikitaka');
    await page.click('textarea[name=about]');
    await page.keyboard.type(PRODUCT.tagline);

    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Save'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 3000));
    console.log('Profile saved');
  }

  // Step 2: Submit product URL
  await page.goto('https://pitchwall.co/product/submit?plan=free', { waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));

  await page.click('input[type=url]');
  await page.evaluate(() => document.querySelector('input[type=url]').value = '');
  await page.keyboard.type(PRODUCT.url);

  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Add');
    if (btn) btn.click();
  });

  // Wait for scraping to complete (up to 60s)
  console.log('Waiting for PitchWall to scrape product...');
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const generating = await page.evaluate(() =>
      document.body.innerText.includes('Generating') || document.body.innerText.includes('Writing description')
    );
    if (!generating) break;
    if (i % 5 === 0) process.stdout.write('.');
  }
  console.log(' done');

  // Step 3: Replace scraped Hebrew with English
  const hasForm = await page.evaluate(() => !!document.querySelector('textarea'));
  if (hasForm) {
    await page.evaluate((name, tagline, desc) => {
      const inputs = Array.from(document.querySelectorAll('input:not([type=hidden]), textarea')).filter(el => el.offsetParent !== null);
      inputs.forEach(el => {
        const val = el.value || '';
        // Skip the slug and URL fields
        if (val.includes('https://') || val.match(/^[a-z0-9-]+$/)) return;
        // Product name (short field with Hebrew)
        if (el.type === 'text' && val.length < 35 && /[֐-׿]/.test(val)) {
          el.focus(); el.value = ''; document.execCommand('insertText', false, name);
        }
        // Summary (input with Hebrew)
        if (el.type === 'text' && val.length > 35 && /[֐-׿]/.test(val)) {
          el.focus(); el.value = ''; document.execCommand('insertText', false, tagline);
        }
        // Description (textarea with Hebrew)
        if (el.tagName === 'TEXTAREA' && /[֐-׿]/.test(val)) {
          el.focus(); el.value = ''; document.execCommand('insertText', false, desc);
        }
      });
    }, PRODUCT.name + ' - Beat the Monkey', PRODUCT.tagline, PRODUCT.fullDesc);
    console.log('Replaced Hebrew with English copy');
  }

  // Step 4: Tags — broken as of June 2026 (empty database)
  // Skip and click Next — will fail with validation error
  console.log('⚠️  Tags dropdown is broken (empty DB). Need manual tag selection if it gets fixed.');
  console.log('⚠️  MANUAL STEP: select tags if available, then click Next');

  console.log('✅ PitchWall product details filled');
  await browser.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
