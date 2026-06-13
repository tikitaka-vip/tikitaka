/**
 * Quora registration script for tikitaka.vip
 *
 * Registration flow:
 * 1. Go to quora.com - click "Sign up with email"
 * 2. Fill name (Tiki Taka), email, password
 * 3. Turnstile auto-solves (Cloudflare)
 * 4. Click Next -> get email verification code
 * 5. Enter code from inbox
 * 6. Password page with reCAPTCHA -> needs MANUAL solve
 * 7. After reCAPTCHA -> skip onboarding -> set up profile
 *
 * BLOCKER: Step 6 requires manual reCAPTCHA image challenge solve.
 * Telegram notification sent. Browser currently at:
 * https://www.quora.com/?prevent_redirect=1
 * Page: "Sign up - Password - I'm not a robot - Finish"
 *
 * To resume: run quora_resume.js after solving reCAPTCHA.
 *
 * Account credentials:
 * Email: tikitaka.vip@aiemailservice.com
 * Password: TK!v1p_2026WC#secure
 * Name: Tiki Taka
 * Bio: Creator of TikiTaka, a free World Cup 2026 prediction game at https://tikitaka.vip
 */

const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');

const NODE_MODULES = '/tmp/node_modules';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function screenshot(page, path) {
  return page.screenshot({ path }).then(() => {
    try { execSync(`python3 /home/ubuntu/.claude/hooks/resize-images.py ${path} --max-dim 1800`); } catch(e) {}
    console.log('Screenshot:', path);
  }).catch(e => console.log('Screenshot error:', e.message));
}

async function getLatestQuoraCode() {
  try {
    const res = execSync(
      'curl -s "https://aiemailservice.com/v1/mailbox/mbx_de7d0e26018b4364/messages" -H "x-api-key: ak_c026ce1fe7164b70ab96f5d013761341"',
      { timeout: 15000 }
    ).toString();
    const emails = JSON.parse(res);
    const quoraEmails = emails
      .filter(e => e.from && e.from.toLowerCase().includes('quora'))
      .sort((a, b) => b.received_at.localeCompare(a.received_at));

    if (quoraEmails.length === 0) return null;
    const latest = quoraEmails[0];

    // Extract 6-digit code
    if (latest.extracted_codes) {
      const code = latest.extracted_codes.find(c => /^\d{6}$/.test(c));
      if (code) return code;
    }
    if (latest.preview) {
      const match = latest.preview.match(/\b(\d{6})\b/);
      if (match) return match[1];
    }
  } catch(e) {
    console.log('Email error:', e.message);
  }
  return null;
}

async function fillSignupForm(page) {
  // Click "Sign up with email"
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(el => el.textContent.trim().toLowerCase().includes('sign up with email'));
    if (btn) btn.click();
  });
  await sleep(2000);

  // Get field coordinates
  const fields = await page.evaluate(() =>
    Array.from(document.querySelectorAll('input')).filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && el.type !== 'hidden';
    }).map(el => {
      const r = el.getBoundingClientRect();
      return { type: el.type, name: el.name, x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })
  );

  // Fill name
  const nameField = fields.find(f => f.name === 'profile-name');
  if (nameField) {
    await page.mouse.click(nameField.x, nameField.y);
    await sleep(100);
    await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
    await page.keyboard.type('Tiki Taka', { delay: 60 });
  }
  await sleep(200);

  // Fill email
  const emailField = fields.find(f => f.type === 'email');
  if (emailField) {
    await page.mouse.click(emailField.x, emailField.y);
    await sleep(100);
    await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
    await page.keyboard.type('tikitaka.vip@aiemailservice.com', { delay: 60 });
  }
  await sleep(200);

  // Fill password
  const pwField = fields.find(f => f.type === 'password');
  if (pwField) {
    await page.mouse.click(pwField.x, pwField.y);
    await sleep(100);
    await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
    await page.keyboard.type('TK!v1p_2026WC#secure', { delay: 60 });
  }

  // Wait for Turnstile auto-solve
  console.log('Waiting for Turnstile...');
  await sleep(8000);

  const tsVal = await page.evaluate(() => {
    const i = document.querySelector('input[name="cf-turnstile-response"]');
    return i ? i.value.length > 0 : false;
  });
  console.log('Turnstile solved:', tsVal);

  // Click Next
  const nextInfo = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && el.textContent.trim().toLowerCase() === 'next';
    });
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (nextInfo) {
    await page.mouse.click(nextInfo.x, nextInfo.y);
    console.log('Clicked Next');
  }

  await sleep(5000);
}

