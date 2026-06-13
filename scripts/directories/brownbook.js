#!/usr/bin/env node
// BrownBook.net — business listing directory (DA 61)
//
// What works:  account signup, email confirm, all text fields via execCommand
// What breaks: country dropdown (React Select — needs manual click)
// Result:      listing goes live immediately after step 2 account creation
//
// Run: node brownbook.js

const { PRODUCT, IDENTITY, MAILBOX, connectBrowser, getEmails, getEmailBody, confirmEmail } = require('./config');

(async () => {
  const browser = await connectBrowser();
  const page = await browser.newPage();

  // Step 1: fill business listing form
  console.log('Opening BrownBook add-business...');
  await page.goto('https://www.brownbook.net/add-business', { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));

  // Fill text fields
  const fills = [
    ['name', PRODUCT.name],
    ['address', 'Tel Aviv'],
    ['city', 'Tel Aviv'],
    ['zip_code', '6100000'],
    ['phone', IDENTITY.phone],
    ['email', IDENTITY.email],
    ['website', PRODUCT.url],
    ['display_website', PRODUCT.url.replace('https://', '')],
  ];
  for (const [name, val] of fills) {
    await page.evaluate((n, v) => {
      const el = document.querySelector(`input[name="${n}"], textarea[name="${n}"]`);
      if (el) { el.focus(); el.value = ''; document.execCommand('insertText', false, v); }
    }, name, val);
  }

  // Category dropdown — type to search
  const catInput = await page.$("input[placeholder*='search categories']");
  if (!catInput) {
    // Open the dropdown first
    await page.evaluate(() => {
      const sel = document.querySelector("input[id='_r_u_']");
      if (sel) sel.click();
    });
    await new Promise(r => setTimeout(r, 500));
  }
  const catSearch = await page.$("input[placeholder*='search categories']") || await page.$("input[id='_r_u_']");
  if (catSearch) {
    await catSearch.click();
    await catSearch.type('Sports', { delay: 20 });
    await new Promise(r => setTimeout(r, 1500));
    // Select "Spectator Sports" from results
    await page.evaluate(() => {
      const opt = Array.from(document.querySelectorAll('div')).find(d => d.textContent?.startsWith('Spectator Sports'));
      if (opt) opt.click();
    });
    await new Promise(r => setTimeout(r, 500));
  }
  console.log('Text fields + category filled');

  // Country dropdown — MANUAL: React Select, needs user click
  // The country dropdown is a <button> with text "Select country"
  // Automated clicking + typing doesn't work — the combobox doesn't expose a typeable input
  console.log('⚠️  MANUAL STEP: click Country dropdown → select Israel');
  console.log('Then click "Add" button at the bottom');
  console.log('Waiting for page to navigate to step 2...');

  // Poll until we leave step 1
  for (let i = 0; i < 120; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const body = await page.evaluate(() => document.body.innerText.substring(0, 100));
    if (body.includes('step 2') || body.includes('CREATE AN ACCOUNT')) {
      console.log('Step 2 detected!');
      break;
    }
  }

  // Step 2: create account (appears after business is added)
  const step2Fields = [
    ['Email*', IDENTITY.email],
    ['Password*', IDENTITY.password],
    ['Password (Confirm)*', IDENTITY.password],
    ['Name*', IDENTITY.displayName],
  ];
  for (const [placeholder, val] of step2Fields) {
    await page.evaluate((ph, v) => {
      const el = Array.from(document.querySelectorAll('input')).find(i => i.placeholder === ph);
      if (el) { el.focus(); el.value = ''; document.execCommand('insertText', false, v); }
    }, placeholder, val);
  }

  // reCAPTCHA — needs manual solve or 2captcha
  console.log('⚠️  MANUAL STEP: solve reCAPTCHA, then click Next');
  console.log('Waiting for account creation...');

  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const url = page.url();
    if (url.includes('add-business') && i > 5) break;
  }

  // Confirm email
  console.log('Checking for confirmation email...');
  const emails = await getEmails();
  const bbEmail = emails.find(m => m.subject.includes('Brownbook'));
  if (bbEmail) {
    const full = await getEmailBody(bbEmail.id);
    const body = full.body_text || '';
    const match = body.match(/https:\/\/www\.brownbook\.net\/verify-email[^\s"']+/);
    if (match) {
      console.log('Confirming email...');
      const result = await confirmEmail(browser, match[0]);
      console.log('Confirm result:', result.substring(0, 80));
    }
  }

  console.log('✅ BrownBook done');
  await browser.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
