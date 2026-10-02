// Random identifiers and secrets. Everything comes from the CSPRNG; anything a
// client presents as a credential is stored only as a SHA-256 hash.

import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

// Crockford base32 without I, L, O, U: readable on receipts and over the phone.
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function crockford(length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) out += CROCKFORD[randomInt(32)];
  return out;
}

/** Customer tracking reference: INB-XXXX-XXXX-XXXX-XXXX (80 random bits). */
export function newPublicReference(): string {
  const raw = crockford(16);
  return `INB-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12)}`;
}

export const PUBLIC_REFERENCE_PATTERN = /^INB-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

/** One-time connector pairing code: XXXX-XXXX (40 bits, short-lived, single use, rate limited). */
export function newPairingCode(): string {
  const raw = crockford(8);
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export function normalizePairingCode(code: string): string {
  return code.toUpperCase().replace(/[^0-9A-Z]/g, '');
}

/** Long-lived connector credential: inbc_<256 random bits>. Shown once, stored hashed. */
export function newConnectorCredential(): { credential: string; prefix: string } {
  const secret = randomBytes(32).toString('base64url');
  const credential = `inbc_${secret}`;
  return { credential, prefix: credential.slice(0, 12) };
}

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function newCsrfToken(): string {
  return randomBytes(24).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
