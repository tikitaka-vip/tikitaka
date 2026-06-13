#!/usr/bin/env node
// IndieHackers.com — indie community + product listing
//
// What works:
//   - Multi-step signup wizard (username -> stage -> coding level -> interests -> birthday/location -> email/password)
//   - Product creation at /new-product (redirects to /products/new)
//   - Logo upload via file chooser on the product form
//   - Signup auto-redirects to homepage on success (no email verification required)
//   - Product page created at /product/tikitaka with edit checklist
//
// What breaks:
//   - Birthday fields are ember-select dropdowns, not regular inputs — must click to open dropdown,
//     then click the .es-option element. keyboard.type() doesn't work; cdpType doesn't work.
//     Month options are full names (January, February...), Day and Year are numbers.
//   - Location is a geocode autocomplete — type city name, wait for .geocode-input-wrapper__suggestion
//     elements, then page.mouse.click() at the bounding box center. page.evaluate(el.click()) doesn't
//     register with Ember; you must use real mouse coordinates.
//   - Tagline field has maxlength=60 — the full tagline from config is too long.
//   - Honeypot field (placeholder "We use this field to detect spam bots...") must stay empty.
//   - The upload area uses a <button> that triggers a file chooser dialog, not a <input type="file">.
//     Must use page.waitForFileChooser() + page.click('.v2form__button-field') pattern.
//
// Result: SUCCESS — account created as tikitaka_vip, product live at
//   https://www.indiehackers.com/product/tikitaka
//   Edit page has checklist: fill motivation, add post, add revenue data.

const { PRODUCT, IDENTITY, connectBrowser } = require('./config');

(async () => {
  const browser = await connectBrowser();
  const page = await browser.newPage();

  // Step 1: Signup
  console.log('Opening signup page...');
  await page.goto('https://www.indiehackers.com/sign-up', { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));

  const client = await page.createCDPSession();

  async function cdpType(client, page, sel, text) {
    await page.evaluate(s => { const el = document.querySelector(s); if (el) { el.focus(); el.click(); el.value = ''; } }, sel);
    await new Promise(r => setTimeout(r, 80));
    for (const c of text) {
      await client.send('Input.dispatchKeyEvent', { type: 'keyDown', text: c });
      await client.send('Input.dispatchKeyEvent', { type: 'keyUp', text: c });
      await new Promise(r => setTimeout(r, 5));
    }
  }

  // Username step
  await cdpType(client, page, 'input[placeholder="e.g. IndieHacker322"]', IDENTITY.username);
  await new Promise(r => setTimeout(r, 500));
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Next'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 2000));

  // Stage step — select "Actively getting started on something new"
  await page.evaluate(() => {
    const lis = document.querySelectorAll('li.survey-question__answer');
    for (const li of lis) {
      if (li.textContent.includes('Actively getting started')) { li.click(); return; }
    }
  });
  await new Promise(r => setTimeout(r, 500));
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Next'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 2000));

  // Coding step — select "intermediate or a professional"
  await page.evaluate(() => {
    const lis = document.querySelectorAll('li.survey-question__answer');
    for (const li of lis) {
      if (li.textContent.includes('intermediate or a professional')) { li.click(); return; }
    }
  });
  await new Promise(r => setTimeout(r, 500));
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Next'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 2000));

  // Interests step — select a few tags
  for (const tag of ['AI', 'Games', 'Sports', 'Web3']) {
    await page.evaluate((t) => {
      const lis = document.querySelectorAll('li.survey-question__answer');
      for (const li of lis) { if (li.textContent.trim() === t) { li.click(); return; } }
    }, tag);
    await new Promise(r => setTimeout(r, 200));
  }
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Next'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 2000));

  // Birthday + Location step
  // Birthday: open each ember-select dropdown and click the option
  await page.click('.v2form__date-select--month input');
  await new Promise(r => setTimeout(r, 800));
  await page.evaluate(() => {
    const opts = document.querySelectorAll('.v2form__date-select--month .es-option');
    for (const o of opts) { if (o.textContent.trim() === 'June') { o.click(); return; } }
  });
  await new Promise(r => setTimeout(r, 500));

  // Clear day if set, open dropdown
  await page.evaluate(() => {
    const clear = document.querySelector('.v2form__date-select--day .es-clear-zone');
    if (clear) clear.click();
  });
  await new Promise(r => setTimeout(r, 300));
  await page.click('.v2form__date-select--day input');
  await new Promise(r => setTimeout(r, 800));
  await page.evaluate(() => {
    const opts = document.querySelectorAll('.v2form__date-select--day .es-option');
    for (const o of opts) { if (o.textContent.trim() === '15') { o.click(); return; } }
  });
  await new Promise(r => setTimeout(r, 500));

  await page.click('.v2form__date-select--year input');
  await new Promise(r => setTimeout(r, 800));
  await page.evaluate(() => {
    const opts = document.querySelectorAll('.v2form__date-select--year .es-option');
    for (const o of opts) { if (o.textContent.trim() === '1992') { o.click(); return; } }
  });
  await new Promise(r => setTimeout(r, 500));

  // Location: type city, then click suggestion using real mouse coordinates
  await page.click('.v2form__city-input');
  await new Promise(r => setTimeout(r, 300));
  await page.keyboard.type('Tel Aviv', { delay: 80 });
  await new Promise(r => setTimeout(r, 2000));

  const rect = await page.evaluate(() => {
    const s = document.querySelector('.geocode-input-wrapper__suggestion[title="Tel Aviv"]');
    if (!s) return null;
    const r = s.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (rect) await page.mouse.click(rect.x, rect.y);
  await new Promise(r => setTimeout(r, 1000));

  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Next'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 3000));

  // Email + Password step
  await cdpType(client, page, 'input[placeholder="Enter email address"]', IDENTITY.email);
  await new Promise(r => setTimeout(r, 300));
  await cdpType(client, page, 'input[placeholder="Choose password"]', IDENTITY.password);
  await new Promise(r => setTimeout(r, 300));
  // Do NOT fill honeypot
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Sign Up'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 5000));

  console.log('Signup URL after submit:', page.url());
  // Should redirect to https://www.indiehackers.com/

  // Step 2: Create product
  await page.goto('https://www.indiehackers.com/new-product', { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));

  // Tagline must be <=60 chars
  const tagline = PRODUCT.tagline.length <= 60
    ? PRODUCT.tagline
    : 'Free World Cup 2026 prediction game vs a real monkey';

  await cdpType(client, page, 'input[placeholder="e.g. Acme Sprockets"]', PRODUCT.name);
  await new Promise(r => setTimeout(r, 200));
  await cdpType(client, page, 'input[placeholder*="Music Remixing"]', tagline);
  await new Promise(r => setTimeout(r, 200));
  await cdpType(client, page, 'input[placeholder="https://…"]', PRODUCT.url);
  await new Promise(r => setTimeout(r, 200));

  // Upload logo via file chooser
  const [fileChooser] = await Promise.all([
    page.waitForFileChooser({ timeout: 5000 }),
    page.click('.v2form__button-field'),
  ]);
  await fileChooser.accept([PRODUCT.logoPath]);
  await new Promise(r => setTimeout(r, 3000));

  // Submit product
  await page.evaluate(() => {
    const btn = document.querySelector('button[type=submit]');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 5000));

  console.log('Product page URL:', page.url());
  // Should be https://www.indiehackers.com/product/tikitaka/edit

  await page.screenshot({ path: '/tmp/dir-indiehackers.png' });
  await client.detach();
  await browser.disconnect();
  console.log('Done.');
})().catch(e => console.error(e));
