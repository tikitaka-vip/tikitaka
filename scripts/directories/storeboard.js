#!/usr/bin/env node
// StoreBoard.com — business directory (DA 61)
//
// What works:  full auto — click Community Member, account created instantly
// What breaks: nothing! simplest directory in the batch
// Result:      account created, MemberID assigned immediately
//
// Run: node storeboard.js

const { IDENTITY, connectBrowser } = require('./config');

(async () => {
  const browser = await connectBrowser();
  const page = await browser.newPage();

  console.log('Opening StoreBoard register...');
  await page.goto('https://www.storeboard.com/register', { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));

  // Check if profile type selection page appears
  const hasProfileSelect = await page.evaluate(() =>
    document.body.innerText.includes('Community Member')
  );

  if (hasProfileSelect) {
    // Click "Community Member" or "Select Here"
    await page.evaluate(() => {
      const link = Array.from(document.querySelectorAll('a')).find(a =>
        a.textContent.includes('Select Here') || a.textContent.includes('Community Member')
      );
      if (link) link.click();
    });
    await new Promise(r => setTimeout(r, 3000));
    console.log('Selected Community Member. URL:', page.url());

    // Check if we got a MemberID (instant registration)
    if (page.url().includes('MemberID')) {
      console.log('✅ StoreBoard registered! URL:', page.url());
      await browser.disconnect();
      return;
    }
  }

  // If we landed on a form instead, fill it
  const hasForm = await page.evaluate(() => !!document.querySelector('input[name=FirstName]'));
  if (hasForm) {
    console.log('Filling registration form...');
    await page.click('input[name=FirstName]', { clickCount: 3 });
    await page.keyboard.type(IDENTITY.firstName);
    await page.keyboard.press('Tab');
    await page.keyboard.type(IDENTITY.lastName);
    await page.keyboard.press('Tab');
    await page.keyboard.type(IDENTITY.email);
    await page.keyboard.press('Tab');
    await page.keyboard.type(IDENTITY.passwordShort); // max 16 chars alphanumeric
    await page.keyboard.press('Tab');
    await page.keyboard.type(IDENTITY.passwordShort);

    await page.evaluate(() =>
      document.querySelectorAll('input[type=checkbox]').forEach(c => { if (!c.checked) c.click(); })
    );

    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.toLowerCase().includes('go'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 5000));
    console.log('Result:', page.url().substring(0, 60));
  }

  console.log('✅ StoreBoard done');
  await browser.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
