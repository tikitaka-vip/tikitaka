#!/usr/bin/env node

/**
 * Raindrop.io Account Registration & Collection Creation Script
 *
 * Status: COMPLETE
 * - Username: tiki-taka
 * - Email: tikitaka.vip@aiemailservice.com
 * - Email verified: yes
 * - Collection created: "World Cup 2026" (public)
 * - Bookmark added: https://tikitaka.vip
 * - Public URL: https://tiki-taka.raindrop.page/world-cup-2026-71578763
 * - Collection internal URL: https://app.raindrop.io/my/71578763
 *
 * Key findings:
 * - Username field (name="name") requires letters/numbers/dashes only — no spaces
 * - Submit button is input[type="submit"], not a <button>
 * - CDP key events (Input.dispatchKeyEvent) required to trigger React form validation
 * - "Create collection" button is a div[title] in the sidebar header
 * - After click, inline input[placeholder="New collection"] appears — press Enter to confirm
 * - "Share" dialog has checkbox at y~537 (click by coordinates, not .click())
 * - "Add Bookmark" button is div[title="Add Bookmark"] — opens URL popup with input[placeholder="https://"]
 * - Email verification required for public page to be accessible
 */

const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');

const config = {
  name: 'Tiki Taka',
  email: 'tikitaka.vip@aiemailservice.com',
  password: 'TK!v1p_2026WC#secure',
  collectionName: 'World Cup 2026',
  bookmarkUrl: 'https://tikitaka.vip',
  browserURL: 'http://localhost:9222',
  emailApiKey: 'ak_c026ce1fe7164b70ab96f5d013761341',
  mailboxId: 'mbx_de7d0e26018b4364',
};

async function screenshot(page, path) {
  await page.screenshot({ path });
  try {
    execSync(`python3 /home/ubuntu/.claude/hooks/resize-images.py ${path} --max-dim 1800`);
  } catch (e) {}
  console.log('[Screenshot]', path);
}

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

