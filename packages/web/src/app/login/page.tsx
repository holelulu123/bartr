'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Chrome, Loader2, Mail } from 'lucide-react';
import { APP_NAME } from '@bartr/shared';
import { useAuth } from '@/contexts/auth-context';
import { auth } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type FormData = z.infer<typeof schema>;

type Tab = 'google' | 'email';

export default function LoginPage() {
  const { isAuthenticated, isLoading, setTokens, refreshUser } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('email');
  const [serverError, setServerError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace('/listings');
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) return null;

  async function onSubmit(data: FormData) {
    setServerError('');
    try {
      const tokens = await auth.loginEmail(data.email, data.password);
      setTokens(tokens.access_token, tokens.refresh_token);
      await refreshUser();
      router.replace('/listings');
    } catch {
      setServerError('Invalid email or password.');
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{APP_NAME}</CardTitle>
          <CardDescription>Sign in to buy, sell, and trade</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Tabs */}
          <div className="flex rounded-lg border border-border p-0.5">
            <button
              onClick={() => setTab('email')}
              className={cn(
                'flex-1 rounded-md py-1.5 text-sm font-medium transition-colors',
                tab === 'email' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
              aria-selected={tab === 'email'}
              role="tab"
            >
              Email
            </button>
            <button
              onClick={() => setTab('google')}
              className={cn(
                'flex-1 rounded-md py-1.5 text-sm font-medium transition-colors',
                tab === 'google' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
              aria-selected={tab === 'google'}
              role="tab"
            >
              Google
            </button>
          </div>

          {/* Email/password form */}
          {tab === 'email' && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  {...register('email')}
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  {...register('password')}
                />
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
              </div>

              {serverError && (
                <p className="text-sm text-destructive" role="alert">{serverError}</p>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
              </Button>

              <Separator />

              <p className="text-center text-sm text-muted-foreground">
                No account?{' '}
                <Link href="/register/email" className="text-primary hover:underline">
                  Create one
                </Link>
              </p>
            </form>
          )}

          {/* Google OAuth */}
          {tab === 'google' && (
            <div className="space-y-3">
              <Button
                className="w-full gap-2"
                onClick={() => { window.location.href = auth.getGoogleAuthUrl(); }}
              >
                <Chrome className="h-4 w-4" />
                Continue with Google
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                No account?{' '}
                <span className="text-muted-foreground">
                  Sign in with Google to create one automatically.
                </span>
              </p>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground">
            No KYC. No trackers. Just trade.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
