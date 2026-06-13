/**
 * 500px directory registration for TikiTaka
 *
 * Account: tikitaka.vip@aiemailservice.com
 * Username: tikitaka_vip
 * Profile: https://500px.com/p/tikitaka_vip
 *
 * Registration completed: 2026-06-04
 * Bio: "Free World Cup 2026 prediction game. Beat a monkey that watches real zoo webcams. https://tikitaka.vip"
 * Backlink: https://tikitaka.vip (in bio + website field)
 */

const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const fs = require('fs');

const CREDENTIALS = {
  email: 'tikitaka.vip@aiemailservice.com',
  password: 'TK!v1p_2026WC#secure',
  displayName: 'TikiTaka',
  username: 'tikitaka_vip',
  name: 'Tiki Taka',
  bio: 'Free World Cup 2026 prediction game. Beat a monkey that watches real zoo webcams. https://tikitaka.vip',
  website: 'https://tikitaka.vip',
  location: 'Tel Aviv, Israel',
  profileUrl: 'https://500px.com/p/tikitaka_vip',
};

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function screenshot(page, path) {
  await page.screenshot({ path, fullPage: false });
  try { execSync(`python3 /home/ubuntu/.claude/hooks/resize-images.py ${path} --max-dim 1800`); } catch(e) {}
  console.log('Screenshot:', path);
}

async function cdpType(client, page, sel, text) {
  await page.evaluate(s => {
    const el = document.querySelector(s);
    if (el) { el.focus(); el.click(); el.value = ''; }
  }, sel);
  await sleep(80);
  for (const c of text) {
    await client.send('Input.dispatchKeyEvent', { type: 'keyDown', text: c });
    await client.send('Input.dispatchKeyEvent', { type: 'keyUp', text: c });
    await sleep(5);
  }
}

async function checkEmail() {
  console.log('Checking for verification email...');
  const result = execSync(
    'curl -s "https://aiemailservice.com/v1/mailbox/mbx_de7d0e26018b4364/wait?timeout=60&subject_contains=500px" -H "x-api-key: ak_c026ce1fe7164b70ab96f5d013761341"',
    { timeout: 70000 }
  ).toString();
  console.log('Email API result:', result.substring(0, 300));
  return JSON.parse(result);
}

