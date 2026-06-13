# Directory Submission Agent Prompt

## How to use

Launch **ONE subagent per directory, sequentially** (never parallel — they share one Chrome).
Wait for each agent to complete before launching the next.
Use `subagent_type: "general-purpose"` and run in **foreground** (not background).

```js
// Example orchestration
const directories = [
  { name: "selected-site", url: "https://selected.site/submit/" },
  { name: "nocodelist", url: "https://nocodelist.co/submit" },
  // ...
];
for (const dir of directories) {
  // Launch ONE agent, WAIT for it to finish, then next
  Agent({
    subagent_type: "general-purpose",
    description: `${dir.name}: register + submit`,
    prompt: PROMPT_TEMPLATE.replace(/DIRECTORY_NAME/g, dir.name).replace(/DIRECTORY_URL/g, dir.url)
  });
}
```

Replace DIRECTORY_NAME and DIRECTORY_URL in the prompt below, then pass it verbatim as the agent prompt.

---

## Prompt template

```
Register and submit TikiTaka on DIRECTORY_NAME (DIRECTORY_URL).

## Rules (MUST follow)
- Chrome is ALREADY running on port 9222. Do NOT launch a new Chrome. Connect: `puppeteer.connect({browserURL:'http://localhost:9222', defaultViewport:null})`
- ONE tab only. Close all non-chrome tabs before opening yours.
- NEVER use Google, Facebook, or LinkedIn sign-in. Only email/password or GitHub OAuth (tikitaka-vip account).
- Use screenshots at every step to see what you're doing. Resize: `python3 ~/.claude/hooks/resize-images.py /tmp/file.png --max-dim 1800`
- If site is dead/404/Cloudflare-blocked, report immediately and stop. Don't waste time.
- Do NOT call form.submit() on Zoho or XenForo sites — it breaks sessions.

## CDP keyevents (use for ALL form fills — this is the method that works)
```js
async function cdpType(client, page, sel, text) {
  await page.evaluate(s => { const el = document.querySelector(s); if(el){el.focus();el.click();el.value='';} }, sel);
  await new Promise(r => setTimeout(r, 80));
  for (const c of text) {
    await client.send('Input.dispatchKeyEvent', {type:'keyDown', text:c});
    await client.send('Input.dispatchKeyEvent', {type:'keyUp', text:c});
    await new Promise(r => setTimeout(r, 5));
  }
}
```

For Zoho/custom modals: use keyboard Enter (NOT mouse click) to confirm dialogs.
For iframes: use `page.frames().find(f => f.url().includes(...))` then `frame.evaluate()`.
For file uploads: use `page.waitForFileChooser()` or `inputHandle.uploadFile()`.

## Credentials (loaded from env, but here for reference)
- Email: tikitaka.vip@aiemailservice.com
- Password: TK!v1p_2026WC#secure (short: TKv1p2026WCsec for 16-char-max)
- Username: tikitaka_vip
- Name: Tiki Taka
- GitHub: tikitaka-vip

## Product info
- Name: TikiTaka
- URL: https://tikitaka.vip
- Tagline: Free World Cup 2026 prediction game where you compete against a monkey that watches real zoo webcams
- Short desc: Predict all 104 World Cup matches. Create groups with friends. Try to beat a monkey that watches real zoo webcams to make its picks.
- Category: Sports & Entertainment / Gaming
- Tags: world cup, football, soccer, predictions, sports, game, monkey
- Logo: /home/ubuntu/projects/worldcup/brand/logo-icon.png

## Email verification
```bash
# Check inbox
curl -s "https://aiemailservice.com/v1/mailbox/mbx_de7d0e26018b4364/messages" -H "x-api-key: ak_c026ce1fe7164b70ab96f5d013761341"
# Wait for specific email
curl -s "https://aiemailservice.com/v1/mailbox/mbx_de7d0e26018b4364/wait?timeout=30&subject_contains=KEYWORD" -H "x-api-key: ak_c026ce1fe7164b70ab96f5d013761341"
# Get full email body
curl -s "https://aiemailservice.com/v1/mailbox/mbx_de7d0e26018b4364/messages/MSG_ID" -H "x-api-key: ak_c026ce1fe7164b70ab96f5d013761341"
```

## Steps
1. Open DIRECTORY_URL — screenshot to see what's there
2. If needs signup, register (email/password or GitHub — NOT Google/Facebook)
3. Confirm email if needed (check inbox via API above)
4. Fill product submission with CDP keyevents
5. Upload logo if required (from /home/ubuntu/projects/worldcup/brand/logo-icon.png)
6. Submit — screenshot result
7. If stuck on a CAPTCHA, try 2captcha solver:
   ```js
   const {Solver} = require('@2captcha/captcha-solver');
   const solver = new Solver('0435dd4ebf6dbe995fed7031fe32f978');
   // hCaptcha: solver.hcaptcha({sitekey, pageurl})
   // reCAPTCHA: solver.recaptcha({googlekey, pageurl})
   ```

## Output (REQUIRED)
Write a script to /home/ubuntu/projects/worldcup/scripts/directories/DIRECTORY_NAME.js with:
- Comment header: what works, what breaks, result
- Import from ./config.js
- cdpType helper
- Full automation flow
- Fallback instructions for manual steps

Update accounts.json:
```bash
# Add to accounts tracker
node -e "
const f='/home/ubuntu/.agent-factory/agents/tikitaka_vip/accounts.json';
const a=JSON.parse(require('fs').readFileSync(f));
a.directories.DIRECTORY_NAME={url:'DIRECTORY_URL',status:'STATUS',registered:'$(date +%Y-%m-%d)'};
require('fs').writeFileSync(f,JSON.stringify(a,null,2));
"
```

## Notify on TG when stuck
```bash
curl -s "https://api.telegram.org/bot8445371320:AAE4YLFNtHH8jZx_NJgxbep9C0E7Z8RwP1c/sendMessage" \
  -d chat_id=6674342664 -d text="STUCK: description of what needs manual help"
```

puppeteer-core is at /tmp/node_modules. Work in /tmp.
```

---

## Remaining directories to attempt

From the original list, not yet tried:
- https://selected.site/submit/
- https://rankinpublic.xyz/
- https://nocodelist.co/submit
- https://hackernoon.com (GitHub OAuth — use magic link email, NOT Google)
- https://www.trustpilot.com (business.trustpilot.com/signup)

Already dead/blocked (skip):
ProvenExpert, SaaSWorthy, Crozdesk, Slant, StackShare, TopAI, Taaft, Futurepedia, F6S, Crunchbase, Devpost, AllTopStartups, EU-Startups, KillerStartups, MicroLaunch, SideProjectors, Fazier, GoodFirms (Turnstile), BetaBound, about.me (Facebook-only), StartupBase, StartupTracker, StartupRanking, toolfinder, launchboard.dev, launched.io, toolfolio.io, alternative.me, alternativeto (403), sourceforge (404), callupcontact (404), askmap (timeout), trustburn (404)
