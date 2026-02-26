import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encrypt, decrypt } from '../lib/crypto.js';

describe('encrypt / decrypt', () => {
  it('round-trips a simple string', () => {
    const plaintext = 'hello@example.com';
    const ciphertext = encrypt(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it('round-trips an empty string', () => {
    expect(decrypt(encrypt(''))).toBe('');
  });

  it('round-trips a long message body', () => {
    const long = 'x'.repeat(4999);
    expect(decrypt(encrypt(long))).toBe(long);
  });

  it('round-trips unicode content', () => {
    const text = '日本語テスト 🔐 émojis & spëcial chârs';
    expect(decrypt(encrypt(text))).toBe(text);
  });

  it('produces different ciphertext for the same plaintext each call (random IV)', () => {
    const plaintext = 'same input';
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a.equals(b)).toBe(false);
  });

  it('returns a Buffer', () => {
    expect(encrypt('test')).toBeInstanceOf(Buffer);
  });

  it('output is at least IV(12) + authTag(16) + 1 byte = 29 bytes', () => {
    const result = encrypt('x');
    expect(result.length).toBeGreaterThanOrEqual(29);
  });

  it('output length grows with input length', () => {
    const short = encrypt('hi');
    const long = encrypt('hi'.repeat(100));
    expect(long.length).toBeGreaterThan(short.length);
  });

  it('throws on tampered ciphertext (auth tag mismatch)', () => {
    const buf = encrypt('sensitive data');
    // Flip a byte in the ciphertext region (after IV + authTag)
    buf[30] ^= 0xff;
    expect(() => decrypt(buf)).toThrow();
  });

  it('throws on tampered auth tag', () => {
    const buf = encrypt('sensitive data');
    // Corrupt the auth tag (bytes 12–27)
    buf[12] ^= 0x01;
    expect(() => decrypt(buf)).toThrow();
  });

  it('throws on truncated buffer', () => {
    const buf = encrypt('data');
    expect(() => decrypt(buf.subarray(0, 10))).toThrow();
  });
});

describe('ENCRYPTION_KEY validation', () => {
  const originalKey = process.env.ENCRYPTION_KEY;

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.ENCRYPTION_KEY;
    } else {
      process.env.ENCRYPTION_KEY = originalKey;
    }
  });

  it('works without ENCRYPTION_KEY in non-production (uses dev fallback)', () => {
    delete process.env.ENCRYPTION_KEY;
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    expect(() => encrypt('test')).not.toThrow();
    process.env.NODE_ENV = original;
  });

  it('throws on invalid ENCRYPTION_KEY length', () => {
    process.env.ENCRYPTION_KEY = 'tooshort';
    expect(() => encrypt('test')).toThrow('64-character hex string');
  });

  it('throws on non-hex ENCRYPTION_KEY', () => {
    process.env.ENCRYPTION_KEY = 'z'.repeat(64); // not valid hex
    expect(() => encrypt('test')).toThrow('64-character hex string');
  });

  it('accepts a valid 64-char hex ENCRYPTION_KEY', () => {
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    const buf = encrypt('hello');
    expect(decrypt(buf)).toBe('hello');
  });
});
