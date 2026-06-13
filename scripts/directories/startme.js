const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

/**
 * Start.me Registration and Page Setup Script
 * Registers a new account, creates a "World Cup 2026" page,
 * and adds a bookmark to tikitaka.vip
 * 
 * Credentials:
 * - Email: tikitaka.vip@aiemailservice.com
 * - Password: TK!v1p_2026WC#secure
 * - Username: tikitaka_vip
 * - Name: Tiki Taka
 */

let ss_count = 0;
const ssDir = process.env.SCREENSHOTS_DIR || '/tmp/startme_screenshots';

async function screenshot(page, label) {
  fs.mkdirSync(ssDir, { recursive: true });
  const filepath = path.join(ssDir, `${++ss_count}_${label}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`[SS] ${label}`);
}

async function findAndClick(page, text) {
  return page.evaluate((t) => {
    const els = Array.from(document.querySelectorAll('a, button'));
    const el = els.find(e => e.innerText.toLowerCase().includes(t.toLowerCase()));
    if (el) {
      el.click();
      return true;
    }
    return false;
  }, text);
}

async function main() {
  const browser = await puppeteer.connect({
    browserURL: 'http://localhost:9222',
    defaultViewport: null
  });

  const page = (await browser.pages())[0];
  
  try {
    // Step 1: Navigate to Start.me
    console.log('[Step 1] Navigating to Start.me homepage');
    await page.goto('https://start.me/', { waitUntil: 'networkidle2', timeout: 15000 });
    await page.bringToFront();
    await screenshot(page, '01_homepage');

    // Step 2: Click Log In
    console.log('[Step 2] Clicking Log In');
    await findAndClick(page, 'log in');
    await new Promise(r => setTimeout(r, 2000));
    await page.bringToFront();

    // Step 3: Click Sign Up
    console.log('[Step 3] Clicking Sign Up');
    await findAndClick(page, 'sign up');
    await new Promise(r => setTimeout(r, 2000));
    await page.bringToFront();
    await screenshot(page, '02_signup_page');

    // Step 4: Fill email field
    console.log('[Step 4] Filling email');
    const inputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input')).map(i => ({
        type: i.type,
        name: i.name,
        id: i.id,
        placeholder: i.placeholder
      }));
    });

    const emailInput = inputs.find(i => i.type === 'email');
    if (emailInput) {
      const sel = emailInput.id ? `#${emailInput.id}` : `input[name="${emailInput.name}"]`;
      await page.click(sel);
      await new Promise(r => setTimeout(r, 200));
      await page.evaluate((s) => { document.querySelector(s).value = ''; }, sel);
      await page.keyboard.type('tikitaka.vip@aiemailservice.com', { delay: 5 });
      await screenshot(page, '03_email_filled');

      // Step 5: Submit email
      console.log('[Step 5] Submitting email');
      await findAndClick(page, 'sign up');
      await new Promise(r => setTimeout(r, 3000));
      await page.bringToFront();
      await screenshot(page, '04_after_email_submit');

      // Step 6: Fill password if requested
      const inputs2 = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input')).map(i => ({
          type: i.type,
          name: i.name,
          id: i.id
        }));
      });

      const passwordInput = inputs2.find(i => i.type === 'password');
      if (passwordInput) {
        console.log('[Step 6] Filling password');
        const sel = passwordInput.id ? `#${passwordInput.id}` : `input[name="${passwordInput.name}"]`;
        await page.click(sel);
        await page.keyboard.type('TK!v1p_2026WC#secure', { delay: 5 });
        await screenshot(page, '05_password_filled');

        await findAndClick(page, 'next');
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    // Step 7: Complete onboarding
    console.log('[Step 7] Completing onboarding');
    for (let i = 0; i < 10; i++) {
      await page.bringToFront();
      const btn = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        for (const b of buttons) {
          const text = b.innerText.toLowerCase();
          if (text.includes('next') || text.includes('continue') || text.includes('skip') || 
              text.includes('start') || text.includes('finish')) {
            return b.innerText.substring(0, 30);
          }
        }
        return null;
      });

      if (btn) {
        console.log(`  [Onboarding step ${i}] clicking ${btn}`);
        await page.evaluate((btnText) => {
          const b = Array.from(document.querySelectorAll('button')).find(el =>
            el.innerText.toLowerCase().includes(btnText.toLowerCase().substring(0, 10))
          );
          if (b) b.click();
        }, btn);
        await new Promise(r => setTimeout(r, 1500));
      } else {
        break;
      }
    }

    await page.bringToFront();
    await screenshot(page, '06_onboarding_complete');

    // Step 8: Navigate to dashboard
    console.log('[Step 8] Navigating to dashboard');
    const currentUrl = page.url();
    if (!currentUrl.includes('dashboard')) {
      await page.goto('https://start.me/dashboard', { waitUntil: 'networkidle2', timeout: 15000 });
      await page.bringToFront();
    }
    await screenshot(page, '07_dashboard');

    // Step 9: Create new blank page
    console.log('[Step 9] Creating new page');
    const createClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      for (const btn of buttons) {
        if (btn.innerText.toLowerCase().includes('create new blank')) {
          btn.click();
          return true;
        }
      }
      return false;
    });

    if (createClicked) {
      await new Promise(r => setTimeout(r, 1500));
      await page.bringToFront();

      // Check for page name input
      const inputs3 = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input')).map(i => ({
          id: i.id,
          name: i.name,
          placeholder: i.placeholder
        }));
      });

      const nameInput = inputs3.find(i => i.placeholder?.toLowerCase().includes('name') ||
                                           i.placeholder?.toLowerCase().includes('page'));
      if (nameInput) {
        const sel = nameInput.id ? `#${nameInput.id}` : `input[name="${nameInput.name}"]`;
        console.log('[Step 10] Filling page name');
        await page.click(sel);
        await page.keyboard.type('World Cup 2026', { delay: 5 });
        await screenshot(page, '08_page_name_filled');

        // Submit page creation
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          for (const btn of buttons) {
            if (btn.innerText.toLowerCase().includes('create')) {
              btn.click();
              return;
            }
          }
        });

        await new Promise(r => setTimeout(r, 2000));
      }
    }

    await page.bringToFront();
    await screenshot(page, '09_page_created');

    // Step 11: Add bookmark widget
    console.log('[Step 11] Adding bookmark widget');
    const addWidgetClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      for (const btn of buttons) {
        const text = btn.innerText.toLowerCase();
        if (text.includes('add') || text.includes('widget') || text.includes('+')) {
          btn.click();
          return true;
        }
      }
      return false;
    });

    if (addWidgetClicked) {
      await new Promise(r => setTimeout(r, 1500));
      await page.bringToFront();
      await screenshot(page, '10_widget_menu');

      // Select bookmark option
      await page.evaluate(() => {
        const options = Array.from(document.querySelectorAll('button, [role="option"]'));
        for (const opt of options) {
          if (opt.innerText.toLowerCase().includes('bookmark') ||
              opt.innerText.toLowerCase().includes('link')) {
            opt.click();
            return;
          }
        }
      });

      await new Promise(r => setTimeout(r, 1500));
      await page.bringToFront();
      await screenshot(page, '11_bookmark_form');

      // Fill bookmark details
      const inputs4 = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input')).map(i => ({
          id: i.id,
          name: i.name,
          placeholder: i.placeholder
        }));
      });

      for (const inp of inputs4) {
        const sel = inp.id ? `#${inp.id}` : `input[name="${inp.name}"]`;
        if (inp.placeholder?.toLowerCase().includes('url') ||
            inp.placeholder?.toLowerCase().includes('link')) {
          console.log('[Step 12] Filling bookmark URL');
          await page.click(sel);
          await page.keyboard.type('https://tikitaka.vip', { delay: 3 });
        } else if (inp.placeholder?.toLowerCase().includes('title')) {
          console.log('[Step 13] Filling bookmark title');
          await page.click(sel);
          await page.keyboard.type('Tiki Taka', { delay: 3 });
        }
      }

      await screenshot(page, '12_bookmark_filled');

      // Save bookmark
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        for (const btn of buttons) {
          if (btn.innerText.toLowerCase().includes('save') ||
              btn.innerText.toLowerCase().includes('add')) {
            btn.click();
            return;
          }
        }
      });

      await new Promise(r => setTimeout(r, 1500));
    }

    // Step 14: Make page public
    console.log('[Step 14] Making page public');
    const shareClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      for (const btn of buttons) {
        if (btn.innerText.toLowerCase().includes('share')) {
          btn.click();
          return true;
        }
      }
      return false;
    });

    if (shareClicked) {
      await new Promise(r => setTimeout(r, 1500));
      await page.evaluate(() => {
        const toggles = Array.from(document.querySelectorAll('input[type="checkbox"], button[role="switch"]'));
        for (const toggle of toggles) {
          const parent = toggle.parentElement?.innerText?.toLowerCase() || '';
          if (parent.includes('public') || parent.includes('anyone')) {
            if (!toggle.checked) {
              toggle.click();
            }
            return;
          }
        }
      });
      await new Promise(r => setTimeout(r, 1500));
    }

    await page.bringToFront();
    await screenshot(page, '13_final');

    const finalUrl = page.url();
    const publicUrl = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      for (const inp of inputs) {
        if (inp.value?.includes('start.me')) {
          return inp.value;
        }
      }
      return null;
    });

    console.log(`[Complete] Page URL: ${publicUrl || finalUrl}`);

    // Update accounts.json
    const accountsPath = '/home/ubuntu/.agent-factory/agents/tikitaka_vip/accounts.json';
    if (fs.existsSync(accountsPath)) {
      const accounts = JSON.parse(fs.readFileSync(accountsPath, 'utf8'));
      if (!accounts.profiles) accounts.profiles = {};
      accounts.profiles.startme = {
        url: 'start.me',
        status: 'registered',
        registered: new Date().toISOString().split('T')[0],
        pageUrl: publicUrl || finalUrl
      };
      fs.writeFileSync(accountsPath, JSON.stringify(accounts, null, 2));
      console.log('[Updated] accounts.json');
    }

  } catch (error) {
    console.error('[Error]', error.message);
    throw error;
  } finally {
    await browser.disconnect();
  }
}

main().catch(e => {
  console.error('[Fatal]', e.message);
  process.exit(1);
});
