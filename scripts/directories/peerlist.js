#!/usr/bin/env node
// Peerlist.io — tech professional profile + project listing
//
// What works:
//   - Signup with email/password at /signup (email+password form, NOT Google/GitHub)
//   - Email verification via 5-char OTP code sent to inbox (subject: "XXXXX is your Peerlist verification code.")
//   - OTP entered on /verify page — input#code, then "Verify and continue" button
//   - After OTP → redirected to /username (profile URL set automatically from username)
//   - Welcome modal appears on profile page with fields: firstName, lastName, headline (bio), username, LinkedIn
//   - React controlled inputs: fill using native property setter + input/change events, NOT cdpType
//   - Profile settings at /user/settings/profile with: location (react-select), website, social links
//   - Location is a react-select → click the container (.css-b62m3t-container), type, click option
//   - "Add Project" button is NOT a <button> — it's a div[role="none"] with cursor-pointer class,
//     found via TreeWalker text search + getBoundingClientRect, clicked via page.mouse.click()
//   - Project form at /user/projects/add-project with fields:
//       #title (project name), #url (project URL), #tagline (60 char limit),
//       #categories, #tags, #collaborators, #isOpenSource (checkbox)
//       Description: ProseMirror rich text editor (fill via document.execCommand('insertText'))
//       Logo: input[type="file"] uploads to project
//   - Submit via "Save Project" button
//
// What breaks / gotchas:
//   - cdpType character-by-character is too slow for long text → use React native setter for inputs
//   - Description is a rich text editor, NOT a textarea → use execCommand('insertText')
//   - Location is react-select, NOT a plain input → must click container, type, then click dropdown option
//   - "Add Project" div is invisible to button queries (innerText detection fails due to icon SVG child)
//     → use TreeWalker to find the text node, then walk up to the cursor-pointer parent
//   - Logo upload goes to input[type="file"] on the project form
//   - Tagline has 60 char limit
//   - Project URL must be a real URL (not text) — "Please enter valid demo URL" if wrong format
//
// Result: SUCCESS
//   Profile: https://peerlist.io/tikitakavip
//   Project: https://peerlist.io/tikitakavip/project/tikitaka
//   Profile shows: name "Tiki Taka", location "Tel Aviv-Yafo, IL", website tikitaka.vip,
//                  bio mentioning tikitaka.vip, TikiTaka project with monkey logo

const { PRODUCT, IDENTITY, MAILBOX, connectBrowser, waitForEmail } = require('./config');

const TAGLINE = 'Free World Cup 2026 prediction game vs a monkey';
const BIO = `Indie developer. Creator of TikiTaka — free World Cup 2026 prediction game vs a monkey. ${PRODUCT.url.replace('https://', '')}`;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function ss(page, path) {
  const { execSync } = require('child_process');
  return page.screenshot({ path }).then(() => {
    try { execSync(`python3 /home/ubuntu/.claude/hooks/resize-images.py ${path} --max-dim 1800`); } catch(e) {}
    console.log('Screenshot:', path);
  });
}

// Set React controlled input value instantly
async function reactFill(page, selector, value) {
  return page.evaluate((sel, val) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    el.focus();
    el.click();
    const nativeSetter = el.tagName === 'TEXTAREA'
      ? Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
      : Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (nativeSetter) nativeSetter.call(el, val);
    else el.value = val;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return el.value;
  }, selector, value);
}

// Fill contenteditable/ProseMirror via execCommand
async function richFill(page, selector, text) {
  return page.evaluate((sel, val) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    el.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, val);
    return el.innerText?.substring(0, 30);
  }, selector, text);
}