async function enterVerificationCode(page, code) {
  const codeInput = await page.evaluate(() => {
    const el = document.querySelector('#confirmation-code, input[name="confirmationCode"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });

  if (!codeInput) {
    console.log('Code input not found');
    return false;
  }

  await page.mouse.click(codeInput.x, codeInput.y);
  await sleep(200);
  await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
  await page.keyboard.type(code, { delay: 100 });
  console.log('Code entered:', code);

  // Click Next
  const nextInfo = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && el.textContent.trim().toLowerCase() === 'next';
    });
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (nextInfo) {
    await page.mouse.click(nextInfo.x, nextInfo.y);
    console.log('Code Next clicked');
  } else {
    await page.keyboard.press('Enter');
  }

  await sleep(5000);
  return true;
}

async function setupProfile(page) {
  console.log('Setting up profile...');
  await page.goto('https://www.quora.com/settings/profile', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.bringToFront();
  await sleep(4000);

  const title = await page.title();
  if (title === 'Error' || page.url().includes('login')) {
    console.log('Not logged in to settings');
    return null;
  }

  // Get textarea for bio
  const bioCoords = await page.evaluate(() => {
    const ta = document.querySelector('textarea');
    if (!ta) return null;
    const r = ta.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });

  if (bioCoords) {
    await page.mouse.click(bioCoords.x, bioCoords.y);
    await sleep(200);
    await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
    await page.keyboard.type('Creator of TikiTaka, a free World Cup 2026 prediction game at https://tikitaka.vip', { delay: 20 });
    console.log('Bio filled');
  }

  await sleep(1000);

  // Save
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && (el.type === 'submit' || el.textContent.toLowerCase().includes('save'));
    });
    if (btn) btn.click();
  });

  await sleep(3000);
  console.log('Profile saved. URL:', page.url());

  // Get profile URL
  const profileLinks = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href*="/profile/"]')).map(l => l.href)
  );

  return profileLinks.length > 0 ? profileLinks[0] : page.url();
}

async function main() {
  const browser = await puppeteer.connect({
    browserURL: 'http://localhost:9222',
    defaultViewport: null,
    protocolTimeout: 120000
  });

  const page = (await browser.pages())[0];
  page.on('dialog', async d => { console.log('Dialog:', d.message()); await d.accept(); });

  // Step 1: Navigate to Quora
  console.log('Navigating to Quora...');
  await page.goto('https://www.quora.com/?prevent_redirect=1', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.bringToFront();
  await sleep(3000);
  await screenshot(page, '/tmp/quora_step1.png');

  // Check if already logged in
  const content = await page.evaluate(() => document.body ? document.body.innerText.substring(0, 200) : '');
  if (!content.includes('Sign up') && !content.includes('Login')) {
    console.log('Already logged in!');
    const profileUrl = await setupProfile(page);
    console.log('Profile URL:', profileUrl);
    return profileUrl;
  }

  // Step 2: Fill signup form
  console.log('Filling signup form...');
  await fillSignupForm(page);
  await screenshot(page, '/tmp/quora_step2.png');

  // Step 3: Enter verification code
  const pageContent = await page.evaluate(() => document.body ? document.body.innerText.substring(0, 300) : '');
  if (pageContent.includes('Confirm your email')) {
    console.log('Email verification required...');
    await sleep(3000);

    let code = null;
    for (let i = 0; i < 6; i++) {
      code = await getLatestQuoraCode();
      if (code) break;
      console.log(`Waiting for code (attempt ${i + 1})...`);
      await sleep(8000);
    }

    if (code) {
      await enterVerificationCode(page, code);
      await screenshot(page, '/tmp/quora_step3.png');
    } else {
      console.log('No verification code received');
    }
  }

  // Step 4: Handle password + reCAPTCHA page
  const step4Content = await page.evaluate(() => document.body ? document.body.innerText.substring(0, 200) : '');
  if (step4Content.includes('Finish') || step4Content.includes('Password')) {
    console.log('On Finish/reCAPTCHA page...');

    // Fill password
    const pwCoords = await page.evaluate(() => {
      const el = document.querySelector('input[type="password"]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, val: el.value };
    });

    if (pwCoords && !pwCoords.val) {
      await page.mouse.click(pwCoords.x, pwCoords.y);
      await sleep(100);
      await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
      await page.keyboard.type('TK!v1p_2026WC#secure', { delay: 60 });
      console.log('Password filled');
    }

    // reCAPTCHA requires manual solve
    console.log('reCAPTCHA must be solved manually!');
    console.log('Please solve the image challenge in the browser and click Finish');
    try {
      execSync(
        'curl -s "https://api.telegram.org/bot8445371320:AAE4YLFNtHH8jZx_NJgxbep9C0E7Z8RwP1c/sendMessage" -d chat_id=6674342664 -d text="Quora reCAPTCHA needs solve - browser at quora.com, click I\'m not a robot, solve image, click Finish"',
        { timeout: 10000 }
      );
    } catch(e) {}

    // Wait up to 10 minutes for manual solve
    for (let i = 0; i < 120; i++) {
      await sleep(5000);
      const url = page.url();
      const cnt = await page.evaluate(() => document.body ? document.body.innerText.substring(0, 200) : '').catch(() => '');
      if (!cnt.includes('Sign up') || url.includes('/feed') || url.includes('/home')) {
        console.log('reCAPTCHA solved! Continuing...');
        break;
      }
      if (i % 12 === 0) console.log(`Waiting for reCAPTCHA... ${i * 5}s`);
    }
  }

  // Step 5: Skip onboarding
  for (let i = 0; i < 10; i++) {
    await sleep(2000);
    const skipped = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('button, a'));
      const skip = all.find(el => {
        const r = el.getBoundingClientRect();
        const t = el.textContent.trim().toLowerCase();
        return r.width > 0 && (t === 'skip' || t === 'skip for now' || t === 'done');
      });
      if (skip) { skip.click(); return skip.textContent.trim(); }
      return null;
    });
    if (skipped) console.log('Skipped:', skipped);
    else break;
  }

  // Step 6: Set up profile
  const profileUrl = await setupProfile(page);
  console.log('Profile URL:', profileUrl);

  await screenshot(page, '/tmp/quora_final.png');
  return profileUrl;
}

main()
  .then(url => {
    console.log('SUCCESS! Profile URL:', url);
    process.exit(0);
  })
  .catch(err => {
    console.error('ERROR:', err.message);
    process.exit(1);
  });
