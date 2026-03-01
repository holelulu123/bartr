'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';

// Routes that are accessible without authentication
const PUBLIC_PATHS = ['/', '/login', '/register', '/donate', '/auth/callback', '/auth/unlock', '/auth/recover', '/register/email', '/about', '/privacy', '/health'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export function GlobalAuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isPublic(pathname)) {
      router.replace('/');
    }
  }, [isAuthenticated, isLoading, pathname, router]);

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

  return <>{children}</>;
}