(async () => {
  const browser = await connectBrowser();
  const page = await browser.newPage();
  const client = await page.createCDPSession();

  // ── Step 1: Sign up ────────────────────────────────────────────────────
  console.log('Step 1: Sign up...');
  await page.goto('https://peerlist.io/signup', { waitUntil: 'networkidle2', timeout: 20000 });
  await page.bringToFront();
  await sleep(2000);

  await page.focus('#email');
  for (const c of IDENTITY.email) {
    await client.send('Input.dispatchKeyEvent', { type: 'keyDown', text: c });
    await client.send('Input.dispatchKeyEvent', { type: 'keyUp', text: c });
    await sleep(5);
  }
  await page.focus('#password');
  for (const c of IDENTITY.password) {
    await client.send('Input.dispatchKeyEvent', { type: 'keyDown', text: c });
    await client.send('Input.dispatchKeyEvent', { type: 'keyUp', text: c });
    await sleep(5);
  }
  await page.evaluate(() => document.querySelector('button[type=submit]')?.click());
  await sleep(4000);
  console.log('After signup URL:', page.url()); // should be /verify

  // ── Step 2: Email OTP verification ─────────────────────────────────────
  console.log('Step 2: Waiting for OTP email...');
  // Email subject: "XXXXX is your Peerlist verification code."
  const emailData = await waitForEmail('verification code', 60);
  let otpCode = null;

  if (emailData && !emailData.timeout) {
    const { fetch } = require('undici');
    const resp = await fetch(
      `${MAILBOX.baseUrl}/mailbox/${MAILBOX.id}/messages/${emailData.id}`,
      { headers: { 'x-api-key': MAILBOX.apiKey } }
    );
    const body = await resp.json();
    const text = body.body_text || '';
    // OTP is a 5-char alphanumeric code on its own line
    const match = text.match(/\n([A-Z0-9]{5})\n/);
    if (match) otpCode = match[1];
    // Also extract from subject: "XXXXX is your Peerlist verification code."
    if (!otpCode && emailData.subject) {
      const sm = emailData.subject.match(/^([A-Z0-9]{5})\s+is your/);
      if (sm) otpCode = sm[1];
    }
    console.log('OTP code:', otpCode);
  }

  if (!otpCode) throw new Error('Could not get OTP code from email');

  await page.goto('https://peerlist.io/verify', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.bringToFront();
  await sleep(2000);

  await page.focus('#code');
  for (const c of otpCode) {
    await client.send('Input.dispatchKeyEvent', { type: 'keyDown', text: c });
    await client.send('Input.dispatchKeyEvent', { type: 'keyUp', text: c });
    await sleep(10);
  }
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText?.includes('Verify'));
    if (btn) btn.click();
  });
  await sleep(5000);
  console.log('After OTP URL:', page.url()); // should be /tikitakavip or username

  // ── Step 3: Fill welcome modal ─────────────────────────────────────────
  console.log('Step 3: Fill welcome modal...');
  const profileUrl = `https://peerlist.io/${IDENTITY.username}`;
  await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.bringToFront();
  await sleep(3000);

  await page.evaluate((firstName, lastName, bio) => {
    function setVal(sel, val) {
      const el = document.querySelector(sel);
      if (!el) return;
      const setter = el.tagName === 'TEXTAREA'
        ? Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
        : Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (setter) setter.call(el, val);
      else el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    setVal('#firstName', firstName);
    setVal('#lastName', lastName);
    setVal('#headline', bio);
    // Uncheck LinkedIn autofill
    const cb = document.querySelector('#fromLinkedIn');
    if (cb?.checked) cb.click();
  }, 'Tiki', 'Taka', BIO);

  await sleep(300);
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText?.includes('Create Profile'));
    if (btn) btn.click();
  });
  await sleep(5000);
  console.log('Profile created, URL:', page.url());

  // ── Step 4: Update profile settings (location + website) ──────────────
  console.log('Step 4: Update profile settings...');
  await page.goto('https://peerlist.io/user/settings/profile', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.bringToFront();
  await sleep(2000);

  // Set website
  await reactFill(page, '#website', PRODUCT.url);
  await sleep(200);

  // Set location via react-select
  // 1. Find and click the react-select container for #location
  const locContainer = await page.evaluate(() => {
    const locInput = document.querySelector('#location');
    if (!locInput) return null;
    let el = locInput;
    for (let i = 0; i < 10; i++) {
      const r = el.getBoundingClientRect();
      if (r.width > 50) return { x: r.x + r.width/2, y: r.y + r.height/2 };
      el = el.parentElement;
      if (!el) break;
    }
    return null;
  });

  if (locContainer) {
    await page.mouse.click(locContainer.x, locContainer.y);
    await sleep(500);
    await page.keyboard.type('Tel Aviv', { delay: 80 });
    await sleep(2000);
    // Click first option
    const optClicked = await page.evaluate(() => {
      const opts = document.querySelectorAll('[class*="option"], [role="option"]');
      const telAviv = Array.from(opts).find(o => o.textContent?.includes('Tel Aviv'));
      if (telAviv) {
        const r = telAviv.getBoundingClientRect();
        return { x: r.x + r.width/2, y: r.y + r.height/2, text: telAviv.textContent.substring(0, 30) };
      }
      if (opts[0]) {
        const r = opts[0].getBoundingClientRect();
        return { x: r.x + r.width/2, y: r.y + r.height/2, text: opts[0].textContent.substring(0, 30) };
      }
      return null;
    });
    if (optClicked) await page.mouse.click(optClicked.x, optClicked.y);
    await sleep(500);
  }

  // Save
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText?.trim() === 'Save');
    if (btn) btn.click();
  });
  await sleep(3000);
  console.log('Profile settings saved');

  // ── Step 5: Add TikiTaka project ───────────────────────────────────────
  console.log('Step 5: Add project...');
  await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.bringToFront();
  await sleep(3000);

  // Find "Add Project" text via TreeWalker, click parent container
  const addProjCoords = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.textContent.trim() === 'Add Project') {
        let el = node.parentElement;
        for (let i = 0; i < 5; i++) {
          if (el?.className?.includes('cursor-pointer') || el?.getAttribute('tabindex') !== null) {
            const r = el.getBoundingClientRect();
            return { x: r.x + r.width/2, y: r.y + r.height/2 };
          }
          el = el?.parentElement;
        }
        const r = node.parentElement.getBoundingClientRect();
        return { x: r.x + r.width/2, y: r.y + r.height/2 };
      }
    }
    return null;
  });

  if (addProjCoords) {
    await page.evaluate((y) => window.scrollTo(0, Math.max(0, y - 300)), addProjCoords.y);
    await sleep(500);
    const updated = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.textContent.trim() === 'Add Project') {
          let el = node.parentElement;
          for (let i = 0; i < 5; i++) {
            if (el?.className?.includes('cursor-pointer') || el?.getAttribute('tabindex') !== null) {
              const r = el.getBoundingClientRect();
              return { x: r.x + r.width/2, y: r.y + r.height/2 };
            }
            el = el?.parentElement;
          }
          const r = node.parentElement.getBoundingClientRect();
          return { x: r.x + r.width/2, y: r.y + r.height/2 };
        }
      }
      return null;
    });
    await page.mouse.click(updated?.x || addProjCoords.x, updated?.y || addProjCoords.y);
    await sleep(3000);
  }
  console.log('After Add Project click, URL:', page.url()); // /user/projects/add-project

  // ── Step 6: Fill project form ──────────────────────────────────────────
  console.log('Step 6: Fill project form...');
  await sleep(1000);

  await reactFill(page, '#title', PRODUCT.name);
  await sleep(100);
  await reactFill(page, '#url', PRODUCT.url);
  await sleep(100);
  await reactFill(page, '#tagline', TAGLINE);
  await sleep(100);
  await richFill(page, '.ProseMirror, [contenteditable="true"]', PRODUCT.shortDesc);
  await sleep(300);

  // Upload logo
  const fileEl = await page.$('input[type="file"]');
  if (fileEl) {
    await fileEl.uploadFile(PRODUCT.logoPath);
    await sleep(2000);
  }

  // Submit
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText?.includes('Save Project') && !b.disabled);
    if (btn) btn.click();
  });
  await sleep(5000);
  console.log('After submit URL:', page.url()); // should redirect to profile

  // ── Final screenshots ──────────────────────────────────────────────────
  await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.bringToFront();
  await sleep(3000);
  await ss(page, '/tmp/dir-peerlist-profile.png');

  await page.goto(`${profileUrl}/project/tikitaka`, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.bringToFront();
  await sleep(3000);
  await ss(page, '/tmp/dir-peerlist-project.png');

  await client.detach();
  await browser.disconnect();

  console.log('\nPeerlist registration complete!');
  console.log('Profile: https://peerlist.io/tikitakavip');
  console.log('Project: https://peerlist.io/tikitakavip/project/tikitaka');
})().catch(e => { console.error(e); process.exit(1); });
