#!/usr/bin/env node
// Tumblr — microblogging platform (DR ~86)
//
// Flow: email+password login at /login → go to /new/text post editor
// Post editor uses WordPress Gutenberg-style block editor (H1 for title, P for body)
// Key insight: click by mouse coordinates (using getBoundingClientRect), then
//   document.execCommand('insertText') after element is focused.
//   CDP Input.dispatchKeyEvent works for tags.
//
// Requires: puppeteer-core at /tmp/node_modules

const { PRODUCT, IDENTITY, MAILBOX, connectBrowser, waitForEmail, getEmailBody } = require('./config');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function screenshot(page, name) {
  const path = `/tmp/tumblr_${name}.png`;
  await page.screenshot({path});
  require('child_process').execSync(`python3 /home/ubuntu/.claude/hooks/resize-images.py ${path} --max-dim 1800`);
  console.log(`Screenshot: ${path}`);
  return path;
}

function sendTG(msg) {
  require('child_process').execSync(
    `curl -s "https://api.telegram.org/bot8445371320:AAE4YLFNtHH8jZx_NJgxbep9C0E7Z8RwP1c/sendMessage" ` +
    `-d chat_id=6674342664 -d text="${msg.replace(/"/g, '\\"')}"`
  );
}

// Type text into a focused contenteditable element using execCommand
async function typeIntoFocused(page, text) {
  await page.evaluate((t) => {
    document.execCommand('insertText', false, t);
  }, text);
}

// Click element by its center coordinates (getBoundingClientRect)
async function clickByCenter(page, selector) {
  const pos = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, selector);
  if (!pos) return false;
  await page.mouse.click(pos.x, pos.y);
  return true;
}

// Select all content of a contenteditable and delete it (works where Ctrl+A doesn't)
async function clearContentEditable(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel2 = window.getSelection();
    sel2.removeAllRanges();
    sel2.addRange(range);
  }, selector);
  await sleep(100);
  await page.keyboard.press('Backspace');
}

async function waitForCaptchaSolve(page, timeoutMs = 120000) {
  const startUrl = page.url();
  console.log('Waiting for CAPTCHA solve, current URL:', startUrl);
  sendTG('CAPTCHA on Tumblr - need manual solve');

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(3000);
    const currentUrl = page.url();
    if (currentUrl !== startUrl) {
      console.log('URL changed to:', currentUrl, '— captcha likely solved');
      return true;
    }
    const hasCaptcha = await page.evaluate(() => {
      return !!(document.querySelector('iframe[src*="recaptcha"], iframe[src*="captcha"], .g-recaptcha, #captcha'));
    });
    if (!hasCaptcha) {
      console.log('Captcha element gone — may be solved');
      return true;
    }
  }
  return false;
}