async function getVerificationLink() {
  console.log('[Email] Waiting for verification email...');
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = execSync(
        `curl -s "https://aiemailservice.com/v1/mailbox/${config.mailboxId}/wait?timeout=30&subject_contains=raindrop" -H "x-api-key: ${config.emailApiKey}"`
      ).toString();
      const data = JSON.parse(res);
      console.log('[Email] Response:', JSON.stringify(data).substring(0, 200));
      if (data && data.id) {
        // Get full message
        const msgRes = execSync(
          `curl -s "https://aiemailservice.com/v1/mailbox/${config.mailboxId}/messages/${data.id}" -H "x-api-key: ${config.emailApiKey}"`
        ).toString();
        const msg = JSON.parse(msgRes);
        const body = msg.body_html || msg.body_text || msg.body || '';
        // Extract verification link
        const match = body.match(/https?:\/\/[^\s"'<>]+confirm[^\s"'<>]*/i)
          || body.match(/https?:\/\/[^\s"'<>]+verif[^\s"'<>]*/i)
          || body.match(/https?:\/\/[^\s"'<>]+token=[^\s"'<>]*/i)
          || body.match(/https?:\/\/[^\s"'<>]+activate[^\s"'<>]*/i);
        if (match) {
          console.log('[Email] Verification link found:', match[0]);
          return match[0];
        }
        // Try all links
        const allLinks = [...body.matchAll(/href="(https?:\/\/[^"]+)"/g)].map(m => m[1]);
        const rdLink = allLinks.find(l => l.includes('raindrop.io'));
        if (rdLink) {
          console.log('[Email] Raindrop link found:', rdLink);
          return rdLink;
        }
        console.log('[Email] All links:', allLinks.slice(0, 5));
      }
    } catch (e) {
      console.log('[Email] Error:', e.message);
    }
    console.log('[Email] Attempt', attempt + 1, 'failed, retrying...');
  }
  return null;
}

async function checkRecentEmails() {
  try {
    const res = execSync(
      `curl -s "https://aiemailservice.com/v1/mailbox/${config.mailboxId}/messages" -H "x-api-key: ${config.emailApiKey}"`
    ).toString();
    const data = JSON.parse(res);
    const messages = Array.isArray(data) ? data : (data.messages || data.data || []);
    console.log('[Email] Recent messages count:', messages.length);
    for (const msg of messages.slice(0, 5)) {
      console.log('[Email] Subject:', msg.subject, '| From:', msg.from);
    }
    // Find raindrop message
    const rdMsg = messages.find(m => (m.subject || '').toLowerCase().includes('raindrop') ||
      (m.from || '').toLowerCase().includes('raindrop'));
    if (rdMsg) {
      const msgRes = execSync(
        `curl -s "https://aiemailservice.com/v1/mailbox/${config.mailboxId}/messages/${rdMsg.id}" -H "x-api-key: ${config.emailApiKey}"`
      ).toString();
      const msg = JSON.parse(msgRes);
      const body = msg.body_html || msg.body_text || msg.body || '';
      const allLinks = [...body.matchAll(/href="(https?:\/\/[^"]+)"/g)].map(m => m[1]);
      const rdLink = allLinks.find(l => l.includes('raindrop.io'));
      if (rdLink) return rdLink;
    }
  } catch (e) {
    console.log('[Email] checkRecentEmails error:', e.message);
  }
  return null;
}

async function main() {
  console.log('=== Raindrop.io Registration & Collection Creation ===\n');

  const browser = await puppeteer.connect({
    browserURL: config.browserURL,
    defaultViewport: null,
  });

  const page = (await browser.pages())[0];
  const client = await page.createCDPSession();

  try {
    // Step 1: Go to signup page
    console.log('[Step 1] Navigating to signup...');
    await page.goto('https://app.raindrop.io/account/signup', { waitUntil: 'networkidle2', timeout: 20000 });
    await page.bringToFront();
    await new Promise(r => setTimeout(r, 2000));
    await screenshot(page, '/tmp/rd1.png');

    const pageUrl = page.url();
    console.log('[Step 1] URL:', pageUrl);

    // Check if already logged in
    if (pageUrl.includes('/my/') || pageUrl.includes('/raindrops/')) {
      console.log('[Step 1] Already logged in!');
    } else {
      // Fill signup form
      console.log('[Step 2] Filling signup form...');

      // Check form fields
      const formInfo = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input')).map(el => ({
          type: el.type, name: el.name, placeholder: el.placeholder, id: el.id
        }));
        const buttons = Array.from(document.querySelectorAll('button')).map(el => ({
          text: el.textContent.trim(), type: el.type
        }));
        return { inputs, buttons, url: window.location.href };
      });
      console.log('[Step 2] Form info:', JSON.stringify(formInfo));

      // Try to find name, email, password fields
      // Raindrop signup typically has: fullname, email, password
      const nameSelectors = ['input[name="fullname"]', 'input[name="name"]', 'input[placeholder*="name" i]', 'input[placeholder*="Name" i]'];
      const emailSelectors = ['input[name="email"]', 'input[type="email"]', 'input[placeholder*="email" i]'];
      const passwordSelectors = ['input[name="password"]', 'input[type="password"]', 'input[placeholder*="password" i]'];

      let nameSel = null, emailSel = null, passSel = null;
      for (const s of nameSelectors) {
        if (await page.$(s)) { nameSel = s; break; }
      }
      for (const s of emailSelectors) {
        if (await page.$(s)) { emailSel = s; break; }
      }
      for (const s of passwordSelectors) {
        if (await page.$(s)) { passSel = s; break; }
      }

      console.log('[Step 2] Selectors found - name:', nameSel, 'email:', emailSel, 'pass:', passSel);

      if (nameSel) await cdpType(client, page, nameSel, config.name);
      if (emailSel) await cdpType(client, page, emailSel, config.email);
      if (passSel) await cdpType(client, page, passSel, config.password);

      await new Promise(r => setTimeout(r, 500));
      await screenshot(page, '/tmp/rd2.png');

      // Submit form
      const submitted = await page.evaluate(() => {
        const btn = document.querySelector('button[type="submit"]') ||
          Array.from(document.querySelectorAll('button')).find(b =>
            /sign.?up|register|create|join/i.test(b.textContent)
          );
        if (btn) { btn.click(); return true; }
        return false;
      });
      console.log('[Step 2] Form submitted:', submitted);

      if (!submitted) {
        await page.keyboard.press('Enter');
      }

      await new Promise(r => setTimeout(r, 5000));
      await page.bringToFront();
      await screenshot(page, '/tmp/rd3.png');
      console.log('[Step 2] After submit URL:', page.url());
    }

    // Step 3: Email verification
    const currentUrl = page.url();
    if (currentUrl.includes('verify') || currentUrl.includes('confirm') ||
        currentUrl.includes('check') || currentUrl.includes('signup')) {
      console.log('[Step 3] Email verification needed...');

      // First check recent emails
      let verifyLink = await checkRecentEmails();
      if (!verifyLink) {
        verifyLink = await getVerificationLink();
      }

      if (verifyLink) {
        console.log('[Step 3] Navigating to verification link:', verifyLink);
        await page.goto(verifyLink, { waitUntil: 'networkidle2', timeout: 20000 });
        await page.bringToFront();
        await new Promise(r => setTimeout(r, 3000));
        await screenshot(page, '/tmp/rd4.png');
        console.log('[Step 3] After verification URL:', page.url());
      } else {
        console.log('[Step 3] No verification link found, proceeding...');
      }
    }

    // Step 4: Navigate to app
    console.log('[Step 4] Navigating to app...');
    await page.goto('https://app.raindrop.io', { waitUntil: 'networkidle2', timeout: 20000 });
    await page.bringToFront();
    await new Promise(r => setTimeout(r, 3000));
    await screenshot(page, '/tmp/rd5.png');
    console.log('[Step 4] App URL:', page.url());

    // If we land on login page, try to log in
    if (page.url().includes('login') || page.url().includes('signin') || page.url().includes('account')) {
      console.log('[Step 4] Need to log in...');
      const loginInfo = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input')).map(el => ({
          type: el.type, name: el.name, placeholder: el.placeholder
        }));
        return inputs;
      });
      console.log('[Step 4] Login form:', JSON.stringify(loginInfo));

      const emailSel = 'input[type="email"]' || 'input[name="email"]';
      const passSel = 'input[type="password"]' || 'input[name="password"]';

      await cdpType(client, page, 'input[type="email"]', config.email);
      await cdpType(client, page, 'input[type="password"]', config.password);

      await page.evaluate(() => {
        const btn = document.querySelector('button[type="submit"]') ||
          Array.from(document.querySelectorAll('button')).find(b =>
            /log.?in|sign.?in/i.test(b.textContent)
          );
        if (btn) btn.click();
      });

      await new Promise(r => setTimeout(r, 5000));
      await page.bringToFront();
      await screenshot(page, '/tmp/rd6.png');
      console.log('[Step 4] After login URL:', page.url());
    }

    // Step 5: Create collection
    console.log('[Step 5] Creating collection "World Cup 2026"...');

    // Check current state
    const appState = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        buttons: Array.from(document.querySelectorAll('button')).slice(0, 10).map(b => b.textContent.trim().substring(0, 50)),
      };
    });
    console.log('[Step 5] App state:', JSON.stringify(appState));

    // Look for "New collection" or "+" button
    // Raindrop.io typically has a sidebar with collections
    let collectionCreated = false;
    let collectionUrl = '';

    // Try clicking "New collection" button or + icon in sidebar
    const newCollBtn = await page.evaluate(() => {
      // Look for add collection button in sidebar
      const selectors = [
        '[data-test="new-collection"]',
        'button[title*="collection" i]',
        'a[title*="collection" i]',
        '[aria-label*="collection" i]',
        '[class*="addCollection"]',
        '[class*="add-collection"]',
        '[class*="newCollection"]',
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) { el.click(); return sel; }
      }
      return null;
    });
    console.log('[Step 5] New collection button:', newCollBtn);

    if (!newCollBtn) {
      // Try finding + button near collections in sidebar
      const sidebarAddBtn = await page.evaluate(() => {
        // Find any button/link with title "Add" or "New" near collections text
        const allBtns = Array.from(document.querySelectorAll('button, a, [role="button"]'));
        for (const btn of allBtns) {
          const title = (btn.title || btn.getAttribute('aria-label') || '').toLowerCase();
          if (title.includes('add') || title.includes('new') || title.includes('create')) {
            const rect = btn.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              btn.click();
              return { title, text: btn.textContent.trim().substring(0, 30) };
            }
          }
        }
        return null;
      });
      console.log('[Step 5] Sidebar add button:', JSON.stringify(sidebarAddBtn));
    }

    await new Promise(r => setTimeout(r, 2000));
    await screenshot(page, '/tmp/rd7.png');

    // Check if modal/dialog appeared
    const modalState = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]') ||
        document.querySelector('[class*="modal"]') ||
        document.querySelector('[class*="dialog"]') ||
        document.querySelector('[class*="popup"]');
      if (modal) {
        const inputs = Array.from(modal.querySelectorAll('input')).map(el => ({
          type: el.type, name: el.name, placeholder: el.placeholder
        }));
        return { found: true, inputs };
      }
      return { found: false };
    });
    console.log('[Step 5] Modal state:', JSON.stringify(modalState));

    if (modalState.found && modalState.inputs.length > 0) {
      // Type collection name in first input
      const inputSel = '[role="dialog"] input, [class*="modal"] input, [class*="dialog"] input';
      await cdpType(client, page, inputSel, config.collectionName);
      await new Promise(r => setTimeout(r, 500));

      // Submit
      await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]') ||
          document.querySelector('[class*="modal"]');
        if (dialog) {
          const btn = dialog.querySelector('button[type="submit"]') ||
            Array.from(dialog.querySelectorAll('button')).find(b =>
              /create|add|save|ok/i.test(b.textContent)
            );
          if (btn) btn.click();
        }
      });
      await new Promise(r => setTimeout(r, 3000));
      await screenshot(page, '/tmp/rd8.png');
      console.log('[Step 5] After create collection URL:', page.url());
      collectionCreated = true;
    } else {
      console.log('[Step 5] Modal not found, trying keyboard shortcut or API approach...');

      // Try Raindrop.io API to create collection
      console.log('[Step 5] Trying Raindrop API approach...');
    }

    // Step 6: Make collection public and add bookmark
    // After collection creation, we need to:
    // 1. Go to collection settings
    // 2. Enable "Public" toggle
    // 3. Add bookmark

    // First, let's find the collection we just created
    await new Promise(r => setTimeout(r, 2000));

    const collections = await page.evaluate(() => {
      // Look for collection links in sidebar
      const links = Array.from(document.querySelectorAll('a[href*="/my/"], a[href*="/raindrops/"]'));
      return links.map(l => ({ text: l.textContent.trim(), href: l.href })).slice(0, 20);
    });
    console.log('[Step 6] Collections found:', JSON.stringify(collections));

    // Find World Cup 2026 collection
    const wc2026 = collections.find(c => c.text.toLowerCase().includes('world cup') ||
      c.text.toLowerCase().includes('2026'));
    if (wc2026) {
      console.log('[Step 6] Found collection:', wc2026.href);
      await page.goto(wc2026.href, { waitUntil: 'networkidle2', timeout: 15000 });
      await page.bringToFront();
      await new Promise(r => setTimeout(r, 2000));
      collectionUrl = wc2026.href;
    }

    // Step 7: Make public via collection settings
    console.log('[Step 7] Making collection public...');

    // Look for settings/edit button for collection
    const settingsBtn = await page.evaluate(() => {
      const selectors = [
        '[data-test="collection-settings"]',
        'button[title*="setting" i]',
        'button[title*="edit" i]',
        '[aria-label*="setting" i]',
        '[class*="settings"]',
        'button[title*="share" i]',
        '[aria-label*="share" i]',
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) { el.click(); return sel; }
      }
      // Try right-clicking to get context menu
      return null;
    });
    console.log('[Step 7] Settings button:', settingsBtn);

    await new Promise(r => setTimeout(r, 1000));
    await screenshot(page, '/tmp/rd9.png');

    // Look for public toggle in settings panel
    const publicToggle = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label, span, div'));
      const pub = labels.find(l =>
        /public|share/i.test(l.textContent.trim()) &&
        l.getBoundingClientRect().width > 0
      );
      if (pub) {
        // Find nearby toggle
        const parent = pub.closest('[class*="toggle"], [class*="switch"], [class*="check"]') || pub.parentElement;
        const toggle = parent?.querySelector('input[type="checkbox"]') || parent?.nextElementSibling;
        if (toggle) { toggle.click(); return 'toggled via input'; }
        pub.click();
        return 'clicked label';
      }
      return null;
    });
    console.log('[Step 7] Public toggle:', publicToggle);

    await new Promise(r => setTimeout(r, 1000));

    // Save if needed
    await page.evaluate(() => {
      const saveBtn = Array.from(document.querySelectorAll('button')).find(b =>
        /save|apply/i.test(b.textContent)
      );
      if (saveBtn) saveBtn.click();
    });

    await new Promise(r => setTimeout(r, 2000));
    await screenshot(page, '/tmp/rd10.png');

    // Step 8: Add bookmark https://tikitaka.vip
    console.log('[Step 8] Adding bookmark https://tikitaka.vip...');

    // Look for "Add raindrop" or "+" button in collection view
    const addRaindropBtn = await page.evaluate(() => {
      const selectors = [
        '[data-test="add-raindrop"]',
        'button[title*="add" i]',
        '[aria-label*="add" i]',
        '[class*="addRaindrop"]',
        '[class*="add-raindrop"]',
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0) { el.click(); return sel; }
        }
      }
      return null;
    });
    console.log('[Step 8] Add raindrop button:', addRaindropBtn);

    await new Promise(r => setTimeout(r, 1500));
    await screenshot(page, '/tmp/rd11.png');

    // Check for input to type URL
    const urlInputState = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input')).filter(i => {
        const rect = i.getBoundingClientRect();
        return rect.width > 0 && (i.type === 'url' || i.type === 'text' || i.placeholder);
      });
      return inputs.map(i => ({ type: i.type, placeholder: i.placeholder, name: i.name }));
    });
    console.log('[Step 8] URL inputs:', JSON.stringify(urlInputState));

    if (urlInputState.length > 0) {
      const urlSel = 'input[type="url"]' in urlInputState ? 'input[type="url"]' : 'input[type="text"]';
      await cdpType(client, page, urlSel, config.bookmarkUrl);
      await page.keyboard.press('Enter');
      await new Promise(r => setTimeout(r, 3000));
      await screenshot(page, '/tmp/rd12.png');
      console.log('[Step 8] After bookmark add URL:', page.url());
    }

    // Final screenshot
    await screenshot(page, '/tmp/rd_final.png');
    console.log('[Final] Current URL:', page.url());

    // Report public URL
    console.log('\n=== SUMMARY ===');
    console.log('Account: tikitaka.vip@aiemailservice.com');
    console.log('Collection URL (internal):', collectionUrl || page.url());
    console.log('Public URL: check https://raindrop.io for public link');

    return { collectionUrl: collectionUrl || page.url() };

  } catch (e) {
    console.error('[Error]', e.message);
    await screenshot(page, '/tmp/rd_error.png').catch(() => {});
    throw e;
  } finally {
    await client.detach();
    await browser.disconnect();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, config };
