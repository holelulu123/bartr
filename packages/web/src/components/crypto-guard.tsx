'use client';

import { useEffect } from 'react';
import { useCrypto } from '@/contexts/crypto-context';
import { useAuth } from '@/contexts/auth-context';

/**
 * Wraps pages that require E2E keys to be loaded.
 * If the user is authenticated but keys are not unlocked (e.g. after a
 * page refresh that wiped the in-memory private key), log them out
 * entirely rather than prompting for a password re-entry.
 */
export function CryptoGuard({ children }: { children: React.ReactNode }) {
  const { isUnlocked } = useCrypto();
  const { isAuthenticated, isLoading, logout } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated && !isUnlocked) {
      logout();
    }
  }, [isUnlocked, isAuthenticated, isLoading, logout]);

  // While logging out, render nothing
  if (!isLoading && isAuthenticated && !isUnlocked) {
    return null;
  }

  return <>{children}</>;
}
