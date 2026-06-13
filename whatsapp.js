// WhatsApp Cloud API adapter. Mirrors the Telegram webhook: incoming messages
// are routed to the shared bot engine (bot-engine.js) for sign-up + guessing.
// Config comes from env (Infisical /ops/tikitaka), never hardcoded.

const https = require('https');
const crypto = require('crypto');
const { handleBotMessage } = require('./bot-engine');

const GRAPH_VERSION = 'v22.0';
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;

function httpPost(hostname, path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({ hostname, path, method: 'POST', headers: {
      'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data),
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
    }}, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data); req.end();
  });
}

// Send a plain text WhatsApp message. Only works inside the 24h customer-service
// window (i.e. after the user has messaged us) — which is exactly the bot flow.
async function sendWhatsApp(to, text) {
  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) { console.warn('⚠ WhatsApp not configured'); return false; }
  try {
    const res = await httpPost('graph.facebook.com', `/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`, {
      messaging_product: 'whatsapp', recipient_type: 'individual', to,
      type: 'text', text: { preview_url: false, body: text },
    });
    if (res.status !== 200) console.error('WA send failed:', res.status, res.body);
    return res.status === 200;
  } catch (e) { console.error('WA send error:', e.message); return false; }
}

// Verify Meta's X-Hub-Signature-256 against the raw request body.
function verifySignature(req) {
  if (!APP_SECRET) return true; // not configured -> skip (dev)
  const sig = req.headers['x-hub-signature-256'];
  if (!sig || !req.rawBody) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(req.rawBody).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)); } catch { return false; }
}

const processed = new Set(); // dedupe retried webhook deliveries within process lifetime

function setupWhatsAppRoutes(app, db) {
  // Webhook verification handshake (Meta calls this once on setup)
  app.get('/api/whatsapp/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === VERIFY_TOKEN) return res.status(200).send(challenge);
    return res.sendStatus(403);
  });

  // Incoming messages
  app.post('/api/whatsapp/webhook', async (req, res) => {
    if (!verifySignature(req)) return res.sendStatus(403);
    res.sendStatus(200); // ack immediately, then process

    try {
      const entries = req.body?.entry || [];
      for (const entry of entries) {
        for (const change of entry.changes || []) {
          const value = change.value || {};
          const contacts = value.contacts || [];
          for (const msg of value.messages || []) {
            if (msg.type !== 'text') continue;            // MVP: text only
            if (processed.has(msg.id)) continue;
            processed.add(msg.id);
            if (processed.size > 5000) processed.clear();

            const from = msg.from;                         // wa_id, e.g. "972506910990"
            const text = (msg.text?.body || '').trim();
            const profileName = contacts.find(c => c.wa_id === from)?.profile?.name || 'Player';

            await handleBotMessage(db, {
              platform: 'whatsapp', chatId: from, name: profileName,
              lang: 'he', text,
              send: (msgText) => sendWhatsApp(from, msgText),
            });
          }
        }
      }
    } catch (e) { console.error('WA webhook error:', e.message); }
  });
}

module.exports = { setupWhatsAppRoutes, sendWhatsApp };
