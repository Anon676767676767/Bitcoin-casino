/**
 * db.js — SQLite database layer using Node.js built-in node:sqlite
 * All schema creation + query helpers live here.
 */
import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'crypto';
import { v4 as uuid } from 'uuid';

let db;

export function openDb(path = './oppay.db') {
  db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  createSchema();
  return db;
}

export function getDb() { return db; }

// ─── Schema ──────────────────────────────────────────────────────────────────

function createSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS merchants (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      email           TEXT NOT NULL UNIQUE,
      password_hash   TEXT NOT NULL,
      api_key         TEXT NOT NULL UNIQUE,
      pub_key         TEXT NOT NULL UNIQUE,
      xpub            TEXT,
      payout_address  TEXT,
      address_index   INTEGER NOT NULL DEFAULT 0,
      webhook_url     TEXT,
      created_at      INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id              TEXT PRIMARY KEY,
      merchant_id     TEXT NOT NULL REFERENCES merchants(id),
      amount_eur      REAL NOT NULL,
      amount_btc      REAL NOT NULL,
      btc_address     TEXT NOT NULL,
      address_index   INTEGER,
      description     TEXT,
      method          TEXT NOT NULL DEFAULT 'bitcoin',
      status          TEXT NOT NULL DEFAULT 'pending',
      expires_at      INTEGER NOT NULL,
      created_at      INTEGER NOT NULL,
      confirmed_at    INTEGER,
      tx_hash         TEXT,
      metadata        TEXT
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id                  TEXT PRIMARY KEY,
      session_id          TEXT NOT NULL REFERENCES sessions(id),
      merchant_id         TEXT NOT NULL REFERENCES merchants(id),
      tx_hash             TEXT,
      btc_amount          REAL NOT NULL,
      eur_amount          REAL NOT NULL,
      confirmations       INTEGER NOT NULL DEFAULT 0,
      method              TEXT NOT NULL,
      escrow_release_at   INTEGER,
      escrow_status       TEXT,
      webhook_sent        INTEGER NOT NULL DEFAULT 0,
      webhook_retries     INTEGER NOT NULL DEFAULT 0,
      created_at          INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS withdrawals (
      id            TEXT PRIMARY KEY,
      merchant_id   TEXT NOT NULL REFERENCES merchants(id),
      to_address    TEXT NOT NULL,
      btc_amount    REAL NOT NULL,
      tx_hash       TEXT,
      status        TEXT NOT NULL DEFAULT 'queued',
      created_at    INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_merchant   ON sessions(merchant_id, status);
    CREATE INDEX IF NOT EXISTS idx_sessions_address    ON sessions(btc_address);
    CREATE INDEX IF NOT EXISTS idx_tx_session          ON transactions(session_id);
    CREATE INDEX IF NOT EXISTS idx_tx_merchant         ON transactions(merchant_id);
    CREATE INDEX IF NOT EXISTS idx_tx_escrow           ON transactions(escrow_status, escrow_release_at);
  `);
}

// ─── Merchants ────────────────────────────────────────────────────────────────

export function createMerchant({ name, email, passwordHash, xpub, payoutAddress }) {
  const id      = uuid();
  const apiKey  = 'op_live_' + randomBytes(20).toString('hex');
  const pubKey  = 'op_pub_'  + randomBytes(16).toString('hex');
  const now     = Date.now();

  db.prepare(`
    INSERT INTO merchants (id, name, email, password_hash, api_key, pub_key, xpub, payout_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, email, passwordHash, apiKey, pubKey, xpub || null, payoutAddress || null, now);

  return getMerchantById(id);
}

export function getMerchantById(id) {
  return db.prepare('SELECT * FROM merchants WHERE id = ?').get(id);
}

export function getMerchantByEmail(email) {
  return db.prepare('SELECT * FROM merchants WHERE email = ?').get(email);
}

export function getMerchantByApiKey(key) {
  return db.prepare('SELECT * FROM merchants WHERE api_key = ? OR pub_key = ?').get(key, key);
}

export function updateMerchant(id, fields) {
  const allowed = ['name', 'xpub', 'payout_address', 'webhook_url'];
  const sets    = Object.keys(fields).filter(k => allowed.includes(k)).map(k => `${k} = ?`);
  if (!sets.length) return;
  const vals = sets.map(s => fields[s.split(' ')[0]]);
  db.prepare(`UPDATE merchants SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
}

export function nextAddressIndex(merchantId) {
  // Atomic increment — returns the index BEFORE increment
  const select = db.prepare('SELECT address_index FROM merchants WHERE id = ?');
  const update = db.prepare('UPDATE merchants SET address_index = address_index + 1 WHERE id = ?');
  const run = db.transaction(() => {
    const before = select.get(merchantId).address_index;
    update.run(merchantId);
    return before;
  });
  return run();
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export function createSession({ merchantId, amountEur, amountBtc, btcAddress, addressIndex, description, method, metadata, expiryMinutes = 30 }) {
  const id  = uuid();
  const now = Date.now();
  db.prepare(`
    INSERT INTO sessions (id, merchant_id, amount_eur, amount_btc, btc_address, address_index, description, method, status, expires_at, created_at, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
  `).run(id, merchantId, amountEur, amountBtc, btcAddress, addressIndex ?? null, description ?? null, method ?? 'bitcoin', now + expiryMinutes * 60_000, now, metadata ? JSON.stringify(metadata) : null);
  return getSession(id);
}

export function getSession(id) {
  return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
}

export function getPendingSessions() {
  return db.prepare(`SELECT * FROM sessions WHERE status IN ('pending','detected') AND expires_at > ?`).all(Date.now());
}

export function updateSessionStatus(id, status, extra = {}) {
  const fields = ['status = ?'];
  const vals   = [status];
  if (extra.txHash)      { fields.push('tx_hash = ?');       vals.push(extra.txHash); }
  if (extra.confirmedAt) { fields.push('confirmed_at = ?');  vals.push(extra.confirmedAt); }
  vals.push(id);
  db.prepare(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
}

export function expireOldSessions() {
  db.prepare(`UPDATE sessions SET status = 'expired' WHERE status = 'pending' AND expires_at <= ?`).run(Date.now());
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export function createTransaction({ sessionId, merchantId, txHash, btcAmount, eurAmount, confirmations, method, isEscrow, escrowDays = 14 }) {
  const id  = uuid();
  const now = Date.now();
  const escrowRelease = isEscrow ? now + escrowDays * 86_400_000 : null;
  const escrowStatus  = isEscrow ? 'locked' : null;
  db.prepare(`
    INSERT INTO transactions (id, session_id, merchant_id, tx_hash, btc_amount, eur_amount, confirmations, method, escrow_release_at, escrow_status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, sessionId, merchantId, txHash ?? null, btcAmount, eurAmount, confirmations ?? 0, method, escrowRelease, escrowStatus, now);
  return getTransaction(id);
}

export function getTransaction(id) {
  return db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
}

export function getTransactionsByMerchant(merchantId, { limit = 100, offset = 0, status } = {}) {
  if (status) {
    return db.prepare(`
      SELECT t.*, s.description, s.metadata FROM transactions t
      JOIN sessions s ON s.id = t.session_id
      WHERE t.merchant_id = ? AND s.status = ?
      ORDER BY t.created_at DESC LIMIT ? OFFSET ?
    `).all(merchantId, status, limit, offset);
  }
  return db.prepare(`
    SELECT t.*, s.description, s.metadata FROM transactions t
    JOIN sessions s ON s.id = t.session_id
    WHERE t.merchant_id = ?
    ORDER BY t.created_at DESC LIMIT ? OFFSET ?
  `).all(merchantId, limit, offset);
}

export function getMerchantStats(merchantId) {
  return db.prepare(`
    SELECT
      COUNT(*)                                              AS total_count,
      SUM(CASE WHEN s.status='confirmed' THEN 1 ELSE 0 END) AS confirmed_count,
      SUM(CASE WHEN s.status='escrowed'  THEN 1 ELSE 0 END) AS escrowed_count,
      SUM(CASE WHEN s.status='failed'    THEN 1 ELSE 0 END) AS failed_count,
      SUM(CASE WHEN s.status='confirmed' THEN t.eur_amount ELSE 0 END) AS total_eur,
      SUM(CASE WHEN s.status='confirmed' THEN t.btc_amount ELSE 0 END) AS total_btc,
      SUM(CASE WHEN s.status='escrowed'  THEN t.eur_amount ELSE 0 END) AS escrow_eur
    FROM transactions t
    JOIN sessions s ON s.id = t.session_id
    WHERE t.merchant_id = ?
  `).get(merchantId);
}

export function getEscrowsDueForRelease() {
  return db.prepare(`
    SELECT t.*, m.payout_address, m.webhook_url, m.id as mid
    FROM transactions t
    JOIN merchants m ON m.id = t.merchant_id
    WHERE t.escrow_status = 'locked' AND t.escrow_release_at <= ?
  `).all(Date.now());
}

export function releaseEscrow(txId) {
  db.prepare(`UPDATE transactions SET escrow_status = 'released' WHERE id = ?`).run(txId);
  const tx = getTransaction(txId);
  db.prepare(`UPDATE sessions SET status = 'confirmed', confirmed_at = ? WHERE id = ?`).run(Date.now(), tx.session_id);
}

export function markWebhookSent(txId) {
  db.prepare('UPDATE transactions SET webhook_sent = 1 WHERE id = ?').run(txId);
}

export function incrementWebhookRetry(txId) {
  db.prepare('UPDATE transactions SET webhook_retries = webhook_retries + 1 WHERE id = ?').run(txId);
}

// ─── Withdrawals ──────────────────────────────────────────────────────────────

export function createWithdrawal({ merchantId, toAddress, btcAmount }) {
  const id  = uuid();
  db.prepare('INSERT INTO withdrawals (id, merchant_id, to_address, btc_amount, created_at) VALUES (?,?,?,?,?)')
    .run(id, merchantId, toAddress, btcAmount, Date.now());
  return db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(id);
}

export function getWithdrawalsByMerchant(merchantId) {
  return db.prepare('SELECT * FROM withdrawals WHERE merchant_id = ? ORDER BY created_at DESC').all(merchantId);
}
