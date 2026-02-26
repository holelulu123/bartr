/**
 * E2E encryption using Web Crypto API.
 *
 * Key model:
 *   - X25519 (ECDH) keypair per user, generated in browser at registration
 *   - Private key is never sent to server in plaintext
 *   - private_key_blob  = privateKey wrapped with PBKDF2(password) → AES-GCM
 *   - recovery_key_blob = privateKey wrapped with a random 32-byte recovery key → AES-GCM
 *   - public_key stored as base64 on server (plaintext — it's public)
 *   - Messages: ECDH shared secret → AES-GCM encrypt in browser, server stores base64 ciphertext
 */

const PBKDF2_ITERATIONS = 600_000;
const PBKDF2_HASH = 'SHA-256';
const AES_KEY_LENGTH = 256;

// ─── Key generation ──────────────────────────────────────────────────────────

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveKey',
    'deriveBits',
  ]);
}

// ─── Export / import raw keys ────────────────────────────────────────────────

export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('spki', publicKey);
  return bufToBase64(raw);
}

export async function importPublicKey(base64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'spki',
    base64ToBuf(base64),
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    [],
  );
}

// ─── PBKDF2 key derivation ────────────────────────────────────────────────────

async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH,
    },
    keyMaterial,
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    false,
    ['wrapKey', 'unwrapKey'],
  );
}

// ─── Wrap / unwrap private key with password ─────────────────────────────────

/**
 * Returns base64(salt(16) | iv(12) | wrappedKey)
 */
export async function wrapPrivateKey(
  privateKey: CryptoKey,
  password: string,
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrapKey = await deriveKeyFromPassword(password, salt);

  const wrapped = await crypto.subtle.wrapKey('pkcs8', privateKey, wrapKey, {
    name: 'AES-GCM',
    iv,
  });

  const blob = new Uint8Array(salt.byteLength + iv.byteLength + wrapped.byteLength);
  blob.set(salt, 0);
  blob.set(iv, salt.byteLength);
  blob.set(new Uint8Array(wrapped), salt.byteLength + iv.byteLength);
  return bufToBase64(blob.buffer);
}

/**
 * Reverses wrapPrivateKey — throws if password is wrong (AES-GCM auth tag fails)
 */
export async function unwrapPrivateKey(
  base64Blob: string,
  password: string,
): Promise<CryptoKey> {
  const blob = new Uint8Array(base64ToBuf(base64Blob));
  const salt = blob.slice(0, 16);
  const iv = blob.slice(16, 28);
  const wrapped = blob.slice(28);

  const wrapKey = await deriveKeyFromPassword(password, salt);
  return crypto.subtle.unwrapKey(
    'pkcs8',
    wrapped,
    wrapKey,
    { name: 'AES-GCM', iv },
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits'],
  );
}

// ─── Recovery key wrap / unwrap ───────────────────────────────────────────────

/**
 * Generates a random 32-byte recovery key and wraps the private key with it.
 * Returns { recoveryKey (hex, shown to user once), blob (base64, stored on server) }
 */
export async function wrapWithRecoveryKey(privateKey: CryptoKey): Promise<{
  recoveryKeyHex: string;
  blob: string;
}> {
  const recoveryBytes = crypto.getRandomValues(new Uint8Array(32));
  const recoveryKeyHex = Array.from(recoveryBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aesKey = await crypto.subtle.importKey('raw', recoveryBytes, { name: 'AES-GCM', length: 256 }, false, ['wrapKey']);

  const wrapped = await crypto.subtle.wrapKey('pkcs8', privateKey, aesKey, { name: 'AES-GCM', iv });

  const blob = new Uint8Array(iv.byteLength + wrapped.byteLength);
  blob.set(iv, 0);
  blob.set(new Uint8Array(wrapped), iv.byteLength);

  return { recoveryKeyHex, blob: bufToBase64(blob.buffer) };
}

/**
 * Unwraps private key using the hex recovery key
 */
export async function unwrapWithRecoveryKey(
  base64Blob: string,
  recoveryKeyHex: string,
): Promise<CryptoKey> {
  const blob = new Uint8Array(base64ToBuf(base64Blob));
  const iv = blob.slice(0, 12);
  const wrapped = blob.slice(12);

  const recoveryBytes = hexToBuf(recoveryKeyHex);
  const aesKey = await crypto.subtle.importKey('raw', recoveryBytes, { name: 'AES-GCM', length: 256 }, false, ['unwrapKey']);

  return crypto.subtle.unwrapKey(
    'pkcs8',
    wrapped,
    aesKey,
    { name: 'AES-GCM', iv },
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits'],
  );
}

// ─── Message encryption ───────────────────────────────────────────────────────

/**
 * Encrypts a plaintext message for a recipient.
 * Returns base64(iv(12) | ciphertext) — sent as body_encrypted to server.
 */
export async function encryptMessage(
  plaintext: string,
  theirPublicKey: CryptoKey,
  myPrivateKey: CryptoKey,
): Promise<string> {
  const sharedKey = await deriveSharedKey(myPrivateKey, theirPublicKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    sharedKey,
    new TextEncoder().encode(plaintext),
  );

  const out = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ciphertext), iv.byteLength);
  return bufToBase64(out.buffer);
}

/**
 * Decrypts a base64 body_encrypted from the server.
 */
export async function decryptMessage(
  base64Ciphertext: string,
  theirPublicKey: CryptoKey,
  myPrivateKey: CryptoKey,
): Promise<string> {
  const sharedKey = await deriveSharedKey(myPrivateKey, theirPublicKey);
  const blob = new Uint8Array(base64ToBuf(base64Ciphertext));
  const iv = blob.slice(0, 12);
  const ciphertext = blob.slice(12);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    sharedKey,
    ciphertext,
  );
  return new TextDecoder().decode(plaintext);
}

// ─── Shared key derivation ────────────────────────────────────────────────────

async function deriveSharedKey(
  myPrivateKey: CryptoKey,
  theirPublicKey: CryptoKey,
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: theirPublicKey },
    myPrivateKey,
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  );
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function bufToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

export function base64ToBuf(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}

function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
