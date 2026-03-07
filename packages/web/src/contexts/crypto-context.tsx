'use client';

import { createContext, useContext, useRef, useCallback, useState, useEffect, type ReactNode } from 'react';
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

const STORAGE_KEY = 'bartr_e2e_priv';
const IDB_NAME = 'bartr_keys';
const IDB_STORE = 'wrapping';
const IDB_KEY = 'wk';

// Wrapping key cached in memory for fast access; persisted in IndexedDB to
// survive page refreshes. IndexedDB can store non-extractable CryptoKey objects
// natively, so XSS cannot export the key — it can only be used in-place.
let wrappingKey: CryptoKey | null = null;
// Deduplicate concurrent getWrappingKey calls to prevent race conditions
// (e.g. React StrictMode double-mount firing two loadCachedKey calls)
let wrappingKeyPromise: Promise<CryptoKey> | null = null;

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(IDB_STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function storeWrappingKey(key: CryptoKey): Promise<void> {
  try {
    const db = await openIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(key, IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch { /* IndexedDB unavailable — fall back to in-memory only */ }
}

async function loadWrappingKey(): Promise<CryptoKey | null> {
  try {
    const db = await openIDB();
    const key = await new Promise<CryptoKey | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return key;
  } catch {
    return null;
  }
}

async function clearWrappingKey(): Promise<void> {
  try {
    const db = await openIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch { /* noop */ }
}

async function getWrappingKeyImpl(): Promise<CryptoKey> {
  if (!wrappingKey) {
    const loaded = await loadWrappingKey();
    // Only accept AES-GCM keys — discard legacy AES-KW keys that can't
    // encrypt/decrypt (they only had wrapKey/unwrapKey usages).
    if (loaded && loaded.algorithm.name === 'AES-GCM') {
      wrappingKey = loaded;
    }
  }
  if (!wrappingKey) {
    wrappingKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false, // non-extractable
      ['encrypt', 'decrypt'],
    );
    await storeWrappingKey(wrappingKey);
  }
  return wrappingKey;
}

// Serialised access — only one getWrappingKey call runs at a time so
// concurrent callers share the same key and don't race on IndexedDB.
function getWrappingKey(): Promise<CryptoKey> {
  if (!wrappingKeyPromise) {
    wrappingKeyPromise = getWrappingKeyImpl().finally(() => {
      wrappingKeyPromise = null;
    });
  }
  return wrappingKeyPromise;
}

async function cachePrivateKey(key: CryptoKey): Promise<void> {
  try {
    const wk = await getWrappingKey();
    const exported = await crypto.subtle.exportKey('pkcs8', key);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wk, exported);
    // Store iv + ciphertext together
    const blob = new Uint8Array(iv.byteLength + encrypted.byteLength);
    blob.set(iv, 0);
    blob.set(new Uint8Array(encrypted), iv.byteLength);
    localStorage.setItem(STORAGE_KEY, bufToBase64(blob.buffer));
  } catch (err) {
    console.error('[E2E] Failed to cache private key:', err);
  }
}

function clearCachedKey() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* noop — clean up legacy */ }
  clearWrappingKey();
  wrappingKey = null;
  wrappingKeyPromise = null;
}

async function loadCachedKey(): Promise<CryptoKey | null> {
  try {
    const b64 = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
    if (!b64) return null;
    const wk = await getWrappingKey();
    const raw = new Uint8Array(base64ToBuf(b64));
    const iv = raw.slice(0, 12);
    const ciphertext = raw.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, wk, ciphertext);
    return crypto.subtle.importKey(
      'pkcs8',
      decrypted,
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits'],
    );
  } catch (err) {
    console.warn('[E2E] Failed to load cached key:', err);
    return null;
  }
}

interface CryptoState {
  publicKey: CryptoKey | null;
  privateKey: CryptoKey | null;
}

interface CryptoContextValue {
  /** Generate a new keypair at registration time */
  register(password: string): Promise<{
    publicKeyBase64: string;
    privateKeyBlob: string;    // base64 — send to server
    recoveryKeyHex: string;    // show to user once, never stored
    recoveryKeyBlob: string;   // base64 — send to server
  }>;

