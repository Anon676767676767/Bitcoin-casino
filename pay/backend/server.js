/**
 * OpPay Server — Express API + WebSocket
 *
 * Start: node server.js
 * Endpoints: http://localhost:3001/api/...
 * WebSocket: ws://localhost:3001
 */
import 'dotenv/config';
import express from 'express';
import cors    from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { openDb } from './db.js';
import * as db  from './db.js';
import { requireAuth, hashPassword, verifyPassword } from './auth.js';
import { deriveAddress, isValidAddress } from './derive.js';
import { startMonitor, setPushCallback, confirmEscrowReceipt } from './monitor.js';

// ─── Init ─────────────────────────────────────────────────────────────────────

openDb(process.env.DB_PATH || './oppay.db');

const app    = express();
const server = createServer(app);
const wss    = new WebSocketServer({ server });
const PORT   = parseInt(process.env.PORT || '3001');
const TESTNET = process.env.OPNET_NETWORK !== 'mainnet';
const EXPIRY_MINUTES = parseInt(process.env.SESSION_EXPIRY_MINUTES || '30');

app.use(cors());
app.use(express.json());

// ─── WebSocket ────────────────────────────────────────────────────────────────

// Map: merchantId → Set<WebSocket>
const merchantSockets = new Map();

wss.on('connection', (ws) => {
  let merchantId = null;

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'auth') {
        const m = db.getMerchantByApiKey(msg.api_key);
        if (!m) { ws.send(JSON.stringify({ type: 'error', message: 'Invalid key' })); return; }
        merchantId = m.id;
        if (!merchantSockets.has(merchantId)) merchantSockets.set(merchantId, new Set());
        merchantSockets.get(merchantId).add(ws);
        ws.send(JSON.stringify({ type: 'authenticated', merchant_id: merchantId }));
      } else if (msg.type === 'pong') {
        ws._alive = true;
      }
    } catch {}
  });

  ws.on('close', () => {
    if (merchantId) merchantSockets.get(merchantId)?.delete(ws);
  });

  ws._alive = true;
  ws.on('pong', () => { ws._alive = true; });
});

// Keep-alive ping every 30s
setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws._alive) return ws.terminate();
    ws._alive = false;
    ws.ping();
  });
}, 30_000);

function pushToMerchant(merchantId, type, data) {
  const sockets = merchantSockets.get(merchantId);
  if (!sockets?.size) return;
  const msg = JSON.stringify({ type, data, timestamp: Date.now() });
  sockets.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
}

setPushCallback(pushToMerchant);

// ─── BTC Price ────────────────────────────────────────────────────────────────

let cachedBtcPrice = 60000; // fallback EUR
let lastPriceFetch = 0;

async function getBtcPrice() {
  if (Date.now() - lastPriceFetch < 60_000) return cachedBtcPrice;
  try {
    const res  = await fetch(process.env.BTC_PRICE_API, { signal: AbortSignal.timeout(5000) });
    const json = await res.json();
    cachedBtcPrice = json?.bitcoin?.eur ?? cachedBtcPrice;
    lastPriceFetch = Date.now();
  } catch {
    console.warn('[price] Could not fetch BTC price, using cached:', cachedBtcPrice);
  }
  return cachedBtcPrice;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true, version: '1.0.0' }));

// ── Auth ──────────────────────────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, xpub, payout_address } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });
    if (db.getMerchantByEmail(email)) return res.status(409).json({ error: 'Email already registered' });

    const merchant = db.createMerchant({
      name, email,
      passwordHash: hashPassword(password),
      xpub:         xpub || null,
      payoutAddress: payout_address || null,
    });

    res.status(201).json(sanitize(merchant));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const merchant = db.getMerchantByEmail(email);
  if (!merchant || !verifyPassword(password, merchant.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  res.json(sanitize(merchant));
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json(sanitize(req.merchant));
});

// ── Sessions ──────────────────────────────────────────────────────────────────

/**
 * POST /api/sessions
 * Called from the MERCHANT'S OWN BACKEND — not client-side.
 * Returns a session the frontend SDK can poll.
 */
