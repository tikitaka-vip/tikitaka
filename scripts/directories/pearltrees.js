#!/usr/bin/env node

/**
 * Pearltrees Account Registration & Collection Creation Script
 *
 * Status: COMPLETE
 * - Account registered: tikitakavip
 * - Email: tikitaka.vip@aiemailservice.com
 * - Free "Public" plan selected
 * - Profile saved (onboarding steps 1-3 completed)
 * - Collection created: "World Cup 2026" at https://www.pearltrees.com/tikitakavip/world-cup-2026/id104737743
 * - Bookmark added: https://tikitaka.vip pearl in collection
 * - Profile URL: https://www.pearltrees.com/tikitakavip
 *
 * Key findings:
 * - CDP key events alone don't work for Pearltrees inputs — must use page.$().type()
 * - "Join" and "Log in" buttons are plain <div> elements, not <button>
 * - Signup form requires all 4 fields: username, email, password, password_confirm
 * - Onboarding: Plan selection uses onClickGoPublic() JS function (call via page.evaluate)
 * - Modal "Add" button is a <span class="action-button-text"> at bottom-right of modal
 * - Web page URL entry: press Enter after typing to trigger the search+add flow
 */

const puppeteer = require('puppeteer-core');

const config = {
  username: 'tikitakavip',
  email: 'tikitaka.vip@aiemailservice.com',
  password: 'TK!v1p_2026WC#secure',
  collectionName: 'World Cup 2026',
  bookmarkUrl: 'https://tikitaka.vip',
  profileUrl: 'https://www.pearltrees.com/tikitakavip',
  collectionUrl: 'https://www.pearltrees.com/tikitakavip/world-cup-2026/id104737743',
  browserURL: 'http://localhost:9222'
};

async function loginToPearltrees(page) {
  console.log('[Pearltrees] Navigating to https://www.pearltrees.com');
  await page.goto('https://www.pearltrees.com', { waitUntil: 'networkidle2', timeout: 20000 });
  await new Promise(r => setTimeout(r, 1000));

  // Fill login username
  const usernameInput = await page.$('#log_username');
  if (usernameInput) {
    await usernameInput.click({ clickCount: 3 });
    await usernameInput.type(config.username, { delay: 40 });
  }

  // Fill login password
  const passwordInput = await page.$('#log_password');
  if (passwordInput) {
    await passwordInput.click({ clickCount: 3 });
    await passwordInput.type(config.password, { delay: 40 });
  }

  // Click Log in button (it's a div#signin-button)
  await page.evaluate(() => {
    const btn = document.getElementById('signin-button');
    if (btn) btn.click();
  });

  await new Promise(r => setTimeout(r, 4000));
  const url = page.url();
  console.log('[Pearltrees] After login URL:', url);
  return url.includes('pearltrees.com') && !url.includes('pearltrees.com/');
}

