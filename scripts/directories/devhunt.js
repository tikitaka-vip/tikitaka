/**
 * DevHunt submission script for TikiTaka
 * https://devhunt.org
 * Auth: GitHub (tikitaka-vip)
 *
 * STATUS: Blocked — tikitaka-vip GitHub password is wrong.
 * Run this script AFTER resetting the GitHub password to TK!v1p_2026WC#secure via:
 *   https://github.com/password_reset (use tikitaka.vip@aiemailservice.com)
 *
 * Usage: node devhunt.js  (from /tmp to get puppeteer-core)
 */
const puppeteer = require('/tmp/node_modules/puppeteer-core');
const path = require('path');

const GITHUB_USERNAME = 'tikitaka-vip';
const GITHUB_PASSWORD = 'TK!v1p_2026WC#secure';

const PRODUCT = {
  name: 'TikiTaka',
  url: 'https://tikitaka.vip',
  tagline: 'Free World Cup 2026 prediction game with a monkey competitor',
  description: 'Predict all 104 World Cup matches. Make groups with friends. Try to beat a monkey that watches real zoo webcams to make its picks. 10 languages, PWA, no ads.',
  logo: '/home/ubuntu/projects/worldcup/brand/logo-icon.png',
};

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

async function screenshot(page, name) {
  const p = `/tmp/${name}.png`;
  await page.screenshot({ path: p, fullPage: false });
  require('child_process').execSync(
    `python3 /home/ubuntu/.claude/hooks/resize-images.py ${p} --max-dim 1800`
  );
  console.log(`[screenshot] ${name}.png`);
  return p;
}

async function waitForNav(page, timeout = 10000) {
  try {
    await page.waitForNavigation({ timeout, waitUntil: 'networkidle2' });
  } catch (e) { /* timeout ok */ }
}

