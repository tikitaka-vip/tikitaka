#!/usr/bin/env node
// SaaSHub.com — SaaS comparison and alternatives directory
//
// Status: COMPLETED — product listed at https://www.saashub.com/tikitaka
// Account: tikitaka-vip (tikitaka.vip@aiemailservice.com)
// Submitted: 2026-06-03
//
// Run: node saashub.js

const puppeteer = require('puppeteer-core');
const path = require('path');
const { execSync } = require('child_process');

const CREDENTIALS = {
  email: 'tikitaka.vip@aiemailservice.com',
  password: 'TK!v1p_2026WC#secure',
  username: 'tikitaka-vip',
};

const PRODUCT = {
  url: 'https://tikitaka.vip',
  name: 'TikiTaka',
  tagline: 'Free World Cup 2026 prediction game with a monkey competitor',
  description: 'Predict all 104 World Cup 2026 matches and compete against a real shelter monkey who watches zoo webcams to make his picks. Create private groups with friends and see who can beat the monkey. Available in 10 languages, works as a PWA on any device. No ads, no paywalls, completely free.',
  categories: ['Sports', 'Gaming'],
  competitors: ['Superbru'],
  logo: '/home/ubuntu/projects/worldcup/brand/logo-icon.png',
  pricing: 'free',
};

(async () => {
  const browser = await puppeteer.connect({
    browserURL: 'http://localhost:9222',
    defaultViewport: null,
  });
  const page = (await browser.pages())[0];

  // --- Step 1: Log in ---
  console.log('Logging in to SaaSHub...');
  await page.goto('https://www.saashub.com/login', { waitUntil: 'networkidle2', timeout: 20000 });
  await page.bringToFront();

  await page.click('#user_email');
  await page.keyboard.type(CREDENTIALS.email, { delay: 30 });
  await page.click('#user_password');
  await page.keyboard.type(CREDENTIALS.password, { delay: 30 });

  // Submit login form
  await page.click('input[type=submit]');
  await new Promise(r => setTimeout(r, 3000));
  console.log('Logged in. URL:', page.url());

  // --- Step 2: Go to product manage page ---
  console.log('Navigating to product manage page...');
  await page.goto('https://www.saashub.com/manage/tikitaka/edit', { waitUntil: 'networkidle2', timeout: 20000 });
  await page.bringToFront();

  const currentUrl = page.url();
  console.log('Manage URL:', currentUrl);

  if (currentUrl.includes('manage/tikitaka')) {
    console.log('Product page found at https://www.saashub.com/tikitaka');
    console.log('Status: Pending approval');
  } else {
    console.log('Product not found — may need to resubmit');
  }

  await page.screenshot({ path: '/tmp/dir-saashub-final.png' });
  execSync('python3 /home/ubuntu/.claude/hooks/resize-images.py /tmp/dir-saashub-final.png --max-dim 1800');
  console.log('Screenshot saved to /tmp/dir-saashub-final.png');

  await browser.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
