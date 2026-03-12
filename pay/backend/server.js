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
import { getAdminStats, getAdminMerchants, getAdminRecentTransactions } from './db.js';
import { requireAuth, hashPassword, verifyPassword } from './auth.js';
import { deriveAddress, isValidAddress } from './derive.js';
import { startMonitor, setPushCallback, confirmEscrowReceipt } from './monitor.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

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

// Serve the whole project as static files
// casino → http://localhost:3001/
// merchant dashboard → http://localhost:3001/pay/merchant.html
// checkout → http://localhost:3001/pay/checkout.html
app.use(express.static(join(__dirname, '../..')));

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

const SUPPORTED_CURRENCIES = ['eur', 'usd', 'gbp', 'jpy', 'chf', 'aud', 'cad'];
let cachedPrices = { eur: 60000, usd: 64800, gbp: 51600, jpy: 9720000, chf: 58800, aud: 99000, cad: 88200 };
let lastPriceFetch = 0;

async function getBtcPrice(currency = 'eur') {
  const cur = currency.toLowerCase();
  if (Date.now() - lastPriceFetch < 60_000) return cachedPrices[cur] ?? cachedPrices.eur;
  try {
    const vs = SUPPORTED_CURRENCIES.join(',');
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=${vs}`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const json = await res.json();
    const btc = json?.bitcoin || {};
    SUPPORTED_CURRENCIES.forEach(c => { if (btc[c]) cachedPrices[c] = btc[c]; });
    lastPriceFetch = Date.now();
  } catch {
    console.warn('[price] Could not fetch BTC price, using cached');
  }
  return cachedPrices[cur] ?? cachedPrices.eur;
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
    const { amount, amount_eur, currency = 'eur', description, method = 'bitcoin', metadata } = req.body;
    // Support both old `amount_eur` field and new `amount` + `currency`
    const fiatAmount = amount ?? amount_eur;
    if (!fiatAmount || fiatAmount <= 0) return res.status(400).json({ error: 'amount required' });
    const cur = currency.toLowerCase();
    if (!SUPPORTED_CURRENCIES.includes(cur)) return res.status(400).json({ error: `Unsupported currency. Supported: ${SUPPORTED_CURRENCIES.join(', ')}` });

    const merchant  = req.merchant;
    const btcPrice  = await getBtcPrice(cur);
    const amountBtc = parseFloat((fiatAmount / btcPrice).toFixed(8));
    const eurAmount = cur === 'eur' ? fiatAmount : parseFloat((fiatAmount / (await getBtcPrice('eur') / btcPrice)).toFixed(2));

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
      amountEur:      eurAmount,
      amountBtc,
      currency:       cur.toUpperCase(),
      amountLocal:    fiatAmount,
      btcAddress,
      addressIndex,
      description,
      method,
      metadata,
      expiryMinutes:  EXPIRY_MINUTES,
    });

    res.status(201).json({
      session_id:   session.id,
      btc_address:  session.btc_address,
      amount_btc:   session.amount_btc,
      amount_eur:   session.amount_eur,
      amount:       fiatAmount,
      currency:     cur.toUpperCase(),
      method:       session.method,
      expires_at:   session.expires_at,
      qr_uri:       `bitcoin:${btcAddress}?amount=${amountBtc}&label=${encodeURIComponent(description || 'OpPay')}`,
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
    session_id:           session.id,
    status:               session.status,
    method:               session.method,
    amount_eur:           session.amount_eur,
    amount_btc:           session.amount_btc,
    currency:             session.currency || 'EUR',
    amount:               session.amount_local ?? session.amount_eur,
    btc_address:          session.btc_address,
    tx_hash:              session.tx_hash,
    expires_at:           session.expires_at,
    confirmed_at:         session.confirmed_at,
    return_requested_at:  session.return_requested_at || null,
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

app.get('/api/price', async (req, res) => {
  const cur = (req.query.currency || 'eur').toLowerCase();
  await getBtcPrice(cur); // refresh if stale
  res.json({ ...cachedPrices, currency: cur, price: cachedPrices[cur] ?? cachedPrices.eur, timestamp: lastPriceFetch });
});

// ── OpCredit Return Flow ───────────────────────────────────────────────────────

/**
 * POST /api/sessions/:id/refund
 * STEP 1 — Customer requests a return.
 * Does NOT immediately refund. Sets status to 'return_requested' and notifies
 * the merchant. Merchant must physically receive the goods and then call
 * POST /api/sessions/:id/confirm-return to release BTC back to customer.
 * Safety net: if merchant ignores for RETURN_TIMEOUT_DAYS (default 7) days →
 * auto-refund via monitor.js. This prevents merchants from blocking refunds.
 */
app.post('/api/sessions/:id/refund', async (req, res) => {
  try {
    const session = db.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.method !== 'opcredit') return res.status(400).json({ error: 'Refunds only apply to OpCredit sessions' });
    if (session.status !== 'escrowed') {
      const msgs = {
        confirmed:       'Escrow already released to merchant — cannot refund',
        refunded:        'Already refunded',
        return_requested:'Return already requested — awaiting merchant confirmation',
        expired:         'Session has expired',
      };
      return res.status(400).json({ error: msgs[session.status] || `Cannot request return — status is '${session.status}'` });
    }

    const now = Date.now();
    db.updateSessionStatus(session.id, 'return_requested', { returnRequestedAt: now });

    // Notify merchant in real-time via WebSocket
    pushToMerchant(session.merchant_id, 'return.requested', {
      session_id:   session.id,
      reason:       req.body.reason || 'customer_return',
      amount_btc:   session.amount_btc,
      amount_eur:   session.amount_eur,
      requested_at: now,
    });

    // Fire webhook so merchant backend can also be notified
    const { sendWebhook } = await import('./webhook.js');
    const evtTx = { id: session.id, session_id: session.id, btc_amount: session.amount_btc, eur_amount: session.amount_eur, method: 'opcredit' };
    sendWebhook(session.merchant_id, evtTx, session, 'return.requested').catch(() => {});

    res.json({
      ok:         true,
      status:     'return_requested',
      message:    'Return requested — the merchant will be notified. Once they confirm receipt of the returned goods, your BTC will be refunded. Auto-approved after 7 days if merchant does not respond.',
      session_id: session.id,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/sessions/:id/confirm-return  ← MERCHANT AUTH REQUIRED
 * STEP 2 — Merchant confirms goods were physically received back.
 * Only after this does status become 'refunded' and BTC is returned to customer.
 * A customer cannot fake this step — it requires the merchant's API key.
 */
app.post('/api/sessions/:id/confirm-return', requireAuth, async (req, res) => {
  try {
    const session = db.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.merchant_id !== req.merchant.id) return res.status(403).json({ error: 'Not your session' });
    if (session.status !== 'return_requested') {
      return res.status(400).json({ error: `Session is not awaiting return confirmation — status: '${session.status}'` });
    }

    db.updateSessionStatus(session.id, 'refunded');

    // Push so customer browser (polling /api/sessions/:id) sees the update
    pushToMerchant(session.merchant_id, 'return.confirmed', { session_id: session.id });

    const { sendWebhook } = await import('./webhook.js');
    const evtTx = { id: session.id, session_id: session.id, btc_amount: session.amount_btc, eur_amount: session.amount_eur, method: 'opcredit' };
    sendWebhook(session.merchant_id, evtTx, session, 'return.confirmed').catch(() => {});

    console.log(`[server] Return confirmed by merchant ${req.merchant.id} — session ${session.id} refunded`);
    res.json({ ok: true, message: 'Return confirmed — BTC will be returned to customer', session_id: session.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/returns  ← MERCHANT AUTH REQUIRED
 * Lists all pending return requests so merchants can process them from their dashboard.
 */
app.get('/api/returns', requireAuth, (req, res) => {
  res.json(db.getReturnRequestsByMerchant(req.merchant.id));
});

/**
 * POST /api/sessions/demo-confirm
 * Called by checkout.html after a simulated payment.
 * Creates a session + transaction in the DB as immediately confirmed.
 * Identified by merchant pub_key (public-safe — no secret).
 */
app.post('/api/sessions/demo-confirm', async (req, res) => {
  try {
    const { pub_key, sat, description } = req.body;
    if (!pub_key || !sat) return res.status(400).json({ error: 'pub_key and sat required' });

    const merchant = db.getMerchantByApiKey(pub_key);
    if (!merchant) return res.status(404).json({ error: 'Merchant not found — check pub_key' });

    const btcPrice  = await getBtcPrice('eur');
    const btcAmount = parseFloat((parseInt(sat) / 1e8).toFixed(8));
    const eurAmount = parseFloat((btcAmount * btcPrice).toFixed(2));
    const txHash    = '0x' + Array.from({length: 32}, () => Math.floor(Math.random() * 16).toString(16)).join('');

    const session = db.createSession({
      merchantId:    merchant.id,
      amountEur:     eurAmount,
      amountBtc:     btcAmount,
      btcAddress:    merchant.payout_address || 'bc1q_demo_address',
      description:   description || 'Casino Deposit',
      method:        'bitcoin',
      expiryMinutes: 5,
    });

    db.updateSessionStatus(session.id, 'confirmed', { txHash, confirmedAt: Date.now() });

    const tx = db.createTransaction({
      sessionId:      session.id,
      merchantId:     merchant.id,
      txHash,
      btcAmount,
      eurAmount,
      confirmations:  1,
      method:         'bitcoin',
      isEscrow:       false,
      platformFeeBtc: parseFloat((btcAmount * 0.001).toFixed(8)),
    });

    pushToMerchant(merchant.id, 'payment', {
      session_id:  session.id,
      tx_id:       tx.id,
      tx_hash:     txHash,
      amount_eur:  eurAmount,
      amount_btc:  btcAmount,
      method:      'bitcoin',
      status:      'confirmed',
      timestamp:   Date.now(),
    });

    res.json({ ok: true, tx_id: tx.id, session_id: session.id, btc: btcAmount, eur: eurAmount });
  } catch (err) {
    console.error('[demo-confirm]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin API ────────────────────────────────────────────────────────────────

const ADMIN_KEY = process.env.ADMIN_KEY || '123456';

function requireAdmin(req, res, next) {
  if (!ADMIN_KEY) return res.status(503).json({ error: 'Admin not configured — set ADMIN_KEY in .env' });
  const auth = req.headers['authorization'] || '';
  const key  = auth.startsWith('Bearer ') ? auth.slice(7) : req.headers['x-admin-key'];
  if (key !== ADMIN_KEY) return res.status(401).json({ error: 'Invalid admin key' });
  next();
}

/** POST /api/admin/auth — validate admin key, return ok */
app.post('/api/admin/auth', (req, res) => {
  if (!ADMIN_KEY) return res.status(503).json({ error: 'Admin not configured' });
  const { key } = req.body;
  if (key !== ADMIN_KEY) return res.status(401).json({ error: 'Invalid admin key' });
  res.json({ ok: true });
});

/** GET /api/admin/stats — platform-wide stats */
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  res.json(getAdminStats());
});

/** GET /api/admin/merchants — all merchants with volume */
app.get('/api/admin/merchants', requireAdmin, (req, res) => {
  const { limit = 50, offset = 0 } = req.query;
  res.json(getAdminMerchants({ limit: parseInt(limit), offset: parseInt(offset) }));
});

/** GET /api/admin/transactions — recent transactions across all merchants */
app.get('/api/admin/transactions', requireAdmin, (req, res) => {
  const { limit = 100 } = req.query;
  res.json(getAdminRecentTransactions({ limit: parseInt(limit) }));
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitize(m) {
  if (!m) return null;
  const { password_hash, ...safe } = m;
  return safe;
}

// ─── SofaScore Sports Proxy ───────────────────────────────────────────────────

const SOFA_LEAGUE_IDS = { 'eng.1': 17, 'esp.1': 8, 'ger.1': 35, 'ita.1': 23, 'fra.1': 34 };
const _ssCache = new Map();

async function _sofaGet(path) {
  const hit = _ssCache.get(path);
  if (hit && Date.now() - hit.ts < 90_000) return hit.data;
  const r = await fetch('https://api.sofascore.com/api/v1' + path, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Referer': 'https://www.sofascore.com/',
      'Accept': 'application/json',
      'Accept-Language': 'nl,en;q=0.9',
    },
    signal: AbortSignal.timeout(9000),
  });
  if (!r.ok) throw new Error(`SS-${r.status}`);
  const data = await r.json();
  _ssCache.set(path, { data, ts: Date.now() });
  return data;
}

function _ssState(ev) {
  const t = ev?.status?.type;
  if (t === 'inprogress') return 'in';
  if (t === 'finished' || t === 'canceled' || t === 'postponed') return 'post';
  return 'pre';
}

function _ssMinute(ev) {
  const m = ev?.time?.played ?? ev?.time?.minutes ?? 0;
  return m > 0 ? m + "'" : 'Live';
}

app.get('/api/sports/soccer/:leagueId/events', async (req, res) => {
  const tid = SOFA_LEAGUE_IDS[req.params.leagueId];
  if (!tid) return res.status(400).json({ error: 'unknown league' });

  const rawEvs = [];
  const today = new Date();

  // Collect live events first
  try {
    const lj = await _sofaGet('/sport/football/events/live');
    for (const e of (lj.events || [])) {
      if (e?.tournament?.uniqueTournament?.id === tid) rawEvs.push(e);
    }
  } catch {}

  // Then scheduled events today + next 3 days
  for (let d = 0; d <= 3 && rawEvs.length < 25; d++) {
    const dt = new Date(today);
    dt.setDate(dt.getDate() + d);
    const ds = dt.toISOString().slice(0, 10);
    try {
      const json = await _sofaGet(`/sport/football/scheduled-events/${ds}`);
      for (const e of (json.events || [])) {
        if (e?.tournament?.uniqueTournament?.id === tid
          && _ssState(e) !== 'post'
          && !rawEvs.find(x => x.id === e.id)) {
          rawEvs.push(e);
        }
      }
    } catch (err) { console.warn('[sofa]', ds, err.message); }
  }

  // Fetch ESPN odds for this league to enrich the SofaScore data
  // Store by both shortDisplayName and displayName (full name) to handle abbreviations
  function _normName(s) {
    return (s || '').toLowerCase()
      .split(/[\s\-\.]+/)
      .filter(w => !['fc','cf','sc','afc','ac','as','bv','vfb','rb','de','le','la','los','les','du','1','de'].includes(w))
      .join('')
      .replace(/[^a-z]/g, '');
  }
  function _amDec(ml) {
    if (!ml) return null;
    const n = parseFloat(String(ml).replace(/[^0-9.\-]/g, ''));
    if (!n || isNaN(n)) return null;
    return n > 0 ? +(n / 100 + 1).toFixed(2) : +(100 / (-n) + 1).toFixed(2);
  }
  const espnOddsMap = {}; // normName → {o1,od,o2,ou,uu}
  const today2 = new Date();
  for (let d2 = 0; d2 <= 3; d2++) {
    const dt2 = new Date(today2);
    dt2.setDate(dt2.getDate() + d2);
    const ds2 = dt2.toISOString().slice(0, 10).replace(/-/g, '');
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${req.params.leagueId}/scoreboard?dates=${ds2}`;
      const er = await fetch(url, { signal: AbortSignal.timeout(7000) });
      const ej = await er.json();
      for (const ev of (ej.events || [])) {
        const c = ev.competitions?.[0];
        if (!c) continue;
        const eo = c.odds?.[0];
        if (!eo) continue;
        const homeTeam = c.competitors?.[0]?.team || {};
        // Store under both short display name AND full display name
        const homeKeys = [
          homeTeam.shortDisplayName,
          homeTeam.displayName,
          homeTeam.name,
        ].filter(Boolean).map(_normName);
        const ml = eo.moneyline || {};
        const o1 = _amDec(ml.home?.close?.odds || ml.home?.open?.odds);
        const o2 = _amDec(ml.away?.close?.odds || ml.away?.open?.odds);
        const od = _amDec(ml.draw?.close?.odds || eo.drawOdds?.moneyLine);
        const ou = _amDec(eo.total?.over?.close?.odds || eo.total?.over?.open?.odds);
        const uu = _amDec(eo.total?.under?.close?.odds || eo.total?.under?.open?.odds);
        if (o1 || o2) homeKeys.forEach(k => { espnOddsMap[k] = { o1, od, o2, ou, uu }; });
      }
    } catch {}
  }

  const events = rawEvs.slice(0, 20).map(ev => {
    const homeName = ev.homeTeam?.name || 'Home';
    const espnOdds = espnOddsMap[_normName(homeName)] || null;
    return {
      id: ev.id,
      homeTeam: homeName,
      homeShort: ev.homeTeam?.shortName || ev.homeTeam?.nameCode || homeName.slice(0, 3).toUpperCase(),
      homeId: ev.homeTeam?.id,
      awayTeam: ev.awayTeam?.name || 'Away',
      awayShort: ev.awayTeam?.shortName || ev.awayTeam?.nameCode || (ev.awayTeam?.name || 'AWY').slice(0, 3).toUpperCase(),
      awayId: ev.awayTeam?.id,
      homeScore: ev.homeScore?.current ?? 0,
      awayScore: ev.awayScore?.current ?? 0,
      status: _ssState(ev),
      minute: _ssState(ev) === 'in' ? _ssMinute(ev) : '',
      startTs: ev.startTimestamp || 0,
      odds: espnOdds,
    };
  });

  res.json({ events });
});

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