(async () => {
  const browser = await puppeteer.connect({
    browserURL: 'http://localhost:9222',
    defaultViewport: null
  });
  const page = (await browser.pages())[0];
  const client = await page.createCDPSession();

  // Step 1: Go to DevHunt login
  console.log('\n=== Step 1: DevHunt login ===');
  await page.goto('https://devhunt.org/login', { waitUntil: 'networkidle2', timeout: 20000 });
  await page.bringToFront();
  await new Promise(r => setTimeout(r, 1500));
  await screenshot(page, 'dh1_login');

  // Click Continue with Github
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('a, button'));
    const gh = btns.find(el => /github/i.test(el.textContent));
    if (gh) gh.click();
  });
  await new Promise(r => setTimeout(r, 3000));
  await screenshot(page, 'dh2_after_gh_click');
  console.log('URL:', page.url());

  // Step 2: GitHub login
  if (page.url().includes('github.com')) {
    console.log('\n=== Step 2: GitHub login ===');

    // Check if authorize page (already logged in)
    const authorizeBtn = await page.$('#js-oauth-authorize-btn');
    if (authorizeBtn) {
      console.log('Already logged into GitHub — clicking authorize');
      await authorizeBtn.click();
      await waitForNav(page, 8000);
    } else {
      // Need to log in
      const loginField = await page.$('#login_field');
      if (loginField) {
        console.log('Filling GitHub credentials');

        await page.focus('#login_field');
        await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
        await page.keyboard.press('Delete');
        await page.keyboard.type(GITHUB_USERNAME, { delay: 60 });

        await page.focus('#password');
        await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
        await page.keyboard.press('Delete');
        await client.send('Input.insertText', { text: GITHUB_PASSWORD });

        await screenshot(page, 'dh3_gh_filled');
        await page.keyboard.press('Enter');
        await new Promise(r => setTimeout(r, 6000));
        console.log('URL after GH login:', page.url());
        await screenshot(page, 'dh4_gh_after');

        // Handle 2FA if needed
        if (page.url().includes('two-factor') || page.url().includes('2fa')) {
          console.error('2FA required — cannot proceed automatically');
          process.exit(1);
        }

        // Authorize DevHunt
        const authBtn = await page.$('#js-oauth-authorize-btn, [name="authorize"]');
        if (authBtn) {
          console.log('Clicking authorize');
          await authBtn.click();
          await waitForNav(page, 8000);
        }
      }
    }
    await screenshot(page, 'dh5_after_github');
    console.log('URL after GitHub:', page.url());
  }

  // Step 3: Back on DevHunt — go to submit form
  console.log('\n=== Step 3: Submit product ===');
  await new Promise(r => setTimeout(r, 2000));

  if (!page.url().includes('devhunt.org')) {
    await page.goto('https://devhunt.org', { waitUntil: 'networkidle2', timeout: 20000 });
    await page.bringToFront();
  }

  // Navigate to submit form
  await page.goto('https://devhunt.org/tool/new', { waitUntil: 'networkidle2', timeout: 15000 });
  await page.bringToFront();
  await new Promise(r => setTimeout(r, 2000));
  await screenshot(page, 'dh6_submit_form');
  console.log('Submit form URL:', page.url());

  // Step 4: Fill the form
  console.log('\n=== Step 4: Fill form ===');

  // Log all form fields
  const fields = await page.evaluate(() =>
    Array.from(document.querySelectorAll('input, textarea, select'))
      .map(el => ({ tag: el.tagName, name: el.name, id: el.id, placeholder: el.placeholder, type: el.type }))
  );
  console.log('Form fields:', JSON.stringify(fields));

  // Fill product name
  for (const sel of ['input[name="name"]', 'input[name="title"]', 'input[id*="name" i]', 'input[placeholder*="name" i]', 'input[placeholder*="product" i]']) {
    if (await page.$(sel)) { await cdpType(client, page, sel, PRODUCT.name); console.log('Name filled:', sel); break; }
  }

  // Fill URL
  for (const sel of ['input[name="url"]', 'input[name="website"]', 'input[name="link"]', 'input[type="url"]', 'input[placeholder*="url" i]']) {
    if (await page.$(sel)) { await cdpType(client, page, sel, PRODUCT.url); console.log('URL filled:', sel); break; }
  }

  // Fill tagline
  for (const sel of ['input[name="tagline"]', 'input[name="headline"]', 'input[name="slogan"]', 'input[placeholder*="tagline" i]', 'input[placeholder*="short" i]']) {
    if (await page.$(sel)) { await cdpType(client, page, sel, PRODUCT.tagline); console.log('Tagline filled:', sel); break; }
  }

  // Fill description
  for (const sel of ['textarea[name="description"]', 'textarea[name="about"]', 'textarea[id*="description" i]', 'textarea']) {
    if (await page.$(sel)) { await cdpType(client, page, sel, PRODUCT.description); console.log('Description filled:', sel); break; }
  }

  // Upload logo
  const fileInput = await page.$('input[type="file"]');
  if (fileInput) {
    await fileInput.uploadFile(PRODUCT.logo);
    console.log('Logo uploaded');
    await new Promise(r => setTimeout(r, 2000));
  }

  await screenshot(page, 'dh7_form_filled');

  // Step 5: Submit
  console.log('\n=== Step 5: Submit ===');
  const submitText = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button[type="submit"], input[type="submit"], button'));
    const btn = btns.find(el => /submit|launch|publish|add|create|save/i.test(el.textContent?.trim()));
    if (btn) { btn.click(); return btn.textContent?.trim(); }
    return null;
  });
  console.log('Submitted via:', submitText);

  await waitForNav(page, 10000);
  await new Promise(r => setTimeout(r, 3000));
  await screenshot(page, 'dh8_result');

  const finalUrl = page.url();
  const finalText = await page.evaluate(() => document.body.innerText.substring(0, 400));
  console.log('\n=== RESULT ===');
  console.log('Final URL:', finalUrl);
  console.log('Page text:', finalText);

  await client.detach();
  await browser.disconnect();
})().catch(err => {
  console.error('Error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
