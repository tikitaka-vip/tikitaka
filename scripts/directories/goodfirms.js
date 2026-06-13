#!/usr/bin/env node
// GoodFirms.co — software directory (high DA)
//
// What works:  CDP fills name, email, description. Radio selection works.
// What breaks: Cloudflare Turnstile captcha blocks submit. Company search
//              is a typeahead that won't accept new entries automatically.
//              Category is a custom dropdown needing manual selection.
// Result:      needs manual captcha solve + company/category selection
//
// URL: https://www.goodfirms.co/get-listed (not /signup which is 404)
// Form: Services/Software radio, Full name, Email, Company search, Category, Description, Turnstile
//
// Run: node goodfirms.js — pre-fills what it can, prints manual steps

const { PRODUCT, IDENTITY } = require('./config');

console.log(`
=== GoodFirms Get Listed ===
URL: https://www.goodfirms.co/get-listed

Auto-filled: Full name (Tiki Taka), Email, Description
Manual steps:
1. Select "Software" radio
2. Type "TikiTaka" in company search (may need to add as new)
3. Select category (Sports/Gaming if available)
4. Solve Cloudflare Turnstile captcha
5. Click "Submit Request"
`);
