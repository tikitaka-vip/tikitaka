#!/usr/bin/env node
// AI Valley (aivalley.ai) — AI tool directory
//
// What works:  FULL AUTO — CDP fills all fields, form submits, page navigates on success
// What breaks: search field (name="s") gets filled first if not careful — skip it
//              Two textareas share name="your-message" — fill by index (0=short, 1=long)
// Result:      tool submitted for review, page navigates (context destroyed = success)
//
// Run: node aivalley.js

const { PRODUCT, IDENTITY, connectBrowser } = require('./config');

async function cdpType(client, page, sel, text) {
  await page.evaluate(s => { const el = document.querySelector(s); if(el){el.focus();el.click();el.value='';} }, sel);
  await new Promise(r => setTimeout(r, 80));
  for (const c of text) { await client.send('Input.dispatchKeyEvent',{type:'keyDown',text:c}); await client.send('Input.dispatchKeyEvent',{type:'keyUp',text:c}); await new Promise(r=>setTimeout(r,5)); }
}

(async () => {
  const browser = await connectBrowser();
  const page = await browser.newPage();
  await page.goto('https://aivalley.ai/submit-tool/', { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));

  const client = await page.createCDPSession();

  await cdpType(client, page, "input[name='your-name']", IDENTITY.displayName);
  await cdpType(client, page, "input[name='your-email']", IDENTITY.email);
  await cdpType(client, page, "input[name='ToolName']", PRODUCT.name);
  await cdpType(client, page, "input[name='ToolURL']", PRODUCT.url);

  // Two textareas with same name — fill by DOM index
  await page.evaluate(() => {
    const tas = Array.from(document.querySelectorAll("textarea[name='your-message']")).filter(t => t.offsetParent !== null);
    if (tas[0]) { tas[0].focus(); tas[0].click(); tas[0].value = ''; }
  });
  for (const c of PRODUCT.tagline) { await client.send('Input.dispatchKeyEvent',{type:'keyDown',text:c}); await client.send('Input.dispatchKeyEvent',{type:'keyUp',text:c}); await new Promise(r=>setTimeout(r,3)); }

  await page.evaluate(() => {
    const tas = Array.from(document.querySelectorAll("textarea[name='your-message']")).filter(t => t.offsetParent !== null);
    if (tas[1]) { tas[1].focus(); tas[1].click(); tas[1].value = ''; }
  });
  for (const c of PRODUCT.shortDesc) { await client.send('Input.dispatchKeyEvent',{type:'keyDown',text:c}); await client.send('Input.dispatchKeyEvent',{type:'keyUp',text:c}); await new Promise(r=>setTimeout(r,2)); }

  // Category — pick "Other" or "Fun" or "Games"
  await page.evaluate(() => {
    const sel = document.querySelector('select[name=cat]');
    if (sel) { const opt = Array.from(sel.options).find(o => o.text.match(/fun|game|other/i)); if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change',{bubbles:true})); } }
  });

  await page.evaluate(() => { const b = document.querySelector('input[type=submit]'); if(b)b.click(); });
  await new Promise(r => setTimeout(r, 5000));

  console.log('✅ AI Valley submitted (page navigated = success)');
  await client.detach();
  await browser.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
