'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { APP_NAME } from '@bartr/shared';
import { useAuth } from '@/contexts/auth-context';
import { useCrypto } from '@/contexts/crypto-context';
import { auth } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type FormData = z.infer<typeof schema>;

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000; // 1 minute
const ATTEMPT_WINDOW_MS = 60_000; // reset failed attempts after 1 minute of inactivity

function loadLockState(): { attempts: number; lockedUntil: number | null } {
  if (typeof window === 'undefined') return { attempts: 0, lockedUntil: null };
  try {
    const raw = sessionStorage.getItem('login_lock');
    if (!raw) return { attempts: 0, lockedUntil: null };
    const parsed = JSON.parse(raw);
    // Clear expired lockout
    if (parsed.lockedUntil && Date.now() >= parsed.lockedUntil) {
      sessionStorage.removeItem('login_lock');
      return { attempts: 0, lockedUntil: null };
    }
    // Clear stale attempts (no lockout, but attempts older than window)
    if (!parsed.lockedUntil && parsed.lastAttemptAt && Date.now() - parsed.lastAttemptAt >= ATTEMPT_WINDOW_MS) {
      sessionStorage.removeItem('login_lock');
      return { attempts: 0, lockedUntil: null };
    }
    return { attempts: parsed.attempts ?? 0, lockedUntil: parsed.lockedUntil ?? null };
  } catch {
    return { attempts: 0, lockedUntil: null };
  }
}

function saveLockState(attempts: number, lockedUntil: number | null) {
  try {
    sessionStorage.setItem('login_lock', JSON.stringify({ attempts, lockedUntil, lastAttemptAt: Date.now() }));
  } catch { /* noop */ }
}

export default function LoginPage() {
  const { isAuthenticated, isLoading, setTokens, refreshUser } = useAuth();
  const { unlock } = useCrypto();
  const router = useRouter();
  const [serverError, setServerError] = useState('');
  const initState = loadLockState();
  const [attempts, setAttempts] = useState(initState.attempts);
  const [lockedUntil, setLockedUntil] = useState<number | null>(initState.lockedUntil);
  const [lockCountdown, setLockCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // Show initial error if returning with lockout active
  useEffect(() => {
    if (initState.lockedUntil && Date.now() < initState.lockedUntil) {
      setServerError('Too many failed attempts. Please wait 1 minute.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace('/listings');
  }, [isAuthenticated, isLoading, router]);

  // Countdown timer when locked out
  useEffect(() => {
    if (lockedUntil === null) return;
    timerRef.current = setInterval(() => {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockedUntil(null);
        setAttempts(0);
        setLockCountdown(0);
        saveLockState(0, null);
        if (timerRef.current) clearInterval(timerRef.current);
      } else {
        setLockCountdown(remaining);
      }
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [lockedUntil]);

  if (isLoading) return null;

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;

  async function onSubmit(data: FormData) {
    if (isLocked) return;
    setServerError('');
    try {
      const tokens = await auth.loginEmail(data.email, data.password);
      setTokens(tokens.access_token, tokens.refresh_token);
      await refreshUser();
      // Unlock E2E keys immediately using the password already in hand
      try {
        const blobs = await auth.getKeyBlobs();
        if (blobs.private_key_blob) {
          await unlock(blobs.private_key_blob, data.password);
        }
      } catch {
        // Non-fatal — user can still browse, messaging just won't decrypt
      }
      router.replace('/listings');
    } catch {
      const next = attempts + 1;
      setAttempts(next);
      if (next >= MAX_ATTEMPTS) {
        const until = Date.now() + LOCKOUT_MS;
        setLockedUntil(until);
        saveLockState(next, until);
        setServerError('Too many failed attempts. Please wait 1 minute.');
      } else {
        saveLockState(next, null);
        setServerError(`Invalid email or password. ${MAX_ATTEMPTS - next} attempt${MAX_ATTEMPTS - next === 1 ? '' : 's'} remaining.`);
      }
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
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                disabled={isLocked}
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
                disabled={isLocked}
                {...register('password')}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            {serverError && (
              <p className="text-sm text-destructive" role="alert">{serverError}</p>
            )}

            {isLocked && (
              <p className="text-sm text-muted-foreground text-center" role="status">
                Try again in {lockCountdown}s
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting || isLocked}>
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

          <p className="text-center text-xs text-muted-foreground">
            No KYC. No trackers. Just trade.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
