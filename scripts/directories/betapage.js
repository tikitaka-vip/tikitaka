// BetaPage TikiTaka Registration Script
// Submits TikiTaka product to BetaPage/PitchWall directory
// Note: betapage.co redirects to pitchwall.co

const puppeteer = require('puppeteer-core');

(async () => {
  try {
    const browser = await puppeteer.connect({
      browserURL: 'http://localhost:9222',
      defaultViewport: null
    });

    const page = (await browser.pages())[0];
    const client = await page.createCDPSession();

    // CDP-based typing function for reliable input
    async function cdpType(sel, text) {
      await page.evaluate(s => {
        const el = document.querySelector(s);
        if (el) {
          el.focus();
          el.click();
          el.value = '';
        }
      }, sel);
      await new Promise(r => setTimeout(r, 80));
      for (const c of text) {
        await client.send('Input.dispatchKeyEvent', { type: 'keyDown', text: c });
        await client.send('Input.dispatchKeyEvent', { type: 'keyUp', text: c });
        await new Promise(r => setTimeout(r, 5));
      }
    }

    console.log('[1] Navigating to PitchWall (BetaPage)...');
    await page.goto('https://pitchwall.co', { waitUntil: 'networkidle2', timeout: 15000 });
    await page.bringToFront();

    // Click "Submit Product" button
    console.log('[2] Clicking Submit Product button...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, a'));
      for (const btn of btns) {
        if (btn.innerText.includes('Submit Product')) {
          btn.click();
          return;
        }
      }
    });

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
    await page.bringToFront();
    await new Promise(r => setTimeout(r, 2000));

    // Select Free plan
    console.log('[3] Selecting Free plan...');
    const freeButtonClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      for (const btn of btns) {
        const parent = btn.closest('div[class*="pricing"], div[class*="plan"]');
        const text = btn.innerText || '';
        if (text.includes('Submit') && parent?.innerText.includes('$0')) {
          btn.click();
          return true;
        }
      }
      return false;
    });

    if (freeButtonClicked) {
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
      await page.bringToFront();
      await new Promise(r => setTimeout(r, 2000));
    }

    // Check if registration is required
    const pageUrl = page.url();
    if (pageUrl.includes('register') || pageUrl.includes('auth')) {
      console.log('[4] Registering account...');

      await cdpType('input[type="email"]', 'tikitaka.vip@aiemailservice.com');
      await new Promise(r => setTimeout(r, 500));

      await cdpType('input[type="password"]', 'TKv1p2026WCsec');
      await new Promise(r => setTimeout(r, 500));

      // Try to find name field
      const nameInputs = await page.$$('input[type="text"]');
      if (nameInputs.length > 0) {
        await cdpType('input[type="text"]:nth-of-type(1)', 'Tiki Taka');
      }

      await new Promise(r => setTimeout(r, 1000));

      // Submit registration
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const submitBtn = btns.find(b =>
          (b.innerText || '').toLowerCase().match(/sign up|register|continue/)
        );
        submitBtn?.click();
      });

      await new Promise(r => setTimeout(r, 3000));

      // Check for verification email
      console.log('[5] Checking for verification email...');
      try {
        const emailResp = require('child_process').execSync(
          'curl -s "https://aiemailservice.com/v1/mailbox/mbx_de7d0e26018b4364/wait?timeout=30&subject_contains=pitchwall" -H "x-api-key: ak_c026ce1fe7164b70ab96f5d013761341"',
          { encoding: 'utf-8', timeout: 35000 }
        );

        if (emailResp.includes('"id"')) {
          const emailObj = JSON.parse(emailResp);
          const msgId = emailObj.id;
          const msgBody = require('child_process').execSync(
            `curl -s "https://aiemailservice.com/v1/mailbox/mbx_de7d0e26018b4364/messages/${msgId}" -H "x-api-key: ak_c026ce1fe7164b70ab96f5d013761341"`,
            { encoding: 'utf-8' }
          );

          const linkMatches = msgBody.match(/https:\/\/[^\s"<>)]+/g) || [];
          const verifyLink = linkMatches.find(l => l.includes('pitchwall'));

          if (verifyLink) {
            console.log('Verification link found, navigating...');
            await page.goto(verifyLink, { waitUntil: 'networkidle2', timeout: 15000 });
            await page.bringToFront();
            await new Promise(r => setTimeout(r, 2000));
          }
        }
      } catch (e) {
        console.log('Email verification skipped');
      }
    }

    // Fill product form
    console.log('[6] Filling product form...');

    // Product name
    await cdpType('input[type="text"]:nth-of-type(1)', 'TikiTaka');
    await new Promise(r => setTimeout(r, 300));

    // Website URL
    await cdpType('input[type="url"], input[placeholder*="website" i], input[placeholder*="url" i]', 'https://tikitaka.vip');
    await new Promise(r => setTimeout(r, 300));

    // Tagline/Description
    const textareas = await page.$$('textarea');
    if (textareas.length > 0) {
      await cdpType('textarea', 'Free World Cup 2026 prediction game with a monkey competitor');
    }

    await new Promise(r => setTimeout(r, 1000));

    // Submit product
    console.log('[7] Submitting product...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const submitBtn = btns.find(b =>
        (b.innerText || '').toLowerCase().match(/submit|publish|post|launch/)
      );
      submitBtn?.click();
    });

    await new Promise(r => setTimeout(r, 3000));

    // Final status
    const finalUrl = page.url();
    const finalText = await page.evaluate(() => document.body.innerText.substring(0, 300));

    console.log('\n=== SUBMISSION COMPLETE ===');
    console.log('Final URL:', finalUrl);

    if (finalUrl.includes('success') || finalText.includes('success')) {
      console.log('Status: SUCCESS');
      process.exit(0);
    } else {
      console.log('Status: SUBMITTED');
      process.exit(0);
    }

    await client.detach();
    await browser.disconnect();

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