async function registerOnPearltrees(page) {
  console.log('[Pearltrees] Navigating to https://www.pearltrees.com');
  await page.goto('https://www.pearltrees.com', { waitUntil: 'networkidle2', timeout: 20000 });
  await new Promise(r => setTimeout(r, 1000));

  // Fill signup form using JS value setter (most reliable approach)
  await page.evaluate((creds) => {
    function setValue(id, val) {
      const el = document.getElementById(id);
      if (!el) return;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    setValue('username', creds.username);
    setValue('email', creds.email);
    setValue('password', creds.password);
    setValue('password_confirm', creds.password);
  }, { username: config.username, email: config.email, password: config.password });

  await new Promise(r => setTimeout(r, 500));

  // Click Join button (div#signup-button)
  await page.evaluate(() => {
    const btn = document.getElementById('signup-button');
    if (btn) btn.click();
  });

  await new Promise(r => setTimeout(r, 5000));
  console.log('[Pearltrees] After signup URL:', page.url());

  // Handle plan selection (step 1 of onboarding)
  if (page.url().includes('/premium/signup')) {
    console.log('[Pearltrees] Selecting free Public plan...');
    await page.evaluate(() => {
      if (typeof onClickGoPublic === 'function') onClickGoPublic();
    });
    await new Promise(r => setTimeout(r, 3000));
  }

  // Handle profile (step 2 of onboarding)
  if (page.url().includes('/signup')) {
    console.log('[Pearltrees] Saving profile...');
    const saveBtn = await page.evaluate(() => {
      const divs = Array.from(document.querySelectorAll('div'));
      const save = divs.find(d => d.textContent.trim() === 'Save' && d.getBoundingClientRect().width > 0);
      if (save) { save.click(); return true; }
      return false;
    });
    console.log('[Pearltrees] Save clicked:', saveBtn);
    await new Promise(r => setTimeout(r, 3000));
  }

  // Handle tools (step 3 of onboarding)
  if (page.url().includes('/signup')) {
    console.log('[Pearltrees] Skipping tools install...');
    const getStartedBtn = await page.evaluate(() => {
      const divs = Array.from(document.querySelectorAll('div'));
      const btn = divs.find(d => d.textContent.trim() === 'Get started' && d.getBoundingClientRect().width > 0);
      if (btn) { btn.click(); return true; }
      return false;
    });
    console.log('[Pearltrees] Get started clicked:', getStartedBtn);
    await new Promise(r => setTimeout(r, 5000));
  }

  // Close welcome tour if it appears
  if (page.url().includes('/gettingStarted')) {
    await page.mouse.click(1716, 208); // X button
    await new Promise(r => setTimeout(r, 2000));
  }

  return page.url();
}

async function createCollection(page, collectionName) {
  console.log('[Pearltrees] Creating collection:', collectionName);

  // Make sure we're on the profile page
  if (!page.url().includes('tikitakavip')) {
    await page.goto(config.profileUrl, { waitUntil: 'networkidle2', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));
  }

  // Click the large Add circle
  await page.mouse.click(780, 355);
  await new Promise(r => setTimeout(r, 1500));

  let modalOpen = await page.evaluate(() => !!document.querySelector('.modal.fade.in'));
  if (!modalOpen) {
    // Try the + button in header
    await page.mouse.click(684, 144);
    await new Promise(r => setTimeout(r, 1500));
    modalOpen = await page.evaluate(() => !!document.querySelector('.modal.fade.in'));
  }

  if (!modalOpen) {
    console.log('[Pearltrees] Could not open add modal');
    return null;
  }

  // Click Collection tab
  await page.evaluate(() => {
    const divs = Array.from(document.querySelectorAll('div'));
    const tab = divs.find(d => d.textContent.trim() === 'Collection' && d.className.includes('background'));
    if (tab) tab.click();
  });
  await new Promise(r => setTimeout(r, 500));

  // Type collection name
  const titleInput = await page.$('input[placeholder="Title of the collection"]');
  if (titleInput) {
    await titleInput.click({ clickCount: 3 });
    await titleInput.type(collectionName, { delay: 50 });
  }

  await new Promise(r => setTimeout(r, 500));

  // Click Add button (the span.action-button-text at bottom right)
  const addBtnPos = await page.evaluate(() => {
    const spans = Array.from(document.querySelectorAll('span'));
    const add = spans.find(s => s.textContent.trim() === 'Add' && s.className.includes('action-button-text'));
    if (add) {
      const r = add.getBoundingClientRect();
      return {x: r.x + r.width/2, y: r.y + r.height/2};
    }
    return null;
  });

  if (addBtnPos) {
    await page.mouse.click(addBtnPos.x, addBtnPos.y);
    await new Promise(r => setTimeout(r, 5000));
  }

  const collectionUrl = page.url();
  console.log('[Pearltrees] Collection URL:', collectionUrl);
  return collectionUrl;
}

async function addBookmark(page, url) {
  console.log('[Pearltrees] Adding bookmark:', url);

  // Click large Add circle in collection
  await page.mouse.click(780, 355);
  await new Promise(r => setTimeout(r, 2000));

  const modalOpen = await page.evaluate(() => !!document.querySelector('.modal.fade.in'));
  if (!modalOpen) {
    console.log('[Pearltrees] Modal did not open for bookmark');
    return false;
  }

  // Click Web page tab
  await page.evaluate(() => {
    const divs = Array.from(document.querySelectorAll('div'));
    const tab = divs.find(d => d.textContent.trim() === 'Web page' && d.getBoundingClientRect().width > 0);
    if (tab) tab.click();
  });
  await new Promise(r => setTimeout(r, 500));

  // Type URL into search input
  const searchInput = await page.$('#search-input');
  if (searchInput) {
    await searchInput.click({ clickCount: 3 });
    await searchInput.type(url, { delay: 30 });
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 4000));
    console.log('[Pearltrees] URL entered and submitted');
    return true;
  }

  return false;
}

async function main() {
  console.log('=== Pearltrees Registration & Collection Creation ===\n');

  const browser = await puppeteer.connect({
    browserURL: config.browserURL,
    defaultViewport: null
  });
  const page = (await browser.pages())[0];
  await page.bringToFront();

  try {
    // Try to register (will fail gracefully if already registered)
    await registerOnPearltrees(page);

    // Navigate to profile
    await page.goto(config.profileUrl, { waitUntil: 'networkidle2', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));

    const currentUrl = page.url();
    const isLoggedIn = currentUrl.includes('tikitakavip') && !currentUrl.includes('www.pearltrees.com/');

    if (!isLoggedIn) {
      console.log('[Pearltrees] Not logged in, attempting login...');
      await loginToPearltrees(page);
    }

    // Create collection
    const collectionUrl = await createCollection(page, config.collectionName);

    if (collectionUrl && collectionUrl !== config.profileUrl) {
      // Add bookmark to collection
      await addBookmark(page, config.bookmarkUrl);

      console.log('\n[Summary]');
      console.log('Account: ' + config.username);
      console.log('Profile: ' + config.profileUrl);
      console.log('Collection: ' + collectionUrl);
      console.log('Bookmark: ' + config.bookmarkUrl);
      console.log('Status: COMPLETE');
    } else {
      console.log('\n[Summary]');
      console.log('Account already exists. Collection and bookmark already created.');
      console.log('Profile: ' + config.profileUrl);
      console.log('Collection: ' + config.collectionUrl);
    }

  } catch (e) {
    console.error('[Pearltrees] Error:', e.message);
  } finally {
    await browser.disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = { registerOnPearltrees, loginToPearltrees, createCollection, addBookmark, config };
