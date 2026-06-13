const puppeteer = require('puppeteer-core');
const fs = require('fs');

/**
 * Webwiki Directory Submission Script
 * NOTE: Webwiki.com is a content magazine site, not a business directory.
 * The actual business directory is webwiki.de (German site - blocked by Cloudflare).
 *
 * This script was created as a placeholder, as tikitaka.vip was instead
 * successfully submitted to start.me instead, which serves a similar purpose.
 */

async function main() {
  console.log('[Info] Webwiki.com is a content magazine, not a business directory.');
  console.log('[Info] Attempted to access webwiki.de (business listing site), but it is blocked by Cloudflare.');
  console.log('[Fallback] Tikitaka.vip was successfully registered on start.me instead.');

  // Update accounts.json with webwiki entry
  const accountsPath = '/home/ubuntu/.agent-factory/agents/tikitaka_vip/accounts.json';
  if (fs.existsSync(accountsPath)) {
    const accounts = JSON.parse(fs.readFileSync(accountsPath, 'utf8'));
    if (!accounts.directories) accounts.directories = {};

    accounts.directories.webwiki = {
      url: 'webwiki.com',
      status: 'not_applicable',
      registered: new Date().toISOString().split('T')[0],
      notes: 'webwiki.com is a content magazine. Business directory webwiki.de is Cloudflare-blocked. Use start.me instead (completed).'
    };

    fs.writeFileSync(accountsPath, JSON.stringify(accounts, null, 2));
    console.log('[Updated] accounts.json with webwiki status');
  }
}

main().catch(console.error);
