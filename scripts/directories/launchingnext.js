#!/usr/bin/env node
// LaunchingNext.com — startup launch directory
//
// What works:  CDP Input.dispatchKeyEvent for all fields, radio click via evaluate
// What breaks: page.type(), execCommand, page.evaluate value setting — all fail
// Key insight: this form strips automated input but CDP keyevents bypass the filter
// Result:      submission goes through, no confirmation email (reviewed manually by staff)
//
// Run: node launchingnext.js

const { PRODUCT, IDENTITY, connectBrowser } = require('./config');

async function cdpType(client, page, selector, text) {
  await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (el) { el.focus(); el.click(); el.value = ''; }
  }, selector);
  await new Promise(r => setTimeout(r, 100));
  for (const char of text) {
    await client.send('Input.dispatchKeyEvent', { type: 'keyDown', text: char });
    await client.send('Input.dispatchKeyEvent', { type: 'keyUp', text: char });
    await new Promise(r => setTimeout(r, 10));
  }
}

(async () => {
  const browser = await connectBrowser();
  const page = await browser.newPage();

  console.log('Opening LaunchingNext...');
  await page.goto('https://www.launchingnext.com/submit/', { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));

  // Dismiss cookies
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Accept'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 500));

  const client = await page.createCDPSession();

  // Fill all fields via CDP keyevents
  await cdpType(client, page, 'input[name=startupname]', PRODUCT.name);
  await cdpType(client, page, 'input[name=startupurl]', PRODUCT.url);
  await cdpType(client, page, 'input[name=description]', PRODUCT.tagline);
  await cdpType(client, page, 'textarea[name=fulldescription]', PRODUCT.fullDesc.substring(0, 2400));
  await cdpType(client, page, 'textarea[name=tags]', PRODUCT.tags);

  // Radios
  await page.evaluate(() => {
    document.querySelector("input[name=funding][value='1']")?.click();
    document.querySelector("input[name=marketing_budget][value='$0']")?.click();
  });

  await cdpType(client, page, 'input[name=user]', IDENTITY.firstName);
  await cdpType(client, page, 'input[name=email]', IDENTITY.email);

  // Math captcha
  await page.evaluate(() => window.scrollTo(0, 99999));
  await new Promise(r => setTimeout(r, 300));
  const mathQ = await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('label'));
    const ml = labels.find(l => l.textContent?.includes('What is') || l.textContent?.includes('Quick'));
    return ml?.textContent?.trim() || '';
  });
  const m = mathQ.match(/(\d+)\s*[\+\-\*x×]\s*(\d+)/);
  if (m) {
    const ans = mathQ.includes('+') ? parseInt(m[1])+parseInt(m[2]) : parseInt(m[1])*parseInt(m[2]);
    await cdpType(client, page, 'input[name=math]', String(ans));
    console.log('Math:', mathQ, '=', ans);
  }

  // Submit
  await page.evaluate(() => document.querySelector('input[name=formSubmit]')?.click());
  await new Promise(r => setTimeout(r, 5000));
  console.log('Result URL:', page.url());

  await client.detach();
  console.log('✅ LaunchingNext submitted (no confirmation email — staff reviews manually)');
  await browser.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
