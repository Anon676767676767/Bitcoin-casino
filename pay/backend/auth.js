/**
 * auth.js — API key middleware + password utilities
 */
import { createHash } from 'crypto';
import { getMerchantByApiKey } from './db.js';

/** Middleware: require valid API key in Authorization header */
export function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const key    = header.startsWith('Bearer ') ? header.slice(7).trim() : header.trim();
  if (!key) return res.status(401).json({ error: 'Missing Authorization header' });

  const merchant = getMerchantByApiKey(key);
  if (!merchant) return res.status(401).json({ error: 'Invalid API key' });

  req.merchant = merchant;
  next();
}

/** Simple SHA-256 password hash (use bcrypt in production for real users) */
export function hashPassword(plain) {
  return createHash('sha256').update(plain + 'oppay_salt_2026').digest('hex');
}

export function verifyPassword(plain, hash) {
  return hashPassword(plain) === hash;
}
