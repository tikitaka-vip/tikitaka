#!/usr/bin/env node
// Dev.to — developer community blog platform
//
// Registration: Email signup at https://dev.to/users/sign_up?state=email_signup
//   - Has reCAPTCHA on signup form (requires manual solve)
//   - Email confirmation required (link to https://dev.to/users/confirmation?confirmation_token=...)
//   - Full onboarding flow (5 steps: profile, follow tags, follow users, etc.)
//   - GitHub OAuth available but requires correct password (not used here)
//
// What works:
//   - Email signup form: #user_name, #user_username, #user_email, #user_password, #user_password_confirmation
//   - Field filling: use JS native value setter + dispatchEvent('input') for React-controlled inputs
//   - Onboarding: click through all steps with clickButtonByText(['continue', 'skip', 'finish'])
//   - Profile settings at /settings/profile: fields are profile[summary], profile[website_url], profile[location]
//   - Save settings: click "Save Profile Information" button (not generic submit)
//   - Article editor at /dev.to/new: #article-form-title (textarea), #tag-input (text input), #article_body_markdown (textarea)
//   - Article tags: type tag text into #tag-input, then press Enter (wait 400ms between tags)
//   - Article body: set via native value setter + input event on #article_body_markdown
//   - Publish: click button containing text "publish"
//   - Published URL pattern: /dev.to/username/article-slug-hash
//
// What breaks:
//   - The signup page has a search form at the top — querySelectorAll('button[type="submit"]')[0] hits
//     the search submit, NOT the "Sign up" button. Must find by text: "Sign up".
//   - Input.dispatchKeyEvent with type:'char' can corrupt fields if clicked first (appends instead of replaces)
//     → Use Input.insertText CDP command instead, or JS native value setter
//   - Field clearing with el.value='' via page.evaluate() then cdpType() may not clear if field is focused
//     → Always use clickCount:3 to select all before inserting
//   - The settings "save" button text is "Save Profile Information" not just "Save" or "Submit"
//   - GitHub OAuth login fails if GitHub password is wrong (the tikitaka-vip GitHub account uses a token,
//     not the agent password TK!v1p_2026WC#secure)
//
// Credentials used:
//   - Email: tikitaka.vip@aiemailservice.com
//   - Password: TK!v1p_2026WC#secure
//   - Username: tikitaka_vip
//   - Display name: Tiki Taka
//
// Results:
//   - Profile: https://dev.to/tikitaka_vip
//   - Article: https://dev.to/tikitaka_vip/we-built-a-world-cup-2026-prediction-game-where-you-compete-against-a-monkey-4c0m
//   - Registered: 2026-06-03

'use strict';

const puppeteer = require('puppeteer-core');
const path = require('path');
const { execSync } = require('child_process');

const PROFILE_URL = 'https://dev.to/tikitaka_vip';
const ARTICLE_URL = 'https://dev.to/tikitaka_vip/we-built-a-world-cup-2026-prediction-game-where-you-compete-against-a-monkey-4c0m';

async function screenshot(page, name) {
  const p = `/tmp/${name}.png`;
  await page.screenshot({ path: p, fullPage: false });
  try { execSync(`python3 ~/.claude/hooks/resize-images.py ${p} --max-dim 1800`); } catch(e) {}
  return p;
}

function setNativeValue(page, selector, value) {
  return page.evaluate((sel, val) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, selector, value);
}

async function main() {
  const browser = await puppeteer.connect({
    browserURL: 'http://localhost:9222',
    defaultViewport: null
  });

  try {
    const page = (await browser.pages())[0];
    const client = await page.createCDPSession();

    // 1. Signup
    await page.goto('https://dev.to/users/sign_up?state=email_signup', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.bringToFront();
    await new Promise(r => setTimeout(r, 2000));

    // Fill form using native value setter
    await page.evaluate((password) => {
      function setVal(id, val) {
        const el = document.getElementById(id);
        if (!el) return false;
        const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
      setVal('user_name', 'Tiki Taka');
      setVal('user_username', 'tikitaka_vip');
      setVal('user_email', 'tikitaka.vip@aiemailservice.com');
      setVal('user_password', password);
      setVal('user_password_confirmation', password);
    }, 'TK!v1p_2026WC#secure');

    // NOTE: reCAPTCHA requires manual solve — user must check "I'm not a robot" and click "Sign up"
    console.log('Form filled. User must solve reCAPTCHA and click Sign up.');

    // 2. After signup: click confirmation link from email
    // curl -s "https://aiemailservice.com/v1/mailbox/mbx_de7d0e26018b4364/wait?timeout=60&subject_contains=confirm" -H "x-api-key: ak_c026ce1fe7164b70ab96f5d013761341"
    // Then navigate to the confirmation_token URL

    // 3. Profile settings
    await page.goto('https://dev.to/settings/profile', { waitUntil: 'networkidle2', timeout: 30000 });
    await page.bringToFront();
    await new Promise(r => setTimeout(r, 2000));

    await setNativeValue(page, '#profile\\[summary\\]', 'Building TikiTaka — a free World Cup 2026 prediction game with a monkey competitor. https://tikitaka.vip');
    await setNativeValue(page, '#profile\\[website_url\\]', 'https://tikitaka.vip');
    await setNativeValue(page, '#profile\\[location\\]', 'Tel Aviv, Israel');

    // Click "Save Profile Information"
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const btn of btns) {
        if (btn.textContent.includes('Save Profile')) { btn.click(); return; }
      }
    });

    // 4. Create article
    await page.goto('https://dev.to/new', { waitUntil: 'networkidle2', timeout: 30000 });
    await page.bringToFront();
    await new Promise(r => setTimeout(r, 3000));

    await setNativeValue(page, '#article-form-title', 'We Built a World Cup 2026 Prediction Game Where You Compete Against a Monkey');

    // Tags
    const tagInput = await page.$('#tag-input');
    if (tagInput) {
      for (const tag of ['worldcup', 'football', 'webdev', 'showdev']) {
        await tagInput.click();
        await client.send('Input.insertText', { text: tag });
        await page.keyboard.press('Enter');
        await new Promise(r => setTimeout(r, 400));
      }
    }

    // Body
    await setNativeValue(page, '#article_body_markdown', '... article content ...');

    // Publish
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const btn of btns) {
        if (btn.textContent.trim().toLowerCase() === 'publish') { btn.click(); return; }
      }
    });

    console.log('Profile:', PROFILE_URL);
    console.log('Article:', ARTICLE_URL);
  } finally {
    await browser.disconnect();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, PROFILE_URL, ARTICLE_URL };
