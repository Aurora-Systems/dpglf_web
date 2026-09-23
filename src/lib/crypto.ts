/**
 * Password hashing and token helpers built on Web Crypto only.
 *
 * Web Crypto (not node:crypto) is deliberate: it is available identically in
 * Node, in Netlify Functions and in the Cloudflare Workers runtime, so the auth
 * layer does not pin the platform the way `scryptSync` would.
 */

const PBKDF2_ITERATIONS = 210_000; // OWASP 2023 guidance for PBKDF2-HMAC-SHA256
const KEY_BYTES = 32;
const SALT_BYTES = 16;

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function fromBase64(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, 'base64'));
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    key,
    KEY_BYTES * 8,
  );
  return new Uint8Array(bits);
}

/** Encoded as `pbkdf2$<iterations>$<salt>$<hash>` so the cost can be raised later. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [scheme, iterStr, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'pbkdf2' || !iterStr || !saltB64 || !hashB64) return false;
  const iterations = Number(iterStr);
  if (!Number.isFinite(iterations) || iterations < 1000) return false;
  const expected = fromBase64(hashB64);
  const actual = await pbkdf2(password, fromBase64(saltB64), iterations);
  return timingSafeEqual(expected, actual);
}

/** True when a stored hash was made with a weaker cost than we now use. */
export function needsRehash(stored: string | null): boolean {
  if (!stored) return false;
  const iterations = Number(stored.split('$')[1]);
  return !Number.isFinite(iterations) || iterations < PBKDF2_ITERATIONS;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Compare two secrets (a shared key, a bearer token) without leaking through
 * timing how much of them matched. Both sides are hashed first, so the compare
 * always runs over equal-length input whatever was sent.
 */
export async function secretsEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  return timingSafeEqual(new Uint8Array(x), new Uint8Array(y));
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Buffer.from(digest).toString('hex');
}

/** URL-safe random token, used for refresh tokens and email links. */
export function randomToken(bytes = 32): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString('base64url');
}

/**
 * A short, human-quotable submission reference — e.g. `TFB-2026-7QK4RM`.
 * Ambiguous glyphs (0/O, 1/I) are excluded so it survives being read over the
 * phone or copied off a printed receipt.
 */
export function referenceCode(prefix: string, year: number, length = 6): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `${prefix}-${year}-${out}`;
}
