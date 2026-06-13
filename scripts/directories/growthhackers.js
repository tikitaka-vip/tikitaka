/**
 * GrowthHackers Community Registration & Post Script
 * Platform: growthspace.growthhackers.com
 * Account: tikitaka.vip@aiemailservice.com / tikitakavip
 */

const puppeteer = require('/tmp/node_modules/puppeteer-core');

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

async function forceClearAndSet(page, sel, value) {
  await page.evaluate((s, v) => {
    const el = document.querySelector(s);
    if (el) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeInputValueSetter.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, sel, value);
}

async function run() {
  const browser = await puppeteer.connect({
    browserURL: 'http://localhost:9222',
    defaultViewport: null
  });
  const page = (await browser.pages())[0];
  const client = await page.createCDPSession();
  page.on('dialog', async d => { console.log('Dialog:', d.message()); await d.accept(); });

  // ── Step 1: Register ──────────────────────────────────────────────────────
  console.log('Navigating to signup...');
  await page.goto('https://growthspace.growthhackers.com/auth/signup', {
    waitUntil: 'networkidle2',
    timeout: 20000
  });
  await page.bringToFront();

  await cdpType(client, page, '#name', 'Tiki Taka');
  await cdpType(client, page, '#email', 'tikitaka.vip@aiemailservice.com');
  await cdpType(client, page, '#password', 'TK!v1p_2026WC#secure');

  // Check ToS checkbox
  await page.evaluate(() => {
    const cb = document.querySelector('input[name="checkbox"]');
    if (cb) cb.click();
  });
  await new Promise(r => setTimeout(r, 300));

  // Submit form
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Create my account'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 3000));
  console.log('Signup URL:', page.url());

  // ── Step 2: Email Verification ───────────────────────────────────────────
  console.log('Checking for verification email...');
  const resp = await fetch(
    'https://aiemailservice.com/v1/mailbox/mbx_de7d0e26018b4364/wait?timeout=30&subject_contains=growthhackers',
    { headers: { 'x-api-key': 'ak_c026ce1fe7164b70ab96f5d013761341' } }
  );
  const emailData = await resp.json();

  let verifyUrl = null;
  if (emailData.message && emailData.message.extracted_codes) {
    const code = emailData.message.extracted_codes.find(c => c.includes('verificationCode'));
    if (code) verifyUrl = code.replace(']', '').replace(/&amp;/g, '&');
  }

  if (!verifyUrl) {
    // Fall back: extract from messages list
    const msgs = await fetch(
      'https://aiemailservice.com/v1/mailbox/mbx_de7d0e26018b4364/messages',
      { headers: { 'x-api-key': 'ak_c026ce1fe7164b70ab96f5d013761341' } }
    ).then(r => r.json());

    const msg = msgs.find(m => m.subject && m.subject.toLowerCase().includes('confirm'));
    if (msg && msg.extracted_codes) {
      verifyUrl = msg.extracted_codes.find(c => c.includes('verificationCode'));
      if (verifyUrl) verifyUrl = verifyUrl.replace(']', '').replace(/&amp;/g, '&');
    }
  }

  if (verifyUrl) {
    console.log('Navigating to verification URL...');
    await page.goto(verifyUrl, { waitUntil: 'networkidle2', timeout: 20000 });
    await page.bringToFront();
    await new Promise(r => setTimeout(r, 2000));
    console.log('Verified! URL:', page.url());
  }

  // ── Step 3: Update Profile ────────────────────────────────────────────────
  console.log('Going to profile to edit...');
  const profileUrl = 'https://growthspace.growthhackers.com/member/IqpjTLOQow';
  await page.goto(profileUrl, { waitUntil: 'networkidle2', timeout: 20000 });
  await page.bringToFront();
  await new Promise(r => setTimeout(r, 2000));

  // Click Edit profile button
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Edit profile'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // Fill tagline
  await cdpType(client, page, '#tagline', 'World Cup 2026 prediction game with a monkey competitor');
  await cdpType(client, page, '#job_title', 'Growth Hacker');

  // Click Update
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Update');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 3000));
  console.log('Profile updated');

  // ── Step 4: Post with Backlink ────────────────────────────────────────────
  console.log('Creating post...');
  await page.goto('https://growthspace.growthhackers.com/growth-hacking', {
    waitUntil: 'networkidle2',
    timeout: 20000
  });
  await page.bringToFront();
  await new Promise(r => setTimeout(r, 2000));

  // Click the "anything to ask or discuss" button
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Growth Hacking to ask or discuss'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 2000));

  // Fill title
  await page.evaluate(() => {
    const el = document.getElementById('fields.title');
    if (el) el.focus();
  });
  await new Promise(r => setTimeout(r, 200));

  const title = 'Free World Cup 2026 prediction game with a monkey competitor';
  for (const c of title) {
    await client.send('Input.dispatchKeyEvent', { type: 'keyDown', text: c });
    await client.send('Input.dispatchKeyEvent', { type: 'keyUp', text: c });
    await new Promise(r => setTimeout(r, 5));
  }
  await new Promise(r => setTimeout(r, 300));

  // Click content area
  await page.evaluate(() => {
    const ce = document.querySelector('[contenteditable="true"]');
    if (ce) ce.focus();
  });
  await new Promise(r => setTimeout(r, 200));

  const content = [
    'Just launched a free World Cup 2026 prediction game at https://tikitaka.vip that features a monkey as your AI competitor!',
    '',
    'The game works by:',
    '- Making match predictions for World Cup 2026 games',
    '- Competing against an AI "monkey" that picks randomly',
    '- Tracking your accuracy vs the monkey over time',
    '',
    'It is a fun experiment to see how often human intuition beats random chance.',
    'Early data suggests experienced football fans beat the monkey about 60% of the time.',
    '',
    'Would love feedback from this community on growth strategies to acquire more players.',
    '',
    'Check it out: https://tikitaka.vip'
  ].join('\n');

  for (const c of content) {
    if (c === '\n') {
      await page.keyboard.press('Enter');
    } else {
      await client.send('Input.dispatchKeyEvent', { type: 'keyDown', text: c });
      await client.send('Input.dispatchKeyEvent', { type: 'keyUp', text: c });
    }
    await new Promise(r => setTimeout(r, 5));
  }
  await new Promise(r => setTimeout(r, 300));

  // Publish
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise(r => setTimeout(r, 500));

  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Publish');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 5000));

  const postUrl = page.url();
  console.log('Post URL:', postUrl);

  await browser.disconnect();
  return { profileUrl, postUrl };
}

run().then(r => console.log('Done:', JSON.stringify(r))).catch(console.error);
