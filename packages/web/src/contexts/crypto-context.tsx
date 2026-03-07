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

async function getWrappingKey(): Promise<CryptoKey> {
  if (!wrappingKey) {
    // Try to restore from IndexedDB first (survives page refresh)
    wrappingKey = await loadWrappingKey();
  }
  if (!wrappingKey) {
    wrappingKey = await crypto.subtle.generateKey(
      { name: 'AES-KW', length: 256 },
      false, // non-extractable
      ['wrapKey', 'unwrapKey'],
    );
    await storeWrappingKey(wrappingKey);
  }
  return wrappingKey;
}

async function cachePrivateKey(key: CryptoKey) {
  try {
    const wk = await getWrappingKey();
    const wrapped = await crypto.subtle.wrapKey('pkcs8', key, wk, 'AES-KW');
    // Use localStorage so the wrapped key survives browser restarts.
    // The wrapping key in IndexedDB is non-extractable, so the blob is
    // useless without access to this browser's IndexedDB.
    localStorage.setItem(STORAGE_KEY, bufToBase64(wrapped));
  } catch { /* storage full or wrap error */ }
}

function clearCachedKey() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* noop — clean up legacy */ }
  clearWrappingKey();
  wrappingKey = null;
}

async function loadCachedKey(): Promise<CryptoKey | null> {
  try {
    // Check localStorage first, fall back to sessionStorage for migration
    const b64 = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
    if (!b64) return null;
    const wk = await getWrappingKey();
    return crypto.subtle.unwrapKey(
      'pkcs8',
      base64ToBuf(b64),
      wk,
      'AES-KW',
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits'],
    );
  } catch {
    // Wrapping key or cached data corrupt — clear everything
    clearCachedKey();
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

  // On mount, restore private key from sessionStorage (survives refresh)
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
    cachePrivateKey(keyPair.privateKey);

    return { publicKeyBase64, privateKeyBlob, recoveryKeyHex, recoveryKeyBlob };
  }, []);

  const unlock = useCallback(async (privateKeyBlob: string, password: string) => {
    const privateKey = await unwrapPrivateKey(privateKeyBlob, password);
    stateRef.current = { ...stateRef.current, privateKey };
    setUnlockedState(true);
    cachePrivateKey(privateKey);
  }, []);

  const unlockWithRecovery = useCallback(
    async (recoveryKeyBlob: string, recoveryKeyHex: string) => {
      const privateKey = await unwrapWithRecoveryKey(recoveryKeyBlob, recoveryKeyHex);
      stateRef.current = { ...stateRef.current, privateKey };
      setUnlockedState(true);
      cachePrivateKey(privateKey);
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
