/**
 * Flickr directory registration for TikiTaka
 *
 * Account: tikitaka.vip@aiemailservice.com
 * Username: tikitaka.vip (Display: Tiki Taka)
 * Profile: https://www.flickr.com/people/204670818@N06/
 * Photo: https://www.flickr.com/photos/204670818@N06/55313685433/
 *
 * Registration completed: 2026-06-04
 * Bio: "Free World Cup 2026 prediction game. Beat a monkey that watches real zoo webcams. https://tikitaka.vip"
 * Backlink: https://tikitaka.vip (in bio)
 * Photo uploaded: TikiTaka homepage screenshot (01-homepage-desktop.png)
 */

const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const WebSocket = require('/tmp/node_modules/ws');
const fs = require('fs');

const CREDENTIALS = {
  email: 'tikitaka.vip@aiemailservice.com',
  password: 'TK!v1p_2026WC#secure',
  displayName: 'Tiki Taka',
  username: 'tikitaka.vip',
  profileId: '204670818@N06',
  profileUrl: 'https://www.flickr.com/people/204670818@N06/',
  photoUrl: 'https://www.flickr.com/photos/204670818@N06/55313685433/',
};

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function createCDP(pageId) {
  const ws = new WebSocket(`ws://localhost:9222/devtools/page/${pageId}`);
  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
    setTimeout(() => reject(new Error('ws connect timeout')), 5000);
  });
  let msgId = 1;
  const pending = new Map();
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  });
  const send = (method, params = {}, timeout = 20000) => new Promise((resolve, reject) => {
    const id = msgId++;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, timeout);
    pending.set(id, (msg) => { clearTimeout(timer); resolve(msg); });
    ws.send(JSON.stringify({ id, method, params }));
  });
  return { send, close: () => ws.close() };
}

async function evaluate(cdp, expr) {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true });
  return r.result?.result?.value;
}

async function screenshot(cdp, path) {
  const result = await cdp.send('Page.captureScreenshot', { format: 'png' }, 5000);
  if (result.result?.data) {
    fs.writeFileSync(path, Buffer.from(result.result.data, 'base64'));
    try { execSync(`python3 /home/ubuntu/.claude/hooks/resize-images.py ${path} --max-dim 1800`); } catch(e) {}
    console.log('Screenshot:', path);
  }
}

async function loginToFlickr() {
  const tabs = await fetch('http://localhost:9222/json').then(r => r.json());
  const flickrTab = tabs.find(t => t.type === 'page' && t.url.includes('flickr'));

  let pageCdp;
  if (flickrTab) {
    pageCdp = await createCDP(flickrTab.id);
  } else {
    // Need to open a new tab
    const newTab = await fetch('http://localhost:9222/json/new').then(r => r.json());
    pageCdp = await createCDP(newTab.id);
  }

  // Navigate to Flickr login
  await pageCdp.send('Page.navigate', { url: 'https://identity.flickr.com/' });
  await sleep(3000);

  const currentUrl = await evaluate(pageCdp, 'window.location.href');
  if (currentUrl.includes('identity.flickr') && !currentUrl.includes('photos')) {
    // Fill login form
    await evaluate(pageCdp, `(() => {
      const el = document.querySelector('#login-email');
      if (el) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, '${CREDENTIALS.email}');
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()`);
    await sleep(300);

    await evaluate(pageCdp, `document.querySelector('button[type="submit"], input[type="submit"]')?.click()`);
    await sleep(2000);

    // Password
    const pwField = await evaluate(pageCdp, `document.querySelector('#login-password')?.id`);
    if (pwField) {
      await evaluate(pageCdp, `(() => {
        const el = document.querySelector('#login-password');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, '${CREDENTIALS.password}');
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        document.querySelector('button[type="submit"]')?.click();
      })()`);
      await sleep(4000);
    }
  }

  return pageCdp;
}

async function navigateToProfile() {
  const pageCdp = await loginToFlickr();
  await pageCdp.send('Page.navigate', { url: CREDENTIALS.profileUrl });
  await sleep(3000);
  return pageCdp;
}

// Main function - returns profile info
async function main() {
  console.log('TikiTaka Flickr profile:');
  console.log('  Profile URL:', CREDENTIALS.profileUrl);
  console.log('  Photo URL:', CREDENTIALS.photoUrl);
  console.log('  Username:', CREDENTIALS.username);
  console.log('  Bio: Free World Cup 2026 prediction game...');
  console.log('  Backlink: https://tikitaka.vip (in bio)');
  return CREDENTIALS;
}

module.exports = { main, CREDENTIALS, loginToFlickr, navigateToProfile };

if (require.main === module) {
  main().then(info => console.log('Done:', JSON.stringify(info, null, 2))).catch(console.error);
}
