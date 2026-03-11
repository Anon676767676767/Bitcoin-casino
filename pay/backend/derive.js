/**
 * derive.js — xpub → child Bitcoin address derivation
 * Uses bip32 + tiny-secp256k1 + bitcoinjs-lib.
 * Each payment gets a unique address: m/.../0/{index}
 */
import * as ecc from 'tiny-secp256k1';
import { BIP32Factory } from 'bip32';
import * as bitcoin from 'bitcoinjs-lib';

const bip32 = BIP32Factory(ecc);

/**
 * Derive a native SegWit (P2WPKH, bc1q...) address from an xpub.
 * @param {string} xpub - extended public key (xpub / tpub / zpub)
 * @param {number} index - child index (increments per payment)
 * @param {boolean} testnet - use testnet network
 * @returns {{ address: string, index: number }}
 */
export function deriveAddress(xpub, index, testnet = false) {
  const network = testnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
  const node    = bip32.fromBase58(xpub, network);
  const child   = node.derive(0).derive(index);

  const { address } = bitcoin.payments.p2wpkh({
    pubkey:  Buffer.from(child.publicKey),
    network,
  });

  return { address, index };
}

/**
 * Generate a fresh throwaway address (no xpub — single-use from random key).
 * Used when merchant hasn't configured an xpub yet.
 * NOT recommended for production; use xpub derivation instead.
 */
export function generateFallbackAddress(testnet = false) {
  const network  = testnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
  const keyPair  = ecc.pointFromScalar(ecc.utils?.randomBytes(32) ?? crypto.getRandomValues(new Uint8Array(32)));
  const { address } = bitcoin.payments.p2wpkh({
    pubkey:  Buffer.from(keyPair),
    network,
  });
  return address;
}

/**
 * Validate a Bitcoin address (basic format check).
 */
export function isValidAddress(addr) {
  try {
    bitcoin.address.toOutputScript(addr);
    return true;
  } catch {
    return false;
  }
}
