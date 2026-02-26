'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Chrome } from 'lucide-react';
import { APP_NAME } from '@bartr/shared';
import { useAuth } from '@/contexts/auth-context';
import { auth } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // Redirect already-authenticated users
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) return null;

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{APP_NAME}</CardTitle>
          <CardDescription>Sign in to buy, sell, and trade</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button
            asChild
            className="w-full gap-2"
            onClick={() => { window.location.href = auth.getGoogleAuthUrl(); }}
          >
            <span role="button" aria-label="Sign in with Google">
              <Chrome className="h-4 w-4" />
              Continue with Google
            </span>
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            No KYC. No trackers. Just trade.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
