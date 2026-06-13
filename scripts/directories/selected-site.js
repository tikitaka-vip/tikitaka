// selected-site.js — Submit TikiTaka to selected.site
//
// Status: Account registered & email confirmed. Submissions PAUSED site-wide
//         ("Submissions are temporarily unavailable — Link submission is currently paused.")
//         Retry periodically — the submit form may reopen.
//
// What works:
//   - Signup via email/password (Supabase auth)
//   - Email confirmation link auto-extracted and visited
//   - Login persists via cookies
//
// What breaks / blocks:
//   - /submit/ page shows "Submissions are temporarily unavailable" — no form rendered
//   - No alternative submit path found (the "+" nav button also links to /submit)
//
// Flow: signup → confirm email → navigate to /submit → fill form (when available)

const { PRODUCT, IDENTITY, MAILBOX, connectBrowser, waitForEmail, getEmails, getEmailBody } = require('./config');

async function cdpType(client, page, sel, text) {
  await page.evaluate(s => { const el = document.querySelector(s); if (el) { el.focus(); el.click(); el.value = ''; } }, sel);
  await new Promise(r => setTimeout(r, 80));
  for (const c of text) {
    await client.send('Input.dispatchKeyEvent', { type: 'keyDown', text: c });
    await client.send('Input.dispatchKeyEvent', { type: 'keyUp', text: c });
    await new Promise(r => setTimeout(r, 5));
  }
}

async function run() {
  const browser = await connectBrowser();
  const pages = await browser.pages();
  const page = pages[0] || await browser.newPage();
  const client = await page.createCDPSession();

  // Step 1: Go to submit page (checks if submissions are open)
  await page.goto('https://selected.site/submit/', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  const bodyText = await page.evaluate(() => document.body.innerText);

  // Check if submissions are paused
  if (bodyText.includes('temporarily unavailable') || bodyText.includes('currently paused')) {
    console.log('ERROR: Submissions are temporarily unavailable on selected.site');
    console.log('Account is registered — retry submission later.');
    return { status: 'submissions-paused', message: 'Submissions temporarily unavailable' };
  }

  // Check if we need to log in
  if (bodyText.includes('Welcome back') || bodyText.includes('Create an account') || bodyText.includes('Sign In')) {
    console.log('Need to sign up / log in...');

    // Try signup first
    await page.goto('https://selected.site/auth?mode=signup', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    const isSignup = await page.evaluate(() => document.body.innerText.includes('Create an account'));

    if (isSignup) {
      await cdpType(client, page, '#username', IDENTITY.username);
      await new Promise(r => setTimeout(r, 300));
      await cdpType(client, page, '#email', IDENTITY.email);
      await new Promise(r => setTimeout(r, 300));
      await cdpType(client, page, '#password', IDENTITY.password);
      await new Promise(r => setTimeout(r, 500));

      // Click Sign Up
      await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button')];
        const signup = btns.find(b => b.textContent.trim() === 'Sign Up');
        if (signup) signup.click();
      });
      await new Promise(r => setTimeout(r, 5000));

      // Wait for confirmation email
      console.log('Waiting for confirmation email...');
      const emails = await getEmails();
      const confirmEmail = emails.find(e => e.subject && e.subject.includes('Confirm') && e.from.includes('selected.site'));

      if (confirmEmail) {
        const confirmUrl = confirmEmail.extracted_codes.find(c => c.includes('supabase') && c.includes('verify'));
        if (confirmUrl) {
          await page.goto(confirmUrl, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 5000));
          console.log('Email confirmed!');
        }
      }
    } else {
      // Login
      await page.goto('https://selected.site/auth?mode=login', { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 2000));
      await cdpType(client, page, '#email', IDENTITY.email);
      await new Promise(r => setTimeout(r, 300));
      await cdpType(client, page, '#password', IDENTITY.password);
      await new Promise(r => setTimeout(r, 500));
      await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button')];
        const signin = btns.find(b => b.textContent.trim() === 'Sign In');
        if (signin) signin.click();
      });
      await new Promise(r => setTimeout(r, 5000));
    }

    // Navigate back to submit
    await page.goto('https://selected.site/submit/', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    const bodyText2 = await page.evaluate(() => document.body.innerText);
    if (bodyText2.includes('temporarily unavailable') || bodyText2.includes('currently paused')) {
      console.log('ERROR: Submissions are temporarily unavailable');
      return { status: 'submissions-paused', message: 'Submissions temporarily unavailable' };
    }
  }

  // Step 2: Fill the submit form (when available)
  // Form fields are unknown since submissions are paused — adjust selectors when form is live
  console.log('Submit form is available! Filling...');

  // Common fields expected: name/title, URL, description, tags, category, logo upload
  // These selectors are guesses based on typical patterns — verify when form reopens
  const formFields = [
    { sel: 'input[name="name"], input[name="title"], input[placeholder*="name" i]', value: PRODUCT.name },
    { sel: 'input[name="url"], input[name="link"], input[placeholder*="url" i], input[type="url"]', value: PRODUCT.url },
    { sel: 'textarea[name="description"], textarea[name="tagline"], textarea[placeholder*="description" i]', value: PRODUCT.tagline },
  ];

  for (const field of formFields) {
    const exists = await page.evaluate(s => !!document.querySelector(s), field.sel);
    if (exists) {
      await cdpType(client, page, field.sel, field.value);
      await new Promise(r => setTimeout(r, 300));
      console.log(`Filled: ${field.sel}`);
    }
  }

  // Try to upload logo if file input exists
  const hasFileInput = await page.evaluate(() => !!document.querySelector('input[type="file"]'));
  if (hasFileInput) {
    const fileInput = await page.$('input[type="file"]');
    await fileInput.uploadFile(PRODUCT.logoPath);
    console.log('Uploaded logo');
    await new Promise(r => setTimeout(r, 2000));
  }

  // Submit
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const submit = btns.find(b => /submit/i.test(b.textContent));
    if (submit) submit.click();
  });
  await new Promise(r => setTimeout(r, 5000));

  await page.screenshot({ path: '/tmp/selected-site-result.png', fullPage: false });
  console.log('Done! Screenshot saved to /tmp/selected-site-result.png');
  return { status: 'submitted' };
}

run().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
