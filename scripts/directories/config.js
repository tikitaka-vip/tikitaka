// Directory submission config — edit this for a different product
// All scripts in this folder import from here
//
// Credentials loaded from:
//   ~/.agent-factory/credentials.env          (shared: CF, 2captcha, TG, agent email)
//   ~/.agent-factory/projects/tikitaka/credentials.env  (project: zoho, github, directory accounts)

const fs = require('fs');
const path = require('path');

function loadEnv(filepath) {
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq > 0) process.env[trimmed.substring(0, eq)] = trimmed.substring(eq + 1);
    }
  } catch (e) {}
}

loadEnv(path.join(process.env.HOME, '.agent-factory/credentials.env'));                    // shared: CF, 2captcha, TG
loadEnv(path.join(process.env.HOME, '.agent-factory/projects/tikitaka/credentials.env'));  // project: zoho, CF zone
loadEnv(path.join(process.env.HOME, '.agent-factory/agents/tikitaka_vip/credentials.env'));// agent: identity, email, github

const PRODUCT = {
  name: 'TikiTaka',
  url: 'https://tikitaka.vip',
  tagline: 'Free World Cup 2026 prediction game where you compete against a monkey that watches real zoo webcams',
  shortDesc: 'Predict all 104 World Cup matches. Create groups with friends. Try to beat a monkey that watches real zoo webcams to make its picks.',
  fullDesc: `TikiTaka is a free prediction game for the FIFA World Cup 2026 (June 11 - July 19). Predict results for all 104 matches, pick the champion, runner-up, and top scorer. Create private groups with friends and compare scores.

The twist: every group gets a monkey competitor. Every morning at 10:00, the system screenshots live webcams from five zoos — baboons and orangutans in San Diego, gorillas in Atlanta, snow monkeys in Japan, bonobos in Congo — and analyzes what the monkeys are doing to generate match predictions. Five analysis methods, median wins.

If a gorilla is sleeping, it predicts 0-0.

Available in 10 languages. No ads, no paywalls. Works as a PWA on any device.`,
  tags: 'world cup, football, soccer, predictions, sports, game, monkey, 2026',
  category: 'Sports & Entertainment / Gaming',
  logoPath: '/home/ubuntu/projects/worldcup/brand/logo-icon.png',
  screenshotsDir: '/home/ubuntu/projects/worldcup/brand/screenshots/',
};

const IDENTITY = {
  firstName: process.env.AGENT_FIRST_NAME || 'Tiki',
  lastName: process.env.AGENT_LAST_NAME || 'Taka',
  displayName: process.env.AGENT_DISPLAY_NAME || `${process.env.AGENT_FIRST_NAME || 'Tiki'} ${process.env.AGENT_LAST_NAME || 'Taka'}`,
  username: process.env.AGENT_USERNAME || 'tikitaka_vip',
  email: process.env.AGENT_EMAIL || 'tikitaka.vip@aiemailservice.com',
  password: process.env.AGENT_PASSWORD || 'TK!v1p_2026WC#secure',
  passwordShort: process.env.AGENT_PASSWORD_SHORT || 'TKv1p2026WCsec',
  location: process.env.AGENT_LOCATION || 'Tel Aviv, Israel',
  phone: process.env.AGENT_PHONE || '+972000000000',
};

const MAILBOX = {
  id: process.env.AGENT_MAILBOX_ID || 'mbx_de7d0e26018b4364',
  apiKey: process.env.AGENT_EMAIL_API_KEY || 'ak_c026ce1fe7164b70ab96f5d013761341',
  baseUrl: 'https://aiemailservice.com/v1',
};

const CAPTCHA = {
  apiKey: process.env.TWOCAPTCHA_API_KEY || '0435dd4ebf6dbe995fed7031fe32f978',
};

async function connectBrowser() {
  const puppeteer = require('puppeteer-core');
  return puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
}

async function waitForEmail(subjectContains, timeout = 60) {
  const resp = await fetch(
    `${MAILBOX.baseUrl}/mailbox/${MAILBOX.id}/wait?timeout=${timeout}&subject_contains=${encodeURIComponent(subjectContains)}`,
    { headers: { 'x-api-key': MAILBOX.apiKey } }
  );
  return resp.json();
}

async function getEmails() {
  const resp = await fetch(
    `${MAILBOX.baseUrl}/mailbox/${MAILBOX.id}/messages`,
    { headers: { 'x-api-key': MAILBOX.apiKey } }
  );
  return resp.json();
}

async function getEmailBody(id) {
  const resp = await fetch(
    `${MAILBOX.baseUrl}/mailbox/${MAILBOX.id}/messages/${id}`,
    { headers: { 'x-api-key': MAILBOX.apiKey } }
  );
  return resp.json();
}

async function confirmEmail(browser, url) {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  const body = await page.evaluate(() => document.body.innerText.substring(0, 200));
  await page.close();
  return body;
}

module.exports = { PRODUCT, IDENTITY, MAILBOX, CAPTCHA, connectBrowser, waitForEmail, getEmails, getEmailBody, confirmEmail };
