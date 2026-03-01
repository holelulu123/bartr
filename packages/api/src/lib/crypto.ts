/**
 * AES-256-GCM symmetric encryption for sensitive fields (emails, messages).
 *
 * Each encrypt() call produces a fresh random 12-byte IV, so identical
 * plaintexts yield different ciphertexts. The output is a single Buffer:
 *
 *   [ iv (12 bytes) | authTag (16 bytes) | ciphertext (N bytes) ]
 *
 * The key is a 32-byte (256-bit) value derived from ENCRYPTION_KEY env var.
 * In dev, a deterministic fallback key is used so tests don't need env setup.
 */

import crypto from 'node:crypto';

import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;   // 96-bit IV — recommended for GCM
const TAG_LENGTH = 16;  // 128-bit auth tag

function getKey(): Buffer {
  const raw = env.encryptionKey;

  // Expect a 64-char hex string (32 bytes)
  if (raw.length !== 64 || !/^[0-9a-fA-F]+$/.test(raw)) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  return Buffer.from(raw, 'hex');
}

/**
 * Encrypts plaintext string → Buffer (iv + authTag + ciphertext).
 */
export function encrypt(plaintext: string): Buffer {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]);
}

/**
 * Decrypts Buffer (iv + authTag + ciphertext) → plaintext string.
 * Throws if the data has been tampered with (GCM auth tag mismatch).
 */
export function decrypt(data: Buffer): string {
  const key = getKey();

  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
