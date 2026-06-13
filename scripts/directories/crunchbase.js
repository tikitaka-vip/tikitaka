#!/usr/bin/env node
// Crunchbase.com — startup database (high DA)
//
// What works:  nothing automated — Cloudflare blocks puppeteer
// What breaks: Cloudflare anti-bot on signup page
// Result:      must be done manually from a real browser
//
// Run: node crunchbase.js
// Then manually register at https://www.crunchbase.com/register

const { PRODUCT, IDENTITY } = require('./config');

console.log(`
=== Crunchbase Registration ===
URL: https://www.crunchbase.com/register

⚠️  Cloudflare blocks automated browsers. Do this from your own browser.

Fill these fields:

First Name:   ${IDENTITY.firstName}
Last Name:    ${IDENTITY.lastName}
Email:        ${IDENTITY.email}
Password:     ${IDENTITY.password}

After signup, create an Organization:
  Organization Name: ${PRODUCT.name}
  Website:           ${PRODUCT.url}
  Short Description: ${PRODUCT.tagline}
  Headquarters:      ${IDENTITY.location}
  Categories:        Sports, Gaming, Entertainment
`);
