'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useCrypto } from '@/contexts/crypto-context';
import { useAuth } from '@/contexts/auth-context';

/**
 * Wraps pages that require E2E keys to be loaded.
 * If the user is authenticated but keys are not unlocked,
 * redirects to /auth/unlock?next=<current-path>.
 *
 * Usage: wrap the page body (not the layout) with <CryptoGuard>.
 */
export function CryptoGuard({ children }: { children: React.ReactNode }) {
  const { isUnlocked } = useCrypto();
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && isAuthenticated && !isUnlocked) {
      router.replace(`/auth/unlock?next=${encodeURIComponent(pathname)}`);
    }
  }, [isUnlocked, isAuthenticated, isLoading, pathname, router]);

  // While redirecting, render nothing
  if (!isLoading && isAuthenticated && !isUnlocked) {
    return null;
  }

  return <>{children}</>;
}
