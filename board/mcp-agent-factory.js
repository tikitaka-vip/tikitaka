#!/usr/bin/env node
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const fs = require('fs');
const path = require('path');

const FACTORY_DIR = process.env.AGENT_FACTORY_DIR || path.join(process.env.HOME, '.agent-factory');
const FOUNDER_OS_DIR = process.env.FOUNDER_OS_DIR || path.join(process.env.HOME, '.claude/founder-os');
const ROLE = process.env.AGENT_ROLE || 'po'; // po | builder | growth-browser

const server = new Server(
  { name: 'agent-factory', version: '2.0.0' },
  { capabilities: { tools: {} } }
);

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }
function readText(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }

// --- Tool definitions per role ---

const TOOLS = {
  // Everyone gets these
  list_personas: {
    roles: ['po', 'builder', 'growth-browser', 'growth-content'],
    description: 'List agent personas and which platforms they have active accounts on.',
    input: {},
  },
  get_persona: {
    roles: ['po', 'builder', 'growth-browser', 'growth-content'],
    description: 'Get all platform accounts for a specific persona.',
    input: { name: { type: 'string', description: 'Persona slug' } },
    required: ['name'],
  },
  list_services: {
    roles: ['po', 'builder', 'growth-browser', 'growth-content'],
    description: 'Shared services: 2captcha, TG bot, email APIs, Cloudflare. Shows balances.',
    input: {},
  },
  get_capabilities: {
    roles: ['po', 'builder', 'growth-browser', 'growth-content'],
    description: 'What the agent team CAN and CANNOT do.',
    input: {},
  },

  // Playbooks — PO gets all, others get their domain
  get_playbook: {
    roles: ['po', 'builder', 'growth-browser', 'growth-content'],
    description: 'Get domain workflow (code/marketing/distribution/automation/infrastructure/growth).',
    input: { domain: { type: 'string' } },
    required: ['domain'],
  },

  // PO-only: exemplars and escalation (strategic decision tools)
  get_exemplars: {
    roles: ['po'],
    description: 'Past founder decisions as situation→decision→outcome records. Filter by domain.',
    input: { domain: { type: 'string', description: 'Optional domain filter' } },
  },
  get_escalation_rules: {
    roles: ['po'],
    description: 'When to act autonomously vs notify vs ask vs never do.',
    input: {},
  },

  // Builder gets deploy
  deploy: {
    roles: ['builder'],
    description: 'Deploy latest code to production. Runs git pull + restart + health check.',
    input: { confirm: { type: 'boolean' } },
    required: ['confirm'],
  },

  // Growth-Browser gets browser tools
  browser_setup_guide: {
    roles: ['growth-browser'],
    description: 'How to set up a stealth browser session as a persona. Returns launch command and Puppeteer integration pattern.',
    input: { persona: { type: 'string', description: 'Persona slug to launch as' } },
    required: ['persona'],
  },
  list_browser_profiles: {
    roles: ['growth-browser'],
    description: 'Available Chrome profiles for browser automation.',
    input: {},
  },
  list_social_publisher_scripts: {
    roles: ['po', 'growth-browser'],
    description: 'CDP scripts for creating social media accounts and connecting them to the social publisher service. Covers Pinterest, Mastodon, Buffer, Ayrshare.',
    input: {},
  },
  get_social_publisher_status: {
    roles: ['po', 'growth-browser', 'growth-content'],
    description: 'Status of the social publisher service — which platforms have working API posting, which need account setup.',
    input: {},
  },
  get_credentials: {
    roles: ['builder', 'growth-browser'],
    description: 'Read credentials from Infisical for a given path. Paths: /shared (Cloudflare, 2captcha, TG, email APIs), /ops/<project> (project infra), /personas/<slug> (platform passwords). Returns key names and values.',
    input: {
      path: { type: 'string', description: 'Infisical path, e.g. /shared, /ops/tikitaka, /personas/tikitaka_vip' },
    },
    required: ['path'],
  },
  set_credential: {
    roles: ['builder', 'growth-browser'],
    description: 'Store a credential in Infisical. Use after registering on a new platform.',
    input: {
      path: { type: 'string', description: 'Infisical path, e.g. /personas/tikitaka_vip' },
      key: { type: 'string', description: 'Secret name, e.g. PINTEREST_PASSWORD' },
      value: { type: 'string', description: 'Secret value' },
    },
    required: ['path', 'key', 'value'],
  },
  list_credential_paths: {
    roles: ['po', 'builder', 'growth-browser', 'growth-content'],
    description: 'List all credential paths in Infisical — shows what credentials exist without revealing values.',
    input: {},
  },
};

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: Object.entries(TOOLS)
    .filter(([, t]) => t.roles.includes(ROLE))
    .map(([name, t]) => ({
      name,
      description: t.description,
      inputSchema: {
        type: 'object',
        properties: t.input,
        ...(t.required ? { required: t.required } : {}),
      },
    })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const tool = TOOLS[name];
  if (!tool || !tool.roles.includes(ROLE)) {
    return { content: [{ type: 'text', text: `Tool "${name}" not available for role "${ROLE}"` }] };
  }

  switch (name) {
    case 'list_personas': {
      const agentsDir = path.join(FACTORY_DIR, 'agents');
      const result = [];
      if (fs.existsSync(agentsDir)) {
        for (const agentName of fs.readdirSync(agentsDir)) {
          const accounts = readJson(path.join(agentsDir, agentName, 'accounts.json'));
          if (!accounts) continue;
          const platforms = {};
          for (const cat of ['forums', 'directories', 'profiles', 'other']) {
            if (accounts[cat]) {
              for (const [k, v] of Object.entries(accounts[cat])) {
                platforms[k] = v.status || 'unknown';
              }
            }
          }
          const active = Object.values(platforms).filter(s =>
            ['active', 'approved', 'live', 'listed', 'registered'].includes(s)
          ).length;
          result.push(`${agentName} (${accounts._project || '?'}): ${active} active / ${Object.keys(platforms).length} total`);
          const activeList = Object.entries(platforms).filter(([,s]) =>
            ['active', 'approved', 'live', 'listed'].includes(s)
          ).map(([k]) => k);
          if (activeList.length) result.push(`  Active: ${activeList.join(', ')}`);
        }
      }
      return { content: [{ type: 'text', text: result.join('\n') || 'No personas found' }] };
    }

    case 'get_persona': {
      const accounts = readJson(path.join(FACTORY_DIR, 'agents', args.name, 'accounts.json'));
      if (!accounts) return { content: [{ type: 'text', text: `Persona "${args.name}" not found` }] };
      const lines = [];
      for (const cat of ['forums', 'directories', 'profiles', 'other']) {
        if (!accounts[cat]) continue;
        lines.push(`\n## ${cat}`);
        for (const [k, v] of Object.entries(accounts[cat])) {
          lines.push(`- ${k}: ${v.status}${v.thread ? ' thread=' + v.thread : ''}${v.profileUrl ? ' ' + v.profileUrl : ''}`);
        }
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }

    case 'list_services': {
      const sr = readJson(path.join(FACTORY_DIR, 'shared-resources.json'));
      if (!sr) return { content: [{ type: 'text', text: 'No shared-resources.json' }] };
      const lines = [];
      for (const [k, v] of Object.entries(sr.services || {})) {
        const bal = v.balance_usd != null ? ` ($${v.balance_usd})` : '';
        lines.push(`- ${k}: ${v.type}${bal} — ${(v.notes || '').substring(0, 80)}`);
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }

    case 'get_capabilities': {
      const manifest = readText(path.join(FOUNDER_OS_DIR, 'capabilities.md'));
      return { content: [{ type: 'text', text: manifest || 'No capabilities manifest' }] };
    }

    case 'get_playbook': {
      const playbooks = readText(path.join(FOUNDER_OS_DIR, 'playbooks.md'));
      if (!playbooks) return { content: [{ type: 'text', text: 'No playbooks' }] };
      const sections = playbooks.split(/^## /m);
      const match = sections.find(s => s.toLowerCase().includes((args.domain || '').toLowerCase()));
      if (match) return { content: [{ type: 'text', text: '## ' + match }] };
      return { content: [{ type: 'text', text: `No playbook for "${args.domain}". Available: ${sections.map(s => s.split('\n')[0]).filter(Boolean).join(', ')}` }] };
    }

    case 'get_exemplars': {
      const exemplars = readText(path.join(FOUNDER_OS_DIR, 'exemplars.md'));
      if (!exemplars) return { content: [{ type: 'text', text: 'No exemplars' }] };
      if (args.domain) {
        const blocks = exemplars.split('\n---');
        const filtered = blocks.filter(b => b.toLowerCase().includes(args.domain.toLowerCase()));
        return { content: [{ type: 'text', text: filtered.join('\n---') || `No exemplars for "${args.domain}"` }] };
      }
      return { content: [{ type: 'text', text: exemplars }] };
    }

    case 'get_escalation_rules': {
      const esc = readText(path.join(FOUNDER_OS_DIR, 'escalation.md'));
      return { content: [{ type: 'text', text: esc || 'No escalation rules' }] };
    }

    case 'deploy': {
      if (!args.confirm) return { content: [{ type: 'text', text: 'Deploy cancelled — pass confirm: true' }] };
      const { execSync } = require('child_process');
      const ts = new Date().toISOString();
      try {
        const out = execSync('sudo /opt/board/scripts/deploy-prod.sh', { timeout: 30000 }).toString();
        fs.appendFileSync('/home/agent/deploy.log', `${ts} role=${ROLE} result=ok\n`);
        return { content: [{ type: 'text', text: `Deployed:\n${out}` }] };
      } catch (e) {
        fs.appendFileSync('/home/agent/deploy.log', `${ts} role=${ROLE} result=fail error=${e.message}\n`);
        return { content: [{ type: 'text', text: `Deploy failed: ${e.message}` }] };
      }
    }

    case 'browser_setup_guide': {
      const slug = args.persona;
      const profileDir = path.join(FACTORY_DIR, 'chrome-profiles', slug);
      const exists = fs.existsSync(profileDir);
      return { content: [{ type: 'text', text: `## Browser setup for ${slug}
Profile: ${exists ? profileDir : 'NOT FOUND — create with: mkdir -p ' + profileDir}

### Launch
npx tsx src/launch-browser.ts ${slug}
Opens Chrome with unique fingerprint. Cookies/sessions persist.

### Interact (in Puppeteer code)
import { setupAgentBrowser, applyStealthProfile } from "./browser-profile.js";
import { createHumanBehavior } from "./human-behavior.js";

const profile = setupAgentBrowser("${slug}");
const page = await browser.newPage();
await applyStealthProfile(page, profile);
const human = createHumanBehavior(page, profile.fingerprint);

// Use human.* instead of page.* — passes bot detection
await human.click("button.login");
await human.type("#username", "the_username");
await human.idle(2000, 5000);
await human.scrollDown(500);

### Platform signup scripts (pre-built CDP automations)
At /home/ubuntu/projects/social-publisher/scripts/:
Run with: node <script> --chrome-port=XXXX
Available: signup-pinterest, signup-mastodon, setup-mastodon-token, signup-buffer, signup-ayrshare, create-pinterest-board, connect-ayrshare-pinterest

### IP rotation
Toggle airplane mode on USB-tethered Android:
adb shell cmd connectivity airplane_mode enable && sleep 3 && adb shell cmd connectivity airplane_mode disable && sleep 5

### Constraints
- Laptop only — VPS has no display
- CAPTCHAs: pause + TG notification to operator
- One persona per Chrome instance
- Mobile-only platforms (TikTok, IG stories) need Android emulator` }] };
    }

    case 'list_browser_profiles': {
      const chromeDir = path.join(FACTORY_DIR, 'chrome-profiles');
      const profiles = fs.existsSync(chromeDir) ? fs.readdirSync(chromeDir) : [];
      return { content: [{ type: 'text', text: `${profiles.length} profiles: ${profiles.join(', ')}\n\nLaptop only. Launch with: npx tsx src/launch-browser.ts <slug>` }] };
    }

    case 'list_social_publisher_scripts': {
      const scriptsDir = '/home/ubuntu/projects/social-publisher/scripts';
      const scripts = [];
      if (fs.existsSync(scriptsDir)) {
        for (const f of fs.readdirSync(scriptsDir)) {
          if (f.endsWith('.js')) scripts.push(f);
        }
      }
      return { content: [{ type: 'text', text: `## Social Publisher Signup Scripts
At: ${scriptsDir}
Scripts: ${scripts.join(', ') || 'none found'}

Usage: node <script> --chrome-port=XXXX
Requires: Chrome running with --remote-debugging-port on that port.

Key flows:
1. Create account: signup-pinterest.js, signup-mastodon.js, signup-buffer.js, signup-ayrshare.js
2. Get API token: setup-mastodon-token.js
3. Connect platforms: create-pinterest-board.js, then connect-ayrshare-pinterest.js

See scripts/README.md for full docs.
Laptop only — needs Chrome.` }] };
    }

    case 'get_social_publisher_status': {
      return { content: [{ type: 'text', text: `## Social Publisher Service
Running: VPS 64.177.65.238:3847 (systemd)
14 platforms supported.

Working now:
- Mastodon: direct API, tested

Wired but need account connect on Ayrshare dashboard:
- Pinterest: Ayrshare adapter tested, pin posted successfully
- Facebook, Instagram, X/Twitter, LinkedIn, TikTok, YouTube, Threads, Bluesky, Telegram, Reddit, Google Business, WordPress

To add a new platform:
1. Run signup script (laptop, Chrome) to create account
2. Connect it on Ayrshare dashboard
3. Post via: curl -X POST http://64.177.65.238:3847/api/publish -d '{"platforms":["mastodon"],"text":"hello","mediaUrls":[]}'` }] };
    }

    case 'get_credentials': {
      const { execSync } = require('child_process');
      try {
        const out = execSync(
          `/usr/local/bin/infisical secrets --env=prod --path=${args.path} --projectId=9a155f01-a409-4e9a-85de-0b1d99e2fe09 --silent 2>/dev/null`,
          { timeout: 10000 }
        ).toString();
        return { content: [{ type: 'text', text: out || `No secrets at ${args.path}` }] };
      } catch (e) {
        // Fallback to local credentials.env
        const localFile = args.path === '/shared'
          ? path.join(FACTORY_DIR, 'credentials.env')
          : path.join(FACTORY_DIR, 'projects', args.path.replace('/ops/', ''), 'credentials.env');
        const local = readText(localFile);
        if (local) return { content: [{ type: 'text', text: `(from local fallback)\n${local}` }] };
        return { content: [{ type: 'text', text: `Infisical failed and no local fallback: ${e.message}` }] };
      }
    }

    case 'set_credential': {
      const { execSync } = require('child_process');
      try {
        execSync(
          `/usr/local/bin/infisical secrets set ${args.key}=${args.value} --env=prod --path=${args.path} --projectId=9a155f01-a409-4e9a-85de-0b1d99e2fe09 --silent`,
          { timeout: 10000 }
        );
        return { content: [{ type: 'text', text: `Stored ${args.key} at ${args.path}` }] };
      } catch (e) {
        return { content: [{ type: 'text', text: `Failed to store: ${e.message}` }] };
      }
    }

    case 'list_credential_paths': {
      return { content: [{ type: 'text', text: `## Infisical Credential Paths

/shared/                  — Cloudflare, 2captcha, Telegram, Bing, Porkbun, email APIs
/ops/humanpages/          — Zoho for humanpages.ai
/ops/tikitaka/            — Zoho for tikitaka.vip, CF zone ID
/personas/tikitaka_vip/   — platform passwords, GitHub, email
/personas/orion_vance/    — username, email, mailbox
/personas/aria_walsh/     — empty
/personas/nora_ellison/   — empty
/personas/zane_torres/    — empty
/personas/dev_patel/      — empty
/personas/felix_brooks/   — empty
/personas/kai_nakamura/   — empty
/personas/luna_reyes/     — empty
/personas/maya_chen/      — empty
/personas/sam_okafor/     — empty

Read: get_credentials(path="/shared")
Write: set_credential(path="/personas/orion_vance", key="REDDIT_PASSWORD", value="xxx")

Rule: after registering on any platform, store the credential here immediately.` }] };
    }

    default:
      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch(console.error);
