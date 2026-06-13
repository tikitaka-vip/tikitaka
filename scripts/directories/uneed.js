#!/usr/bin/env node
// Uneed.best — indie product launch directory (fast approval)
//
// What works:  FULL AUTO — signup via CDP keyevents, email confirm via API, product submit via CDP
// What breaks: nothing! clean flow: signup → confirm email → submit URL → done
// Result:      product added to waiting line for review
//
// Run: node uneed.js

const { PRODUCT, IDENTITY, connectBrowser, getEmails, getEmailBody, confirmEmail } = require('./config');

async function cdpType(client, page, selector, text) {
  await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (el) { el.focus(); el.click(); el.value = ''; }
  }, selector);
  await new Promise(r => setTimeout(r, 100));
  for (const char of text) {
    await client.send('Input.dispatchKeyEvent', { type: 'keyDown', text: char });
    await client.send('Input.dispatchKeyEvent', { type: 'keyUp', text: char });
    await new Promise(r => setTimeout(r, 8));
  }
}

(async () => {
  const browser = await connectBrowser();
  const page = await browser.newPage();

  // Step 1: Signup
  console.log('Signing up on Uneed...');
  await page.goto('https://www.uneed.best/signup', { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));

  const client = await page.createCDPSession();
  await cdpType(client, page, 'input[name=email]', IDENTITY.email);
  await cdpType(client, page, 'input[name=username]', IDENTITY.username);
  await cdpType(client, page, 'input[name=password]', IDENTITY.password);
  await cdpType(client, page, 'input[name=passwordConfirm]', IDENTITY.password);

  await page.evaluate(() => {
    const btn = document.querySelector('button[type=submit]');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 5000));
  console.log('Signup result:', page.url().substring(0, 50));

  // Step 2: Confirm email
  console.log('Waiting for confirmation email...');
  await new Promise(r => setTimeout(r, 10000));
  const emails = await getEmails();
  const confirmMail = emails.find(m => m.subject.includes('Confirm') || m.subject.includes('Signup'));
  if (confirmMail) {
    const full = await getEmailBody(confirmMail.id);
    const body = full.body_text || '';
    const match = body.match(/https:\/\/backend\.uneed\.best\/auth[^\s"'\]]+/);
    if (match) {
      const result = await confirmEmail(browser, match[0]);
      console.log('Email confirmed:', result.substring(0, 80));
    }
  }

  // Step 3: Submit product
  console.log('Submitting product...');
  await page.goto('https://www.uneed.best/submit-a-tool', { waitUntil: 'networkidle2', timeout: 12000 });
  await new Promise(r => setTimeout(r, 2000));

  await cdpType(client, page, 'input[name=name]', PRODUCT.name);
  await cdpType(client, page, 'input[name=url]', PRODUCT.url);

  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Submit'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 5000));

  const success = page.url().includes('waiting-line');
  console.log(success ? '✅ Uneed: product added to waiting line!' : '❌ Uneed: submission may have failed');
  console.log('URL:', page.url());

  await client.detach();
  await browser.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