app.post('/api/sessions', requireAuth, async (req, res) => {
  try {
    const { amount_eur, description, method = 'bitcoin', metadata } = req.body;
    if (!amount_eur || amount_eur <= 0) return res.status(400).json({ error: 'amount_eur required' });

    const merchant  = req.merchant;
    const btcPrice  = await getBtcPrice();
    const amountBtc = parseFloat((amount_eur / btcPrice).toFixed(8));

    // Derive unique address
    let btcAddress, addressIndex;
    if (merchant.xpub) {
      addressIndex = db.nextAddressIndex(merchant.id);
      btcAddress   = deriveAddress(merchant.xpub, addressIndex, TESTNET).address;
    } else if (merchant.payout_address) {
      btcAddress   = merchant.payout_address;
      addressIndex = null;
    } else {
      return res.status(400).json({ error: 'Merchant has no xpub or payout_address configured' });
    }

    const session = db.createSession({
      merchantId:     merchant.id,
      amountEur:      amount_eur,
      amountBtc,
      btcAddress,
      addressIndex,
      description,
      method,
      metadata,
      expiryMinutes:  EXPIRY_MINUTES,
    });

    res.status(201).json({
      session_id:  session.id,
      btc_address: session.btc_address,
      amount_btc:  session.amount_btc,
      amount_eur:  session.amount_eur,
      method:      session.method,
      expires_at:  session.expires_at,
      qr_uri:      `bitcoin:${btcAddress}?amount=${amountBtc}&label=${encodeURIComponent(description || 'OpPay')}`,
    });
  } catch (err) {
    console.error('[sessions] create error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sessions/:id
 * PUBLIC — polled by the customer's browser to detect payment.
 */
app.get('/api/sessions/:id', (req, res) => {
  const session = db.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json({
    session_id:  session.id,
    status:      session.status,
    method:      session.method,
    amount_eur:  session.amount_eur,
    amount_btc:  session.amount_btc,
    btc_address: session.btc_address,
    tx_hash:     session.tx_hash,
    expires_at:  session.expires_at,
    confirmed_at: session.confirmed_at,
  });
});

/**
 * POST /api/sessions/:id/confirm-receipt
 * Customer confirms delivery for OpCredit — releases escrow early.
 */
app.post('/api/sessions/:id/confirm-receipt', async (req, res) => {
  try {
    const session = db.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    await confirmEscrowReceipt(session.id, session.merchant_id);
    res.json({ ok: true, message: 'Escrow released — BTC sent to merchant' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Transactions ──────────────────────────────────────────────────────────────

app.get('/api/transactions', requireAuth, (req, res) => {
  const { limit = 100, offset = 0, status } = req.query;
  const txs = db.getTransactionsByMerchant(req.merchant.id, {
    limit: parseInt(limit), offset: parseInt(offset), status
  });
  res.json(txs);
});

app.get('/api/transactions/stats', requireAuth, (req, res) => {
  const stats = db.getMerchantStats(req.merchant.id);
  res.json(stats);
});

// ── Merchant Settings ─────────────────────────────────────────────────────────

app.put('/api/settings', requireAuth, (req, res) => {
  const { name, xpub, payout_address, webhook_url } = req.body;
  db.updateMerchant(req.merchant.id, { name, xpub, payout_address, webhook_url });
  res.json(sanitize(db.getMerchantById(req.merchant.id)));
});

// ── Withdrawals ───────────────────────────────────────────────────────────────

app.post('/api/withdraw', requireAuth, (req, res) => {
  const { to_address, btc_amount } = req.body;
  if (!to_address || !isValidAddress(to_address)) return res.status(400).json({ error: 'Invalid Bitcoin address' });
  if (!btc_amount || btc_amount <= 0) return res.status(400).json({ error: 'btc_amount required' });

  const w = db.createWithdrawal({ merchantId: req.merchant.id, toAddress: to_address, btcAmount: btc_amount });
  res.status(201).json(w);
});

app.get('/api/withdrawals', requireAuth, (req, res) => {
  res.json(db.getWithdrawalsByMerchant(req.merchant.id));
});

// ── Webhooks ──────────────────────────────────────────────────────────────────

app.post('/api/webhooks/test', requireAuth, async (req, res) => {
  const { sendWebhook } = await import('./webhook.js');
  const fakeTx = {
    id: 'test', session_id: 'test', tx_hash: '0xtest',
    btc_amount: 0.0001, eur_amount: 9.99, method: 'bitcoin', description: 'Test webhook',
  };
  try {
    await sendWebhook(req.merchant.id, fakeTx, null, 'webhook.test');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── BTC Price ─────────────────────────────────────────────────────────────────

app.get('/api/price', async (_req, res) => {
  const price = await getBtcPrice();
  res.json({ eur: price, timestamp: lastPriceFetch });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitize(m) {
  if (!m) return null;
  const { password_hash, ...safe } = m;
  return safe;
}

// ─── Start ────────────────────────────────────────────────────────────────────

startMonitor();

server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║         OpPay Server v1.0.0          ║
  ╠══════════════════════════════════════╣
  ║  HTTP  → http://localhost:${PORT}       ║
  ║  WS    → ws://localhost:${PORT}         ║
  ║  DB    → ${process.env.DB_PATH || './oppay.db'}            ║
  ║  Net   → ${TESTNET ? 'OPNet Testnet' : 'Mainnet'}               ║
  ╚══════════════════════════════════════╝
  `);
});
