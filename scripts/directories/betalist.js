#!/usr/bin/env node
// BetaList.com — startup launch directory
//
// What works:  account signup via email/password, email confirmation
// What breaks: startup submission form (React SPA — needs manual fill)
// Result:      account created, then manual submission at /submissions/new
//
// Run: node betalist.js

const { PRODUCT, IDENTITY, connectBrowser, getEmails, getEmailBody, confirmEmail } = require('./config');

(async () => {
  const browser = await connectBrowser();
  const page = await browser.newPage();

  // Step 1: Sign up
  console.log('Opening BetaList signup...');
  await page.goto('https://betalist.com/users/sign_up', { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));

  // Fill email + password
  await page.evaluate((email, pw) => {
    document.querySelectorAll('input').forEach(i => {
      if (i.type === 'email' || i.name?.includes('email')) { i.focus(); i.value = ''; document.execCommand('insertText', false, email); }
      if (i.type === 'password') { i.focus(); i.value = ''; document.execCommand('insertText', false, pw); }
    });
  }, IDENTITY.email, IDENTITY.password);

  // Submit
  await page.evaluate(() => {
    const btn = document.querySelector('input[type=submit], button[type=submit]');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 5000));
  console.log('Signup result:', page.url().substring(0, 50));

  // Step 2: Confirm email
  console.log('Waiting for verification email...');
  await new Promise(r => setTimeout(r, 10000));
  const emails = await getEmails();
  const blEmail = emails.find(m => m.subject.includes('Verify') || m.subject.includes('betalist'));
  if (blEmail) {
    const full = await getEmailBody(blEmail.id);
    const body = full.body_text || '';
    const match = body.match(/https:\/\/betalist\.com\/identity\/email_verification[^\s"']+/);
    if (match) {
      console.log('Confirming email...');
      const result = await confirmEmail(browser, match[0]);
      console.log('Confirm:', result.substring(0, 80));
    }
  }

  // Step 3: Navigate to submission form (manual from here)
  await page.goto('https://betalist.com/submissions/new', { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
  console.log('⚠️  MANUAL STEP: fill the startup submission form');
  console.log('  Name:', PRODUCT.name);
  console.log('  URL:', PRODUCT.url);
  console.log('  Tagline:', PRODUCT.tagline);

  console.log('✅ BetaList account ready, submission form open');
  await browser.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
