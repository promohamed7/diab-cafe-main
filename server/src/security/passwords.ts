// Password hashing with scrypt (Node built-in, memory-hard). Format:
//   scrypt$<N>$<r>$<p>$<salt b64url>$<hash b64url>

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';

const N = 32768;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const MAX_MEM = 128 * N * R * 2;

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 200;

function derive(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password.normalize('NFKC'), salt, KEY_LENGTH, { N: n, r, p, maxmem: Math.max(MAX_MEM, 128 * n * r * 2) }, (err, key) =>
      err ? reject(err) : resolve(key)
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [n, r, p] = parts.slice(1, 4).map(Number);
  if (![n, r, p].every((x) => Number.isInteger(x) && x > 0)) return false;
  const expected = Buffer.from(parts[5], 'base64url');
  const actual = await derive(password, Buffer.from(parts[4], 'base64url'), n, r, p);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** A precomputed hash so unknown e-mails cost the same time as wrong passwords. */
let dummyHash: Promise<string> | null = null;
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(16).toString('hex'));
  return dummyHash;
}

export function passwordPolicyIssue(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `at least ${PASSWORD_MIN_LENGTH} characters`;
  if (password.length > PASSWORD_MAX_LENGTH) return `at most ${PASSWORD_MAX_LENGTH} characters`;
  return null;
}
