'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';

// Routes that are accessible without authentication
const PUBLIC_PATHS = ['/', '/login', '/register', '/donate', '/auth/callback', '/auth/unlock', '/auth/recover', '/register/email', '/about', '/privacy', '/health'];

// Routes that require email verification (authenticated + email_verified)
const VERIFIED_PATHS = ['/listings/new', '/market/new', '/exchange/new', '/messages'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function requiresVerification(pathname: string): boolean {
  return VERIFIED_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
    || /^\/listings\/[^/]+\/edit/.test(pathname);
}

export function GlobalAuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated && !isPublic(pathname)) {
      router.replace('/');
      return;
    }

    // Redirect unverified users to verify-email page when they try to post or message
    if (isAuthenticated && user && !user.email_verified && requiresVerification(pathname)) {
      router.replace(`/auth/verify-email?next=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthenticated, isLoading, pathname, router, user]);

  // While auth is initialising, block render on protected pages to avoid flash
  if (isLoading && !isPublic(pathname)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // On a protected page and definitely not authenticated — render nothing while redirect fires
  if (!isLoading && !isAuthenticated && !isPublic(pathname)) {
    return null;
  }

  // Unverified user on a verified-only page — render nothing while redirect fires
  if (!isLoading && isAuthenticated && user && !user.email_verified && requiresVerification(pathname)) {
    return null;
  }

  return <>{children}</>;
}