async function run() {
  const browser = await connectBrowser();
  const page = (await browser.pages())[0];
  const client = await page.createCDPSession();

  page.on('dialog', async d => {
    console.log('Dialog:', d.message());
    await d.accept();
  });

  // Step 1: Login
  console.log('Step 1: Logging in...');
  await page.goto('https://www.tumblr.com/login', {waitUntil: 'networkidle2', timeout: 20000});
  await page.bringToFront();
  await sleep(2000);
  await screenshot(page, '01_login');

  // Check if already logged in
  const currentUrl = page.url();
  console.log('URL after login page:', currentUrl);

  if (currentUrl.includes('/login')) {
    // Fill email
    await page.evaluate(() => {
      const emailInput = document.querySelector('input[type="email"], input[name="email"]');
      if (emailInput) { emailInput.focus(); emailInput.value = ''; }
    });
    await sleep(100);
    const emailEl = await page.$('input[type="email"], input[name="email"]');
    if (emailEl) {
      const emailPos = await page.evaluate(el => {
        const r = el.getBoundingClientRect();
        return {x: r.left + r.width/2, y: r.top + r.height/2};
      }, emailEl);
      await page.mouse.click(emailPos.x, emailPos.y);
      await sleep(200);
      for (const c of IDENTITY.email) {
        await client.send('Input.dispatchKeyEvent', {type:'keyDown', text:c});
        await client.send('Input.dispatchKeyEvent', {type:'keyUp', text:c});
        await sleep(8);
      }
    }

    // Click Next button (Tumblr has 2-step login: email first, then password)
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const next = btns.find(b => /next|continue/i.test(b.textContent.trim()));
      if (next) next.click();
      else {
        const sub = document.querySelector('button[type="submit"]');
        if (sub) sub.click();
      }
    });
    await sleep(2000);

    // Fill password
    const pwEl = await page.$('input[type="password"]');
    if (pwEl) {
      const pwPos = await page.evaluate(el => {
        const r = el.getBoundingClientRect();
        return {x: r.left + r.width/2, y: r.top + r.height/2};
      }, pwEl);
      await page.mouse.click(pwPos.x, pwPos.y);
      await sleep(200);
      for (const c of IDENTITY.password) {
        await client.send('Input.dispatchKeyEvent', {type:'keyDown', text:c});
        await client.send('Input.dispatchKeyEvent', {type:'keyUp', text:c});
        await sleep(8);
      }
    }

    // Click Login/Submit
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const login = btns.find(b => /log in|login|sign in|submit/i.test(b.textContent.trim()));
      if (login) login.click();
      else {
        const sub = document.querySelector('button[type="submit"]');
        if (sub) sub.click();
      }
    });
    await sleep(4000);
    await screenshot(page, '01b_after_login');
  } else {
    console.log('Already logged in, skipping login step');
  }

  // Step 2: Navigate to new text post editor
  console.log('Step 2: Going to new text post editor...');
  await page.goto('https://www.tumblr.com/new/text', {waitUntil: 'networkidle2', timeout: 20000});
  await page.bringToFront();
  await sleep(3000);
  await screenshot(page, '02_new_post');

  // Step 3: Fill title
  // The editor uses Gutenberg block editor: H1 for title, P for body
  // IMPORTANT: Must click by mouse coordinates using getBoundingClientRect,
  // then use document.execCommand('insertText') after focus. CDP keyDown/keyUp
  // does NOT work here reliably.
  console.log('Step 3: Filling title...');
  const titleSel = 'h1.block-editor-rich-text__editable';
  const titlePos = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {x: rect.left + rect.width/2, y: rect.top + rect.height/2};
  }, titleSel);

  if (titlePos) {
    // Clear any existing content first
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return;
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(range);
    }, titleSel);
    await sleep(100);
    await page.keyboard.press('Backspace');
    await sleep(100);

    // Click to focus
    await page.mouse.click(titlePos.x, titlePos.y);
    await sleep(300);

    // Insert text via execCommand
    await page.evaluate(() => {
      document.execCommand('insertText', false, 'TikiTaka - Free World Cup 2026 Prediction Game');
    });
    await sleep(300);

    const titleText = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? el.textContent : '';
    }, titleSel);
    console.log('Title text:', titleText);
  } else {
    console.log('WARNING: Title H1 not found');
  }

  // Step 4: Fill body
  console.log('Step 4: Filling body...');
  const bodySel = 'p.block-editor-rich-text__editable';
  const bodyPos = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {x: rect.left + rect.width/2, y: rect.top + rect.height/2};
  }, bodySel);

  const bodyText = 'We built a free prediction game for the FIFA World Cup 2026. Predict all 104 matches, pick the champion and top scorer, make groups with friends. The twist: every group has a monkey competitor. Every morning, the system screenshots live zoo webcams (baboons in San Diego, gorillas in Atlanta, snow monkeys in Japan) and turns monkey behavior into match predictions. If a gorilla is sleeping, that\'s a 0-0. Free, 10 languages, no ads. Try it: https://tikitaka.vip';

  if (bodyPos) {
    await page.mouse.click(bodyPos.x, bodyPos.y);
    await sleep(300);
    await page.evaluate((text) => {
      document.execCommand('insertText', false, text);
    }, bodyText);
    await sleep(300);
    const bodyContent = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? el.textContent.substring(0, 80) : '';
    }, bodySel);
    console.log('Body content:', bodyContent);
  } else {
    console.log('WARNING: Body P not found');
  }

  await screenshot(page, '03_content_filled');

  // Step 5: Add tags
  // Tag input is a TEXTAREA with class mbROR. Type tag text then press Enter to add.
  console.log('Step 5: Adding tags...');
  const tagSel = 'textarea.mbROR';
  const tagPos = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {x: rect.left + rect.width/2, y: rect.top + rect.height/2};
  }, tagSel);

  if (tagPos) {
    await page.mouse.click(tagPos.x, tagPos.y);
    await sleep(400);
    const tags = ['world cup 2026', 'football', 'soccer', 'predictions', 'tikitaka'];
    for (const tag of tags) {
      for (const c of tag) {
        await client.send('Input.dispatchKeyEvent', {type:'keyDown', text:c});
        await client.send('Input.dispatchKeyEvent', {type:'keyUp', text:c});
        await sleep(8);
      }
      await client.send('Input.dispatchKeyEvent', {type:'keyDown', key:'Return', text:'\r'});
      await client.send('Input.dispatchKeyEvent', {type:'keyUp', key:'Return'});
      await sleep(200);
    }
    console.log('Tags added');
  } else {
    console.log('WARNING: Tag input not found');
  }

  await screenshot(page, '04_tags_added');

  // Step 6: Click Post now
  // Close any tag autocomplete dropdown first by clicking body area,
  // then click "Post now" button by mouse coordinates
  console.log('Step 6: Posting...');
  await page.mouse.click(700, 500);  // dismiss autocomplete dropdown
  await sleep(400);

  const postBtnPos = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.textContent.trim() === 'Post now');
    if (!btn) return null;
    const rect = btn.getBoundingClientRect();
    return {x: rect.left + rect.width/2, y: rect.top + rect.height/2};
  });

  if (postBtnPos) {
    await page.mouse.click(postBtnPos.x, postBtnPos.y);
    console.log('Clicked Post now');
  } else {
    // Fallback: try clicking publish/post
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => /post now|publish/i.test(b.textContent.trim()));
      if (btn) btn.click();
    });
    console.log('Clicked Post button via evaluate');
  }

  await sleep(4000);
  const postPageUrl = page.url();
  console.log('URL after posting:', postPageUrl);
  await screenshot(page, '05_posted');

  // Step 7: Update blog description via Edit appearance
  console.log('Step 7: Updating blog description...');
  await page.goto('https://www.tumblr.com/settings/blog/tikitakavip', {waitUntil: 'networkidle2', timeout: 20000});
  await page.bringToFront();
  await sleep(2000);
  await screenshot(page, '06_settings');

  // Click "Edit appearance" to open the appearance panel
  const editAppearancePos = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('a, button'));
    const btn = btns.find(b => b.textContent.trim().includes('Edit appearance'));
    if (!btn) return null;
    const rect = btn.getBoundingClientRect();
    return {x: rect.left + rect.width/2, y: rect.top + rect.height/2};
  });

  if (editAppearancePos) {
    await page.mouse.click(editAppearancePos.x, editAppearancePos.y);
    await sleep(2000);
    console.log('Edit appearance panel opened');
  }

  // Fill the Description textarea (placeholder "Description")
  const descPos = await page.evaluate(() => {
    const textareas = document.querySelectorAll('textarea');
    const desc = Array.from(textareas).find(t => t.placeholder === 'Description');
    if (!desc) return null;
    const rect = desc.getBoundingClientRect();
    return {x: rect.left + rect.width/2, y: rect.top + rect.height/2};
  });

  const descriptionText = 'Free World Cup 2026 prediction game. Beat a monkey. https://tikitaka.vip';

  if (descPos) {
    await page.mouse.click(descPos.x, descPos.y);
    await sleep(300);
    // Focus and type using CDP
    const focusedTag = await page.evaluate(() => document.activeElement.tagName);
    console.log('Focused element:', focusedTag);
    for (const c of descriptionText) {
      await client.send('Input.dispatchKeyEvent', {type:'keyDown', text:c});
      await client.send('Input.dispatchKeyEvent', {type:'keyUp', text:c});
      await sleep(8);
    }
    const descVal = await page.evaluate(() => {
      const t = Array.from(document.querySelectorAll('textarea')).find(t => t.placeholder === 'Description');
      return t ? t.value : '';
    });
    console.log('Description value:', descVal);
  } else {
    console.log('WARNING: Description textarea not found');
  }

  await screenshot(page, '07_description_filled');

  // Click Save button
  const saveBtnPos = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.textContent.trim() === 'Save');
    if (!btn) return null;
    const rect = btn.getBoundingClientRect();
    return {x: rect.left + rect.width/2, y: rect.top + rect.height/2};
  });

  if (saveBtnPos) {
    await page.mouse.click(saveBtnPos.x, saveBtnPos.y);
    console.log('Clicked Save');
    await sleep(3000);
  }

  await screenshot(page, '08_saved');

  // Step 8: Verify the blog
  console.log('Step 8: Verifying blog...');
  await page.goto('https://tikitakavip.tumblr.com', {waitUntil: 'networkidle2', timeout: 20000});
  await page.bringToFront();
  await sleep(2000);
  await screenshot(page, '09_blog_verify');
  console.log('Blog URL:', page.url());

  console.log('\n=== DONE ===');
  console.log('Blog URL: https://tikitakavip.tumblr.com');

  // Update accounts.json
  try {
    const f = '/home/ubuntu/.agent-factory/agents/tikitaka_vip/accounts.json';
    const a = JSON.parse(require('fs').readFileSync(f));
    if (!a.profiles) a.profiles = {};
    a.profiles.tumblr = {
      url: 'tumblr.com',
      status: 'active',
      registered: new Date().toISOString().slice(0, 10),
      blogUrl: 'https://tikitakavip.tumblr.com'
    };
    require('fs').writeFileSync(f, JSON.stringify(a, null, 2));
    console.log('accounts.json updated');
  } catch(e) {
    console.log('Could not update accounts.json:', e.message);
  }

  await browser.disconnect();
}

run().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
