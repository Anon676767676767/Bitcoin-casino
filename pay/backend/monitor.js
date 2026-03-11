/**
 * monitor.js — Transaction monitoring via OPNet RPC
 *
 * Polls pending sessions every MONITOR_INTERVAL_MS.
 * When BTC is detected at the session's address → confirms payment.
 * Also processes OpCredit escrow auto-releases.
 */
import {
  getPendingSessions, updateSessionStatus, createTransaction,
  getEscrowsDueForRelease, releaseEscrow, expireOldSessions, getSession,
  getReturnRequestsPastTimeout,
} from './db.js';
import { sendWebhook } from './webhook.js';

const RPC_URL            = process.env.OPNET_RPC_URL || 'https://testnet.opnet.org';
const INTERVAL_MS        = parseInt(process.env.MONITOR_INTERVAL_MS || '15000');
const ESCROW_DAYS        = parseInt(process.env.ESCROW_DAYS || '14');
const RETURN_TIMEOUT_DAYS = parseInt(process.env.RETURN_TIMEOUT_DAYS || '7');
const TOLERANCE          = 0.005; // 0.5% underpayment tolerance

// WebSocket push callback — set by server.js
let pushCallback = null;
export function setPushCallback(fn) { pushCallback = fn; }
function push(merchantId, type, data) {
  if (pushCallback) pushCallback(merchantId, type, data);
}

// ─── OPNet RPC ────────────────────────────────────────────────────────────────

async function rpc(method, params = []) {
  try {
    const res = await fetch(RPC_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal:  AbortSignal.timeout(10_000),
    });
    const json = await res.json();
    return json.result ?? null;
  } catch (err) {
    console.error(`[monitor] RPC ${method} failed:`, err.message);
    return null;
  }
}

async function getBalance(address) {
  const result = await rpc('getBalance', [address]);
  // OPNet returns { balance: satoshis } or similar — adapt as needed
  if (!result) return 0;
  return typeof result.balance === 'number' ? result.balance : 0;
}

async function getUTXOs(address) {
  const result = await rpc('getUTXOs', [{ address, filterSpentUTXOs: true }]);
  if (!Array.isArray(result)) return [];
  return result;
}

// ─── Main scan loop ───────────────────────────────────────────────────────────

export function startMonitor() {
  console.log(`[monitor] Starting — polling every ${INTERVAL_MS / 1000}s`);
  expireOldSessions();
  setInterval(scanPending,            INTERVAL_MS);
  setInterval(processEscrowReleases,  60 * 60 * 1000); // hourly
  setInterval(processReturnTimeouts,  60 * 60 * 1000); // hourly
  processEscrowReleases();  // run once on start
  processReturnTimeouts();  // run once on start
}

async function scanPending() {
  expireOldSessions();
  const sessions = getPendingSessions();
  if (!sessions.length) return;

  await Promise.allSettled(sessions.map(checkSession));
}

async function checkSession(session) {
  try {
    // Quick balance check first
    const balanceSat = await getBalance(session.btc_address);
    if (balanceSat === 0) return;

    const expectedSat = Math.floor(session.amount_btc * 1e8);
    if (balanceSat < expectedSat * (1 - TOLERANCE)) return;

    // Get UTXOs for tx hash
    const utxos = await getUTXOs(session.btc_address);
    const matching = utxos.find(u => (u.value ?? u.satoshis ?? 0) >= expectedSat * (1 - TOLERANCE));
    const txHash  = matching?.txid ?? matching?.tx_hash ?? `sim_${Date.now()}`;
    const confs   = matching?.confirmations ?? matching?.blockHeight ? 1 : 0;

    if (session.status === 'pending') {
      updateSessionStatus(session.id, 'detected', { txHash });
    }

    if (confs >= 1 && session.status !== 'confirmed' && session.status !== 'escrowed') {
      const isEscrow = session.method === 'opcredit';
      const newStatus = isEscrow ? 'escrowed' : 'confirmed';

      updateSessionStatus(session.id, newStatus, { txHash, confirmedAt: Date.now() });

      const btcAmt = balanceSat / 1e8;
      const tx = createTransaction({
        sessionId:      session.id,
        merchantId:     session.merchant_id,
        txHash,
        btcAmount:      btcAmt,
        eurAmount:      session.amount_eur,
        confirmations:  confs,
        method:         session.method,
        isEscrow,
        escrowDays:     ESCROW_DAYS,
        platformFeeBtc: parseFloat((btcAmt * 0.001).toFixed(8)), // 0.1% platform fee
      });

      console.log(`[monitor] ${newStatus.toUpperCase()} — session ${session.id} | ${tx.btc_amount} BTC | ${txHash}`);

      // Webhook + WS push
      await sendWebhook(session.merchant_id, tx, session, isEscrow ? 'escrow.locked' : 'payment.confirmed');
      push(session.merchant_id, 'payment', {
        session_id:  session.id,
        tx_id:       tx.id,
        tx_hash:     txHash,
        amount_eur:  session.amount_eur,
        amount_btc:  tx.btc_amount,
        method:      session.method,
        status:      newStatus,
        timestamp:   Date.now(),
      });
    }
  } catch (err) {
    console.error(`[monitor] Error checking session ${session.id}:`, err.message);
  }
}

