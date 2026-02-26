import { describe, it, expect } from 'vitest';
import {
  generateKeyPair,
  exportPublicKey,
  importPublicKey,
  wrapPrivateKey,
  unwrapPrivateKey,
  wrapWithRecoveryKey,
  unwrapWithRecoveryKey,
  encryptMessage,
  decryptMessage,
  bufToBase64,
  base64ToBuf,
} from '@/lib/crypto/e2e';

describe('E2E crypto library', () => {
  describe('generateKeyPair', () => {
    it('generates a P-256 ECDH keypair', async () => {
      const kp = await generateKeyPair();
      expect(kp.publicKey).toBeDefined();
      expect(kp.privateKey).toBeDefined();
      expect(kp.publicKey.algorithm.name).toBe('ECDH');
      expect(kp.privateKey.algorithm.name).toBe('ECDH');
    });

    it('generates unique keypairs each call', async () => {
      const kp1 = await generateKeyPair();
      const kp2 = await generateKeyPair();
      const pub1 = await exportPublicKey(kp1.publicKey);
      const pub2 = await exportPublicKey(kp2.publicKey);
      expect(pub1).not.toBe(pub2);
    });
  });

  describe('exportPublicKey / importPublicKey', () => {
    it('round-trips a public key through base64', async () => {
      const kp = await generateKeyPair();
      const b64 = await exportPublicKey(kp.publicKey);
      expect(typeof b64).toBe('string');
      expect(b64.length).toBeGreaterThan(0);

      const imported = await importPublicKey(b64);
      expect(imported.type).toBe('public');
      expect(imported.algorithm.name).toBe('ECDH');

      // Re-export should match original
      const b64Again = await exportPublicKey(imported);
      expect(b64Again).toBe(b64);
    });
  });

  describe('wrapPrivateKey / unwrapPrivateKey', () => {
    it('round-trips private key with correct password', async () => {
      const kp = await generateKeyPair();
      const blob = await wrapPrivateKey(kp.privateKey, 'correct-password');
      expect(typeof blob).toBe('string');

      const unwrapped = await unwrapPrivateKey(blob, 'correct-password');
      expect(unwrapped.type).toBe('private');
      expect(unwrapped.algorithm.name).toBe('ECDH');
    });

    it('produces different blobs for same key + password (random salt/IV)', async () => {
      const kp = await generateKeyPair();
      const blob1 = await wrapPrivateKey(kp.privateKey, 'password');
      const blob2 = await wrapPrivateKey(kp.privateKey, 'password');
      expect(blob1).not.toBe(blob2);
    });

    it('throws with wrong password', async () => {
      const kp = await generateKeyPair();
      const blob = await wrapPrivateKey(kp.privateKey, 'correct-password');
      await expect(unwrapPrivateKey(blob, 'wrong-password')).rejects.toThrow();
    });
  });

  describe('wrapWithRecoveryKey / unwrapWithRecoveryKey', () => {
    it('round-trips private key using recovery key', async () => {
      const kp = await generateKeyPair();
      const { recoveryKeyHex, blob } = await wrapWithRecoveryKey(kp.privateKey);

      expect(typeof recoveryKeyHex).toBe('string');
      expect(recoveryKeyHex).toHaveLength(64); // 32 bytes hex

      const unwrapped = await unwrapWithRecoveryKey(blob, recoveryKeyHex);
      expect(unwrapped.type).toBe('private');
      expect(unwrapped.algorithm.name).toBe('ECDH');
    });

    it('generates unique recovery keys each time', async () => {
      const kp = await generateKeyPair();
      const r1 = await wrapWithRecoveryKey(kp.privateKey);
      const r2 = await wrapWithRecoveryKey(kp.privateKey);
      expect(r1.recoveryKeyHex).not.toBe(r2.recoveryKeyHex);
    });

    it('throws with wrong recovery key', async () => {
      const kp = await generateKeyPair();
      const { blob } = await wrapWithRecoveryKey(kp.privateKey);
      const wrongKey = '0'.repeat(64);
      await expect(unwrapWithRecoveryKey(blob, wrongKey)).rejects.toThrow();
    });
  });

  describe('encryptMessage / decryptMessage', () => {
    it('encrypts and decrypts between two parties', async () => {
      const alice = await generateKeyPair();
      const bob = await generateKeyPair();

      const plaintext = 'Hey Bob, want to trade?';
      const ciphertext = await encryptMessage(plaintext, bob.publicKey, alice.privateKey);

      expect(typeof ciphertext).toBe('string');
      expect(ciphertext).not.toContain(plaintext);

      const decrypted = await decryptMessage(ciphertext, alice.publicKey, bob.privateKey);
      expect(decrypted).toBe(plaintext);
    });

    it('encrypts and decrypts in both directions (symmetric ECDH)', async () => {
      const alice = await generateKeyPair();
      const bob = await generateKeyPair();

      const msg1 = await encryptMessage('From Alice', bob.publicKey, alice.privateKey);
      const msg2 = await encryptMessage('From Bob', alice.publicKey, bob.privateKey);

      expect(await decryptMessage(msg1, alice.publicKey, bob.privateKey)).toBe('From Alice');
      expect(await decryptMessage(msg2, bob.publicKey, alice.privateKey)).toBe('From Bob');
    });

    it('produces different ciphertext each call (random IV)', async () => {
      const alice = await generateKeyPair();
      const bob = await generateKeyPair();

      const ct1 = await encryptMessage('same message', bob.publicKey, alice.privateKey);
      const ct2 = await encryptMessage('same message', bob.publicKey, alice.privateKey);
      expect(ct1).not.toBe(ct2);
    });

    it('throws decrypting with wrong key', async () => {
      const alice = await generateKeyPair();
      const bob = await generateKeyPair();
      const eve = await generateKeyPair();

      const ct = await encryptMessage('secret', bob.publicKey, alice.privateKey);
      await expect(decryptMessage(ct, alice.publicKey, eve.privateKey)).rejects.toThrow();
    });

    it('handles empty string', async () => {
      const alice = await generateKeyPair();
      const bob = await generateKeyPair();
      const ct = await encryptMessage('', bob.publicKey, alice.privateKey);
      const dec = await decryptMessage(ct, alice.publicKey, bob.privateKey);
      expect(dec).toBe('');
    });

    it('handles unicode and emoji', async () => {
      const alice = await generateKeyPair();
      const bob = await generateKeyPair();
      const msg = 'Hello 🔐 שלום 안녕하세요';
      const ct = await encryptMessage(msg, bob.publicKey, alice.privateKey);
      const dec = await decryptMessage(ct, alice.publicKey, bob.privateKey);
      expect(dec).toBe(msg);
    });
  });

  describe('bufToBase64 / base64ToBuf', () => {
    it('round-trips arbitrary bytes', () => {
      const bytes = new Uint8Array([0, 1, 127, 128, 255]);
      const b64 = bufToBase64(bytes.buffer);
      const back = new Uint8Array(base64ToBuf(b64));
      expect(Array.from(back)).toEqual([0, 1, 127, 128, 255]);
    });
  });
});
