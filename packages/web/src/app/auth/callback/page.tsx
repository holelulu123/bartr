'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useCrypto } from '@/contexts/crypto-context';
import { auth } from '@/lib/api';

type Status = 'loading' | 'error';

export default function AuthCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setTokens, refreshUser } = useAuth();
  const { unlock } = useCrypto();
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    async function handle() {
      const accessToken = searchParams.get('access_token');
      const refreshToken = searchParams.get('refresh_token');
      const authError = searchParams.get('auth_error');

      if (authError || !accessToken || !refreshToken) {
        setErrorMsg('Authentication failed. Please try again.');
        setStatus('error');
        return;
      }

      try {
        // Store tokens
        setTokens(accessToken, refreshToken);
        // Load user profile
        await refreshUser();

        // Fetch E2E key blobs — if user has keys (existing account) prompt for
        // password to unlock. New accounts don't have keys yet (they go to /register).
        try {
          const blobs = await auth.getKeyBlobs();
          if (blobs.private_key_blob) {
            // Existing account with E2E keys — needs password to unlock.
            // Redirect to a dedicated unlock page (or register if no keys at all).
            router.replace(`/auth/unlock`);
            return;
          }
        } catch {
          // getKeyBlobs failed — non-critical, continue
        }

        router.replace('/market');
      } catch {
        setErrorMsg('Something went wrong. Please try again.');
        setStatus('error');
      }
    }

    handle();
  }, [searchParams, setTokens, refreshUser, unlock, router]);

  if (status === 'error') {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
        <div className="text-center space-y-4">
          <p className="text-destructive font-medium">{errorMsg}</p>
          <a href="/login" className="text-sm text-primary hover:underline">
            Back to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
      <div className="text-center space-y-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
        <p className="text-sm text-muted-foreground">Signing you in...</p>
      </div>
    </div>
  );
}