// ─── Escrow release ───────────────────────────────────────────────────────────

async function processEscrowReleases() {
  const due = getEscrowsDueForRelease();
  if (!due.length) return;
  console.log(`[monitor] Processing ${due.length} escrow release(s)`);

  for (const tx of due) {
    try {
      // In production: construct + broadcast a Bitcoin tx sending tx.btc_amount to tx.payout_address
      // For now: mark as released and fire webhook
      releaseEscrow(tx.id);
      await sendWebhook(tx.merchant_id, tx, null, 'escrow.released');
      push(tx.merchant_id, 'escrow_released', {
        tx_id:      tx.id,
        amount_btc: tx.btc_amount,
        to_address: tx.payout_address,
        timestamp:  Date.now(),
      });
      console.log(`[monitor] Escrow released — tx ${tx.id} → ${tx.payout_address}`);
    } catch (err) {
      console.error(`[monitor] Escrow release error for tx ${tx.id}:`, err.message);
    }
  }
}

// ─── Return request timeout (auto-approve if merchant ignores for N days) ─────

/**
 * If a merchant hasn't confirmed a return within RETURN_TIMEOUT_DAYS days,
 * we automatically approve it. This protects customers from bad merchants who
 * try to pocket both the goods AND the BTC by ignoring the return request.
 */
async function processReturnTimeouts() {
  const cutoff  = Date.now() - RETURN_TIMEOUT_DAYS * 86_400_000;
  const timedOut = getReturnRequestsPastTimeout(cutoff);
  if (!timedOut.length) return;
  console.log(`[monitor] Auto-approving ${timedOut.length} timed-out return request(s) (merchant did not respond within ${RETURN_TIMEOUT_DAYS} days)`);

  for (const session of timedOut) {
    try {
      updateSessionStatus(session.id, 'refunded');
      await sendWebhook(session.mid, {
        id: session.id, session_id: session.id,
        btc_amount: session.amount_btc, eur_amount: session.amount_eur, method: 'opcredit',
      }, session, 'return.auto_approved');
      push(session.mid, 'return.auto_approved', {
        session_id: session.id,
        reason:     'merchant_did_not_respond',
        message:    `Return auto-approved after ${RETURN_TIMEOUT_DAYS} days — BTC will be returned to customer`,
      });
      console.log(`[monitor] Return auto-approved — session ${session.id} (merchant ${session.mid} timed out)`);
    } catch (err) {
      console.error(`[monitor] Return timeout error for session ${session.id}:`, err.message);
    }
  }
}

// ─── Manual confirm (customer confirms receipt for OpCredit) ──────────────────

export async function confirmEscrowReceipt(sessionId, merchantId) {
  const session = getSession(sessionId);
  if (!session || session.status !== 'escrowed') {
    throw new Error('Session not found or not in escrowed state');
  }

  updateSessionStatus(sessionId, 'confirmed', { confirmedAt: Date.now() });

  const { getTransactionsByMerchant } = await import('./db.js');
  const txs = getTransactionsByMerchant(merchantId, { limit: 1 });
  const tx  = txs.find(t => t.session_id === sessionId);

  if (tx) {
    const { getDb } = await import('./db.js');
    getDb().prepare(`UPDATE transactions SET escrow_status = 'released' WHERE id = ?`).run(tx.id);
    await sendWebhook(merchantId, tx, session, 'escrow.released_early');
    push(merchantId, 'escrow_released', { tx_id: tx.id, timestamp: Date.now() });
  }
}
