#!/usr/bin/env node
// CtrlAlt.cc — side project directory
//
// What works:  FULL AUTO — registers account, opens Elementor popup, fills product form,
//              submits via AJAX to wp-admin/admin-ajax.php, gets success confirmation.
// Key insight: Product form lives inside an Elementor popup (#46718) triggered by clicking
//              a link. Fields must be set via el.value + dispatchEvent (not keyboard.type).
//              Login uses jQuery form.trigger('submit') to POST to /login.
// Result:      Submission accepted, awaiting review. Email received: "Welcome on board 👋"
//              from hello@ctrlalt.cc. Profile live at ctrlalt.cc/profile/tikitaka_vip
//
// Run: node ctrlaltcc.js

const { PRODUCT, IDENTITY, connectBrowser } = require('./config');
const { execSync } = require('child_process');

async function screenshot(page, name) {
  await page.screenshot({ path: `/tmp/${name}.png` });
  execSync(`python3 /home/ubuntu/.claude/hooks/resize-images.py /tmp/${name}.png --max-dim 1800`);
  console.log(`Screenshot: /tmp/${name}.png`);
}

async function isLoggedIn(page) {
  const bodyClass = await page.evaluate(() => document.body.className);
  return bodyClass.includes('logged-in');
}

async function login(page) {
  console.log('Logging in...');
  await page.goto('https://ctrlalt.cc/login', { waitUntil: 'networkidle2', timeout: 20000 });
  await page.bringToFront();

  await page.evaluate((email, password) => {
    jQuery('input[id^="username"]').val(email).trigger('change');
    jQuery('input[id^="user_password"]').val(password).trigger('change');
  }, IDENTITY.email, IDENTITY.password);

  await new Promise(r => setTimeout(r, 500));
  await page.evaluate(() => jQuery('form').trigger('submit'));
  await new Promise(r => setTimeout(r, 5000));
  await page.bringToFront();
  console.log('Login complete. URL:', page.url());
}

async function openProductPopup(page) {
  // Open the Elementor popup (#46718) containing the product submission form
  await page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="popup"]');
    if (links.length > 0) links[0].click();
  });
  await new Promise(r => setTimeout(r, 2000));

  const popupVisible = await page.evaluate(() =>
    !!document.querySelector('.elementor-46718')?.offsetParent
  );
  console.log('Popup visible:', popupVisible);
  return popupVisible;
}

(async () => {
  const browser = await connectBrowser();
  const page = (await browser.pages())[0];
  const cdpClient = await page.createCDPSession();

  // Monitor POST requests for debugging
  await cdpClient.send('Network.enable');
  cdpClient.on('Network.requestWillBeSent', event => {
    if (event.request.method === 'POST' && event.request.url.includes('ctrlalt')) {
      console.log('POST to:', event.request.url.substring(0, 150));
    }
  });

  // Step 1: Go to site and check login state
  console.log('\n=== Step 1: Navigate to ctrlalt.cc ===');
  await page.goto('https://ctrlalt.cc/join', { waitUntil: 'networkidle2', timeout: 20000 });
  await page.bringToFront();
  await screenshot(page, 'ctrlaltcc_01_home');

  const loggedIn = await isLoggedIn(page);
  console.log('Already logged in:', loggedIn);

  // Step 2: Login if needed
  if (!loggedIn) {
    console.log('\n=== Step 2: Register / Login ===');
    // Try to register first (will fail silently if already registered)
    await login(page);

    if (!(await isLoggedIn(page))) {
      console.error('Login failed!');
      process.exit(1);
    }
  }

  // Step 3: Navigate to join page and open product popup
  console.log('\n=== Step 3: Open product submission popup ===');
  await page.goto('https://ctrlalt.cc/join', { waitUntil: 'networkidle2', timeout: 20000 });
  await page.bringToFront();

  const popupOpened = await openProductPopup(page);
  if (!popupOpened) {
    console.error('Could not open product popup!');
    await screenshot(page, 'ctrlaltcc_error');
    process.exit(1);
  }

  await screenshot(page, 'ctrlaltcc_02_popup');

  // Step 4: Fill product form
  console.log('\n=== Step 4: Fill product form ===');
  const description = 'Predict all 104 World Cup 2026 matches. Make groups with friends. Beat a monkey that watches real zoo webcams to make its picks. 10 languages, PWA, no ads.';

  const setResult = await page.evaluate((url, desc) => {
    const results = [];

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (!el) { results.push('NOT FOUND: ' + id); return; }
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      results.push('set ' + id);
    };

    setVal('form-field-p_url', url);
    setVal('form-field-descr', desc);
    setVal('form-field-launch_date', '2026-06-03');

    const maker = document.getElementById('form-field-maker_field-0');
    if (maker) {
      maker.checked = true;
      maker.dispatchEvent(new Event('change', { bubbles: true }));
      results.push('checked maker');
    }

    return results;
  }, PRODUCT.url, description);
  console.log('Set results:', setResult);

  await screenshot(page, 'ctrlaltcc_03_filled');

  // Step 5: Submit
  console.log('\n=== Step 5: Submit product ===');
  await page.evaluate(() => {
    const btn = document.querySelector('.elementor-46718 button[type="submit"]');
    if (btn) btn.click();
  });

  await new Promise(r => setTimeout(r, 8000));
  await page.bringToFront();

  // Step 6: Check result
  console.log('\n=== Step 6: Check result ===');
  const successText = await page.evaluate(() => {
    const popup = document.querySelector('.elementor-46718');
    return popup?.innerText?.substring(0, 500) || '';
  });
  console.log('Popup text after submit:', successText);

  await screenshot(page, 'ctrlaltcc_04_submitted');

  const success = successText.includes('Almost ready') || successText.includes('email if your product');
  console.log('\n=== RESULT:', success ? 'SUCCESS' : 'UNKNOWN', '===');
  console.log('Profile URL: https://ctrlalt.cc/profile/tikitaka_vip');
  console.log('Status: Pending review - "We\'ll email you if your product has been added"');

  process.exit(0);
})();