  /** Unlock the private key after login using blobs fetched from server */
  unlock(privateKeyBlob: string, password: string): Promise<void>;

  /** Unlock using recovery key instead of password */
  unlockWithRecovery(recoveryKeyBlob: string, recoveryKeyHex: string): Promise<void>;

  /** Encrypt a plaintext message to a recipient (by their base64 public key) */
  encrypt(plaintext: string, recipientPublicKeyBase64: string): Promise<string>;

  /** Decrypt a base64 ciphertext from a sender (by their base64 public key) */
  decrypt(ciphertext: string, senderPublicKeyBase64: string): Promise<string>;

  /** Clear private key from memory (on logout) */
  lock(): void;

  /** Whether the private key is currently loaded */
  isUnlocked: boolean;
}

const CryptoContext = createContext<CryptoContextValue | null>(null);

export function CryptoProvider({ children }: { children: ReactNode }) {
  const stateRef = useRef<CryptoState>({ publicKey: null, privateKey: null });
  const [unlockedState, setUnlockedState] = useState(false);

  // On mount, restore private key from localStorage cache (survives refresh & restart)
  useEffect(() => {
    loadCachedKey().then((key) => {
      if (key) {
        stateRef.current = { ...stateRef.current, privateKey: key };
        setUnlockedState(true);
      }
    });
  }, []);

  const register = useCallback(async (password: string) => {
    const keyPair = await generateKeyPair();
    const publicKeyBase64 = await exportPublicKey(keyPair.publicKey);
    const privateKeyBlob = await wrapPrivateKey(keyPair.privateKey, password);
    const { recoveryKeyHex, blob: recoveryKeyBlob } = await wrapWithRecoveryKey(keyPair.privateKey);

    stateRef.current = { publicKey: keyPair.publicKey, privateKey: keyPair.privateKey };
    setUnlockedState(true);
    await cachePrivateKey(keyPair.privateKey);

    return { publicKeyBase64, privateKeyBlob, recoveryKeyHex, recoveryKeyBlob };
  }, []);

  const unlock = useCallback(async (privateKeyBlob: string, password: string) => {
    const privateKey = await unwrapPrivateKey(privateKeyBlob, password);
    stateRef.current = { ...stateRef.current, privateKey };
    setUnlockedState(true);
    await cachePrivateKey(privateKey);
  }, []);

  const unlockWithRecovery = useCallback(
    async (recoveryKeyBlob: string, recoveryKeyHex: string) => {
      const privateKey = await unwrapWithRecoveryKey(recoveryKeyBlob, recoveryKeyHex);
      stateRef.current = { ...stateRef.current, privateKey };
      setUnlockedState(true);
      await cachePrivateKey(privateKey);
    },
    [],
  );

  const encrypt = useCallback(
    async (plaintext: string, recipientPublicKeyBase64: string): Promise<string> => {
      const { privateKey } = stateRef.current;
      if (!privateKey) throw new Error('E2E keys not loaded — call unlock() first');
      const recipientKey = await importPublicKey(recipientPublicKeyBase64);
      return encryptMessage(plaintext, recipientKey, privateKey);
    },
    [],
  );

  const decrypt = useCallback(
    async (ciphertext: string, senderPublicKeyBase64: string): Promise<string> => {
      const { privateKey } = stateRef.current;
      if (!privateKey) throw new Error('E2E keys not loaded — call unlock() first');
      const senderKey = await importPublicKey(senderPublicKeyBase64);
      return decryptMessage(ciphertext, senderKey, privateKey);
    },
    [],
  );

  const lock = useCallback(() => {
    stateRef.current = { publicKey: null, privateKey: null };
    setUnlockedState(false);
    clearCachedKey();
  }, []);

  const value: CryptoContextValue = {
    register,
    unlock,
    unlockWithRecovery,
    encrypt,
    decrypt,
    lock,
    isUnlocked: unlockedState,
  };

  return <CryptoContext.Provider value={value}>{children}</CryptoContext.Provider>;
}

export function useCrypto(): CryptoContextValue {
  const ctx = useContext(CryptoContext);
  if (!ctx) throw new Error('useCrypto must be used inside <CryptoProvider>');
  return ctx;
}
