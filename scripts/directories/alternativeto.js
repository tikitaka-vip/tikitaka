#!/usr/bin/env node
// AlternativeTo.net — software alternatives directory (high DA)
//
// Submit at: https://alternativeto.net/software/new/
// Needs account first, then add app
//
// Run: node alternativeto.js

const { PRODUCT, IDENTITY, connectBrowser } = require('./config');

(async () => {
  const browser = await connectBrowser();
  const page = await browser.newPage();

  console.log('Opening AlternativeTo...');
  await page.goto('https://alternativeto.net/software/new/', { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: '/tmp/dir-alternativeto.png' });

  const needsLogin = await page.evaluate(() =>
    document.body.innerText.includes('Sign in') || document.body.innerText.includes('Log in') || document.body.innerText.includes('Create account')
  );

  if (needsLogin) {
    console.log('Needs login. Trying signup...');
    await page.goto('https://alternativeto.net/account/register/', { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: '/tmp/dir-alternativeto-signup.png' });

    await page.evaluate((email, pw, name) => {
      document.querySelectorAll('input').forEach(i => {
        const n = (i.name || i.placeholder || '').toLowerCase();
        if (i.type === 'email' || n.includes('email')) { i.focus(); i.value = ''; document.execCommand('insertText', false, email); }
        if (i.type === 'password') { i.focus(); i.value = ''; document.execCommand('insertText', false, pw); }
        if (n.includes('name') || n.includes('user')) { i.focus(); i.value = ''; document.execCommand('insertText', false, name); }
      });
    }, IDENTITY.email, IDENTITY.password, IDENTITY.username);

    await page.evaluate(() => {
      const btn = document.querySelector('button[type=submit], input[type=submit]');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 5000));
    console.log('After signup:', page.url().substring(0, 60));
  }

  // Try to add software
  const hasForm = await page.evaluate(() => {
    const fields = Array.from(document.querySelectorAll('input:not([type=hidden]), textarea'))
      .filter(el => el.offsetParent !== null);
    return fields.length;
  });
  console.log('Form fields:', hasForm);
  await page.screenshot({ path: '/tmp/dir-alternativeto-form.png' });

  console.log('⚠️ Check screenshots at /tmp/dir-alternativeto*.png');
  await browser.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