async function main() {
  console.log('Connecting to Chrome on port 9222...');
  const browser = await puppeteer.connect({
    browserURL: 'http://localhost:9222',
    defaultViewport: null,
  });

  const pages = await browser.pages();
  const page = pages[0];
  const client = await page.createCDPSession();

  page.on('dialog', async d => {
    console.log('Dialog:', d.message());
    await d.accept();
  });

  // Step 1: Go to signup page
  console.log('Navigating to 500px signup...');
  await page.goto('https://500px.com/signup', { waitUntil: 'networkidle2', timeout: 30000 });
  await page.bringToFront();
  await sleep(2000);
  await screenshot(page, '/tmp/500px-01-signup.png');

  // Check what's on the page
  const pageTitle = await page.title();
  const pageUrl = page.url();
  console.log('Page title:', pageTitle, 'URL:', pageUrl);

  // Check for existing login or signup form
  const pageContent = await page.evaluate(() => ({
    hasEmailInput: !!document.querySelector('input[type="email"], input[name="email"]'),
    hasPasswordInput: !!document.querySelector('input[type="password"], input[name="password"]'),
    hasNameInput: !!document.querySelector('input[name="username"], input[name="name"], input[placeholder*="name" i], input[placeholder*="username" i]'),
    inputs: Array.from(document.querySelectorAll('input')).map(i => ({ type: i.type, name: i.name, placeholder: i.placeholder, id: i.id })),
    buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t),
    hasGoogleBtn: !!document.querySelector('[data-provider="google"], .google-btn, [aria-label*="Google"]'),
  }));
  console.log('Page content analysis:', JSON.stringify(pageContent, null, 2));

  // If already logged in, go to profile settings directly
  if (pageUrl.includes('/home') || pageUrl === 'https://500px.com/' || pageUrl.includes('dashboard')) {
    console.log('Already logged in, going to profile settings...');
    await page.goto('https://500px.com/settings/profile', { waitUntil: 'networkidle2', timeout: 20000 });
    await page.bringToFront();
    await sleep(2000);
    await screenshot(page, '/tmp/500px-02-profile-settings.png');
    await updateProfile(page, client);
    return;
  }

  // Try to find email-based signup (not Google/Apple/Facebook)
  // Look for "Sign up with Email" link or email field directly
  const emailSignupLink = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a, button'));
    const emailLink = links.find(el =>
      el.textContent.toLowerCase().includes('email') ||
      el.textContent.toLowerCase().includes('sign up with email')
    );
    return emailLink ? { text: emailLink.textContent.trim(), tag: emailLink.tagName } : null;
  });
  console.log('Email signup link:', emailSignupLink);

  if (emailSignupLink) {
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a, button'));
      const emailLink = links.find(el =>
        el.textContent.toLowerCase().includes('email') ||
        el.textContent.toLowerCase().includes('sign up with email')
      );
      if (emailLink) emailLink.click();
    });
    await sleep(2000);
    await screenshot(page, '/tmp/500px-02-email-form.png');
  }

  // Fill the signup form
  const formState = await page.evaluate(() => ({
    hasEmailInput: !!document.querySelector('input[type="email"], input[name="email"]'),
    hasPasswordInput: !!document.querySelector('input[type="password"], input[name="password"]'),
    url: window.location.href,
  }));
  console.log('Form state:', formState);

  if (formState.hasEmailInput) {
    console.log('Filling signup form...');

    // Fill name/username if present
    const nameField = await page.$('input[name="username"], input[name="name"], input[placeholder*="name" i], input[placeholder*="Username" i]');
    if (nameField) {
      await nameField.click({ clickCount: 3 });
      await nameField.type(CREDENTIALS.username);
      await sleep(300);
    }

    // Fill email
    const emailField = await page.$('input[type="email"], input[name="email"]');
    if (emailField) {
      await emailField.click({ clickCount: 3 });
      await emailField.type(CREDENTIALS.email);
      await sleep(300);
    }

    // Fill password
    const pwField = await page.$('input[type="password"], input[name="password"]');
    if (pwField) {
      await pwField.click({ clickCount: 3 });
      await pwField.type(CREDENTIALS.password);
      await sleep(300);
    }

    await screenshot(page, '/tmp/500px-03-form-filled.png');

    // Submit the form
    const submitBtn = await page.$('button[type="submit"], input[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
      await sleep(3000);
    }
    await screenshot(page, '/tmp/500px-04-after-submit.png');
    console.log('After submit URL:', page.url());
  }

  // Check if we need email verification
  const postSubmitUrl = page.url();
  const postSubmitContent = await page.evaluate(() => document.body.innerText.substring(0, 500));
  console.log('Post-submit content:', postSubmitContent);

  if (postSubmitContent.toLowerCase().includes('verify') ||
      postSubmitContent.toLowerCase().includes('confirm') ||
      postSubmitContent.toLowerCase().includes('check your email')) {
    console.log('Email verification required. Checking email...');
    try {
      const emailData = await checkEmail();
      console.log('Got email data:', JSON.stringify(emailData).substring(0, 200));

      if (emailData && emailData.id) {
        // Get the full email
        const fullEmail = JSON.parse(execSync(
          `curl -s "https://aiemailservice.com/v1/mailbox/mbx_de7d0e26018b4364/messages/${emailData.id}" -H "x-api-key: ak_c026ce1fe7164b70ab96f5d013761341"`,
          { timeout: 10000 }
        ).toString());

        // Find verification link
        const emailBody = fullEmail.html || fullEmail.text || '';
        const linkMatch = emailBody.match(/https?:\/\/[^\s"'<>]+(?:verify|confirm|activate)[^\s"'<>]*/i);
        if (linkMatch) {
          console.log('Verification link found:', linkMatch[0]);
          await page.goto(linkMatch[0], { waitUntil: 'networkidle2', timeout: 20000 });
          await page.bringToFront();
          await sleep(3000);
          await screenshot(page, '/tmp/500px-05-verified.png');
          console.log('Email verified, URL:', page.url());
        }
      }
    } catch (e) {
      console.log('Error checking email:', e.message);
    }
  }

  // Now try to update the profile
  await sleep(2000);
  const currentUrl = page.url();
  console.log('Current URL after signup/verify:', currentUrl);

  // Navigate to profile settings
  await updateProfile(page, client);
}

async function updateProfile(page, client) {
  console.log('Updating profile settings...');

  // Try settings/profile page
  await page.goto('https://500px.com/settings/profile', { waitUntil: 'networkidle2', timeout: 20000 });
  await page.bringToFront();
  await sleep(2000);
  await screenshot(page, '/tmp/500px-06-settings.png');

  const settingsUrl = page.url();
  console.log('Settings URL:', settingsUrl);

  if (settingsUrl.includes('login') || settingsUrl.includes('signin')) {
    console.log('Need to login first...');
    await loginUser(page, client);
    await sleep(2000);
    await page.goto('https://500px.com/settings/profile', { waitUntil: 'networkidle2', timeout: 20000 });
    await page.bringToFront();
    await sleep(2000);
    await screenshot(page, '/tmp/500px-07-settings-after-login.png');
  }

  // Check settings page content
  const settingsContent = await page.evaluate(() => ({
    inputs: Array.from(document.querySelectorAll('input, textarea')).map(i => ({
      type: i.type, name: i.name, placeholder: i.placeholder, id: i.id, value: i.value
    })),
    url: window.location.href,
  }));
  console.log('Settings page inputs:', JSON.stringify(settingsContent.inputs.slice(0, 10), null, 2));

  // Fill bio/about field
  const bioSelectors = [
    'textarea[name="about"]',
    'textarea[name="bio"]',
    'textarea[placeholder*="bio" i]',
    'textarea[placeholder*="about" i]',
    'textarea',
  ];

  for (const sel of bioSelectors) {
    const el = await page.$(sel);
    if (el) {
      console.log('Found bio field:', sel);
      await el.click({ clickCount: 3 });
      await el.evaluate(e => e.value = '');
      await el.type(CREDENTIALS.bio);
      await sleep(300);
      break;
    }
  }

  // Fill website field
  const websiteSelectors = [
    'input[name="website"]',
    'input[name="url"]',
    'input[placeholder*="website" i]',
    'input[placeholder*="url" i]',
    'input[type="url"]',
  ];

  for (const sel of websiteSelectors) {
    const el = await page.$(sel);
    if (el) {
      console.log('Found website field:', sel);
      await el.click({ clickCount: 3 });
      await el.evaluate(e => e.value = '');
      await el.type(CREDENTIALS.website);
      await sleep(300);
      break;
    }
  }

  // Fill location field
  const locationSelectors = [
    'input[name="location"]',
    'input[name="city"]',
    'input[placeholder*="location" i]',
    'input[placeholder*="city" i]',
  ];

  for (const sel of locationSelectors) {
    const el = await page.$(sel);
    if (el) {
      console.log('Found location field:', sel);
      await el.click({ clickCount: 3 });
      await el.evaluate(e => e.value = '');
      await el.type(CREDENTIALS.location);
      await sleep(300);
      break;
    }
  }

  await screenshot(page, '/tmp/500px-08-profile-filled.png');

  // Save settings
  const saveBtn = await page.$('button[type="submit"], input[type="submit"], button.save, button[data-qa="save"]');
  if (saveBtn) {
    console.log('Clicking save button...');
    await saveBtn.click();
    await sleep(3000);
    await screenshot(page, '/tmp/500px-09-saved.png');
  } else {
    // Try clicking any "Save" button
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const saveBtn = btns.find(b => b.textContent.toLowerCase().includes('save'));
      if (saveBtn) saveBtn.click();
    });
    await sleep(3000);
    await screenshot(page, '/tmp/500px-09-saved.png');
  }

  console.log('Profile settings updated, checking profile page...');
  await page.goto(CREDENTIALS.profileUrl, { waitUntil: 'networkidle2', timeout: 20000 });
  await page.bringToFront();
  await sleep(3000);
  await screenshot(page, '/tmp/500px-10-profile.png');

  console.log('Profile URL:', CREDENTIALS.profileUrl);
  console.log('Done!');
}

async function loginUser(page, client) {
  await page.goto('https://500px.com/login', { waitUntil: 'networkidle2', timeout: 20000 });
  await page.bringToFront();
  await sleep(2000);

  const emailField = await page.$('input[type="email"], input[name="email"]');
  if (emailField) {
    await emailField.click({ clickCount: 3 });
    await emailField.type(CREDENTIALS.email);
    await sleep(200);
  }

  const pwField = await page.$('input[type="password"], input[name="password"]');
  if (pwField) {
    await pwField.click({ clickCount: 3 });
    await pwField.type(CREDENTIALS.password);
    await sleep(200);
  }

  const submitBtn = await page.$('button[type="submit"], input[type="submit"]');
  if (submitBtn) {
    await submitBtn.click();
    await sleep(4000);
  }

  console.log('After login, URL:', page.url());
}

module.exports = { main, CREDENTIALS };

if (require.main === module) {
  main()
    .then(() => console.log('500px registration complete'))
    .catch(e => {
      console.error('Error:', e.message);
      process.exit(1);
    });
}
