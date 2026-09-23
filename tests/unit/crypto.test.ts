import { describe, expect, it } from 'vitest';
import {
  hashPassword,
  needsRehash,
  randomToken,
  referenceCode,
  secretsEqual,
  sha256Hex,
  verifyPassword,
} from '@/lib/crypto';

describe('password hashing', () => {
  it('round-trips and rejects a wrong password', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
    expect(await verifyPassword('correct horse batterX', hash)).toBe(false);
  });

  it('salts every hash', async () => {
    const [a, b] = await Promise.all([hashPassword('same input'), hashPassword('same input')]);
    expect(a).not.toEqual(b);
  });

  it('rejects malformed or absent stored hashes without throwing', async () => {
    expect(await verifyPassword('x', null)).toBe(false);
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('x', 'pbkdf2$abc$$')).toBe(false);
  });

  it('flags hashes made with a weaker cost for transparent upgrade', async () => {
    expect(needsRehash(await hashPassword('x'))).toBe(false);
    expect(needsRehash('pbkdf2$100000$c2FsdA==$aGFzaA==')).toBe(true);
    expect(needsRehash(null)).toBe(false);
  });
});

describe('tokens and references', () => {
  it('produces URL-safe random tokens of the expected entropy', () => {
    const token = randomToken(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(42); // 32 bytes base64url
    expect(randomToken(32)).not.toEqual(token);
  });

  it('submission references avoid glyphs that fail over the phone', () => {
    for (let i = 0; i < 50; i++) {
      // No 0/O and no 1/I anywhere in the random segment.
      expect(referenceCode('TFB', 2026)).toMatch(/^TFB-2026-[A-HJ-NP-Z2-9]{6}$/);
    }
  });

  it('computes a correct SHA-256', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('secretsEqual', () => {
  it('matches only identical secrets, whatever their lengths', async () => {
    expect(await secretsEqual('Bearer abc', 'Bearer abc')).toBe(true);
    expect(await secretsEqual('Bearer abc', 'Bearer abd')).toBe(false);
    expect(await secretsEqual('Bearer abc', 'Bearer abcd')).toBe(false);
    expect(await secretsEqual('', 'Bearer abc')).toBe(false);
  });
});
