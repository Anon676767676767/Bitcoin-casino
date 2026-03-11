/**
 * webhook.js — Fire HMAC-signed HTTP POST to merchant webhook URL.
 * Retries up to 3 times with exponential backoff.
 */
import { createHmac } from 'crypto';
import { getMerchantById, markWebhookSent, incrementWebhookRetry } from './db.js';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'changeme';
const MAX_RETRIES    = 3;

export async function sendWebhook(merchantId, transaction, session, event = 'payment.confirmed') {
  const merchant = getMerchantById(merchantId);
  if (!merchant?.webhook_url) return;

  const payload = {
    event,
    session_id:   transaction.session_id,
    tx_id:        transaction.id,
    tx_hash:      transaction.tx_hash,
    amount_eur:   transaction.eur_amount,
    amount_btc:   transaction.btc_amount,
    method:       transaction.method,
    description:  session?.description ?? transaction.description ?? null,
    metadata:     session?.metadata ? JSON.parse(session.metadata) : null,
    timestamp:    Date.now(),
  };

  const body = JSON.stringify(payload);
  const sig  = createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(merchant.webhook_url, {
        method:  'POST',
        headers: {
          'Content-Type':       'application/json',
          'X-OpPay-Signature':  `sha256=${sig}`,
          'X-OpPay-Event':      event,
          'X-OpPay-Delivery':   transaction.id,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) {
        markWebhookSent(transaction.id);
        console.log(`[webhook] ${event} → ${merchant.webhook_url} (${res.status})`);
        return;
      }

      console.warn(`[webhook] Attempt ${attempt}/${MAX_RETRIES} failed — HTTP ${res.status}`);
    } catch (err) {
      console.warn(`[webhook] Attempt ${attempt}/${MAX_RETRIES} error:`, err.message);
    }

    incrementWebhookRetry(transaction.id);
    if (attempt < MAX_RETRIES) await sleep(attempt * 30_000); // 30s, 60s backoff
  }

  console.error(`[webhook] All retries exhausted for tx ${transaction.id}`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
