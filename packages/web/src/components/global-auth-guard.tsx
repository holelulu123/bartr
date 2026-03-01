'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';

// Routes accessible without authentication
const PUBLIC_PATHS = ['/', '/login', '/register', '/donate', '/auth/callback', '/auth/unlock', '/auth/recover', '/register/email', '/about', '/privacy', '/health'];

// Routes accessible to authenticated-but-unverified users (in addition to PUBLIC_PATHS)
const UNVERIFIED_PATHS = ['/auth/verify-email'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function isAllowedUnverified(pathname: string): boolean {
  return isPublic(pathname) || UNVERIFIED_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
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

    // Hard gate: unverified users can ONLY access public pages + /auth/verify-email
    // (only enforced when the server has email verification enabled)
    if (isAuthenticated && user && user.email_verification_required && !user.email_verified && !isAllowedUnverified(pathname)) {
      router.replace('/auth/verify-email');
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

  // Unverified user on a restricted page — render nothing while redirect fires
  if (!isLoading && isAuthenticated && user && user.email_verification_required && !user.email_verified && !isAllowedUnverified(pathname)) {
    return null;
  }

  return <>{children}</>;
}
