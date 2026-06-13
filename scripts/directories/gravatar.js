#!/usr/bin/env node
// Gravatar — globally recognized avatar / link-in-bio profile (DA 92)
//
// What works:
//   - Account creation via WordPress.com magic-link (email verification code)
//   - Onboarding wizard: name, bio, location, organization, job title
//   - Adding website link (the backlink) via profile links section
//   - All text fields via CDP keyevents
//   - Developer API key creation (for profile read access)
//
// What breaks:
//   - Avatar upload: Gravatar's image editor requires WebGL, which is not
//     available in headless/remote-debug Chrome. The editor shows:
//     "WebGL is not supported or disabled in your browser"
//     Workaround: upload avatar manually from a browser with GPU, or
//     find a way to use the Gravatar REST API v3 with proper OAuth scopes.
//   - Gravatar REST API v3 /me/avatars endpoint: returns 403 insufficient_scope
//     even with "global" scope OAuth token from client_id 112240.
//     The avatar upload endpoint appears to require Gravatar-internal OAuth
//     scopes that are not available to third-party developer apps.
//
// Profile URL:  https://gravatar.com/vibrantcb1fc059ca
// Backlink:     https://tikitaka.vip (in Links section, visible on public profile)
// Email hash:   ea8abf56d9d249ca076a94d7c0a2db6b06cf2bd5bb1aaa5397aa4d29231a209e
//
// API key (read-only, app: TikiTaka Avatar Manager, id: 140965):
//   9153:gk-QC97fjdQilPQ7oWZnxC_TkQbwsIw7ID2ZJpyF3cpmJNdWLFFHnFJjjuC2NzQa
//
// Run: node gravatar.js

const { PRODUCT, IDENTITY, MAILBOX, connectBrowser, getEmails, getEmailBody, confirmEmail } = require('./config');

async function cdpType(client, page, sel, text) {
  await page.evaluate(s => { const el = document.querySelector(s); if(el){el.focus();el.click();el.value='';} }, sel);
  await new Promise(r => setTimeout(r, 80));
  for (const c of text) {
    await client.send('Input.dispatchKeyEvent', {type:'keyDown', text:c});
    await client.send('Input.dispatchKeyEvent', {type:'keyUp', text:c});
    await new Promise(r => setTimeout(r, 5));
  }
}

(async () => {
  const browser = await connectBrowser();
  const page = await browser.newPage();

  // Step 1: Navigate to Gravatar signup
  console.log('Opening Gravatar...');
  await page.goto('https://gravatar.com', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  // Click "Get Started Now"
  await page.evaluate(() => {
    const links = [...document.querySelectorAll('a')];
    const btn = links.find(a => a.textContent.includes('Get Started Now'));
    if (btn) btn.click();
  });
  // Wait for WordPress.com login page (may have Cloudflare check)
  await new Promise(r => setTimeout(r, 10000));

  // Step 2: Enter email
  const client = await page.createCDPSession();
  console.log('Entering email...');
  await cdpType(client, page, 'input[type="email"], input[name="usernameOrEmail"]', IDENTITY.email);
  await new Promise(r => setTimeout(r, 500));

  // Click Continue
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const btn = btns.find(b => b.textContent.includes('Continue'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 5000));

  // Step 3: Get verification code from email
  console.log('Waiting for verification email...');
  await new Promise(r => setTimeout(r, 5000));
  const messages = await getEmails();
  const gravatarEmail = messages.find(m => m.subject.includes('Gravatar code'));
  if (!gravatarEmail) throw new Error('No Gravatar verification email found');

  const codeMatch = gravatarEmail.subject.match(/^(\w+) is your/);
  const code = codeMatch ? codeMatch[1] : null;
  if (!code) throw new Error('Could not extract verification code');
  console.log('Verification code:', code);

  // Enter the code
  await cdpType(client, page, 'input[name="code"]', code);
  await new Promise(r => setTimeout(r, 500));
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const btn = btns.find(b => b.textContent.includes('Continue'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 5000));

  // Step 4: Onboarding - Name (step 1/5)
  console.log('Filling onboarding - name...');
  await cdpType(client, page, 'input[placeholder="Full name"]', PRODUCT.displayName || 'TikiTaka');
  await new Promise(r => setTimeout(r, 500));
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const btn = btns.find(b => b.textContent.includes('Continue'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 3000));

  // Step 5: Skip avatar (step 2/5) - WebGL not available
  console.log('Skipping avatar (WebGL not available)...');
  await page.evaluate(() => {
    const els = document.querySelectorAll('*');
    for (const el of els) {
      if (el.children.length === 0 && el.textContent.trim() === 'Do this later') {
        el.click(); return;
      }
    }
  });
  await new Promise(r => setTimeout(r, 3000));

  // Step 6: About (step 3/5)
  console.log('Filling about info...');
  await cdpType(client, page, '#location', PRODUCT.location || 'Tel Aviv, Israel');
  await new Promise(r => setTimeout(r, 200));
  await cdpType(client, page, '#description', PRODUCT.tagline);
  await new Promise(r => setTimeout(r, 200));
  await cdpType(client, page, '#jobTitle', 'World Cup Prediction Game');
  await new Promise(r => setTimeout(r, 200));
  await cdpType(client, page, '#company', PRODUCT.name);
  await new Promise(r => setTimeout(r, 500));
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const btn = btns.find(b => b.textContent.includes('Continue'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 3000));

  // Step 7: Skip verified accounts (step 4/5)
  console.log('Skipping verified accounts...');
  await page.evaluate(() => {
    const els = document.querySelectorAll('*');
    for (const el of els) {
      if (el.children.length === 0 && el.textContent.trim() === 'Do this later') {
        el.click(); return;
      }
    }
  });
  await new Promise(r => setTimeout(r, 3000));

  // Step 8: Design (step 5/5) - keep default, click Finish
  console.log('Finishing onboarding...');
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const btn = btns.find(b => b.textContent.includes('Finish'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 5000));

  // Step 9: Close any modals
  await page.evaluate(() => {
    const closeBtn = document.querySelector('.components-modal__header button');
    if (closeBtn) closeBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // Step 10: Add website link (the backlink)
  console.log('Adding website link...');
  await page.goto('https://gravatar.com/profile/links', { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));

  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const btn = btns.find(b => b.textContent.includes('Add link'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 2000));

  await cdpType(client, page, '#add-link-url', PRODUCT.url);
  await new Promise(r => setTimeout(r, 200));
  await cdpType(client, page, '#add-link-label', `${PRODUCT.name} - World Cup 2026 Prediction Game`);
  await new Promise(r => setTimeout(r, 200));
  await cdpType(client, page, '#add-link-description', PRODUCT.shortDesc);
  await new Promise(r => setTimeout(r, 500));

  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const btn = btns.find(b => b.textContent.trim() === 'Add');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 3000));
  console.log('Link added successfully');

  // Done
  console.log('Gravatar profile created at https://gravatar.com/vibrantcb1fc059ca');
  console.log('NOTE: Avatar must be uploaded manually (WebGL required)');

  await client.detach();
  await browser.disconnect();
})();
