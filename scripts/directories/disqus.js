// Disqus profile creation — tikitaka_vip
// Status: LIVE — profile created with backlink
// Profile: https://disqus.com/by/tikitaka_vip/ (check actual username)
// Backlink: website field in profile settings
// Notes: Signup requires hCaptcha — needs manual solve (twice during initial setup)
// CDP keyevents work for form fills. Avatar upload works via inputHandle.uploadFile().

const { PRODUCT, IDENTITY, MAILBOX, connectBrowser, waitForEmail, getEmailBody } = require('./config');

async function cdpType(client, page, sel, text) {
  await page.evaluate(s => { const el = document.querySelector(s); if(el){el.focus();el.click();el.value='';} }, sel);
  await new Promise(r => setTimeout(r, 80));
  for (const c of text) {
    await client.send('Input.dispatchKeyEvent', {type:'keyDown', text:c});
    await client.send('Input.dispatchKeyEvent', {type:'keyUp', text:c});
    await new Promise(r => setTimeout(r, 5));
  }
}

async function run() {
  const browser = await connectBrowser();
  const page = await browser.newPage();
  const client = await page.createCDPSession();

  // Step 1: Signup
  await page.goto('https://disqus.com/profile/signup/', { waitUntil: 'networkidle2', timeout: 15000 });
  await cdpType(client, page, 'input[name="display_name"], input[name="name"]', IDENTITY.displayName);
  await cdpType(client, page, 'input[name="email"]', IDENTITY.email);
  await cdpType(client, page, 'input[name="password"]', IDENTITY.password);
  // Check consent boxes
  await page.evaluate(() => {
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => { if (!cb.checked) cb.click(); });
  });
  // MANUAL: solve hCaptcha here, then click signup
  console.log('⚠️  Solve hCaptcha manually, then press Enter');

  // Step 2: Email verification
  const email = await waitForEmail('disqus', 60);
  if (email && email.id) {
    const body = await getEmailBody(email.id);
    const match = body.body?.match(/https:\/\/disqus\.com\/[^\s"<]+verify[^\s"<]*/);
    if (match) {
      const verifyPage = await browser.newPage();
      await verifyPage.goto(match[0], { waitUntil: 'networkidle2', timeout: 15000 });
      await verifyPage.close();
    }
  }

  // Step 3: Profile settings
  await page.goto('https://disqus.com/home/settings/profile/', { waitUntil: 'networkidle2', timeout: 15000 });
  await cdpType(client, page, 'input[name="display_name"]', 'TikiTaka');
  await cdpType(client, page, 'input[name="url"]', PRODUCT.url);
  await cdpType(client, page, 'textarea[name="about"]',
    'Free World Cup 2026 prediction game. Compete against a monkey that watches real zoo webcams to make its picks. Play at tikitaka.vip');
  await cdpType(client, page, 'input[name="location"]', IDENTITY.location);

  // Avatar upload
  const avatarInput = await page.$('input[type="file"]');
  if (avatarInput) await avatarInput.uploadFile(PRODUCT.logoPath || '/home/ubuntu/projects/worldcup/brand/profile-pic.png');

  // Save
  await page.click('button[type="submit"], input[type="submit"]');
  await new Promise(r => setTimeout(r, 3000));

  console.log('Done — check profile at https://disqus.com/by/tikitaka_vip/');
  await page.close();
}

run().catch(console.error);
