'use client';

import { createContext, useContext, useRef, useCallback, useState, type ReactNode } from 'react';
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
} from '@/lib/crypto/e2e';

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
  // Private key lives only in memory — never serialized
  const stateRef = useRef<CryptoState>({ publicKey: null, privateKey: null });
  // Separate boolean state so components re-render when keys are loaded/cleared
  const [unlockedState, setUnlockedState] = useState(false);

  const register = useCallback(async (password: string) => {
    const keyPair = await generateKeyPair();
    const publicKeyBase64 = await exportPublicKey(keyPair.publicKey);
    const privateKeyBlob = await wrapPrivateKey(keyPair.privateKey, password);
    const { recoveryKeyHex, blob: recoveryKeyBlob } = await wrapWithRecoveryKey(keyPair.privateKey);

    // Keep keys in memory for the session
    stateRef.current = { publicKey: keyPair.publicKey, privateKey: keyPair.privateKey };
    setUnlockedState(true);

    return { publicKeyBase64, privateKeyBlob, recoveryKeyHex, recoveryKeyBlob };
  }, []);

  const unlock = useCallback(async (privateKeyBlob: string, password: string) => {
    const privateKey = await unwrapPrivateKey(privateKeyBlob, password);
    stateRef.current = { ...stateRef.current, privateKey };
    setUnlockedState(true);
  }, []);

  const unlockWithRecovery = useCallback(
    async (recoveryKeyBlob: string, recoveryKeyHex: string) => {
      const privateKey = await unwrapWithRecoveryKey(recoveryKeyBlob, recoveryKeyHex);
      stateRef.current = { ...stateRef.current, privateKey };
      setUnlockedState(true);
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
