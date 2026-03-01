'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Mail, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { auth } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const schema = z.object({
  code: z
    .string()
    .min(1, 'Verification code is required')
    .regex(/^\d{6}$/, 'Code must be exactly 6 digits'),
});

type FormData = z.infer<typeof schema>;

const CODE_EXPIRY_S = 5 * 60; // 5 minutes
const RESEND_COOLDOWN_S = 60;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/market';
  const { user, isAuthenticated, isLoading, refreshUser } = useAuth();
  const { toast } = useToast();
  const [serverError, setServerError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [codeExpiry, setCodeExpiry] = useState(CODE_EXPIRY_S);
  const [resending, setResending] = useState(false);
  const resendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  // Code expiry countdown (starts on mount)
  useEffect(() => {
    expiryTimerRef.current = setInterval(() => {
      setCodeExpiry((prev) => {
        if (prev <= 1) {
          if (expiryTimerRef.current) clearInterval(expiryTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (expiryTimerRef.current) clearInterval(expiryTimerRef.current);
    };
  }, []);

  // Resend cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    resendTimerRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (resendTimerRef.current) clearInterval(resendTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    };
  }, [resendCooldown > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return null;

  if (!isAuthenticated) {
    router.replace('/login');
    return null;
  }

  if (user?.email_verified) {
    router.replace(next);
    return null;
  }

  async function onSubmit(data: FormData) {
    setServerError('');
    try {
      await auth.verifyEmail(data.code);
      await refreshUser();
      toast({ title: 'Email verified', variant: 'success' });
      router.replace(next);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Verification failed. Please try again.';
      setServerError(message);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    setServerError('');
    try {
      await auth.resendVerification();
      toast({ title: 'Verification code sent', description: 'Check your email for the new code.' });
      setResendCooldown(RESEND_COOLDOWN_S);
      // Reset the expiry timer for the new code
      setCodeExpiry(CODE_EXPIRY_S);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to resend code. Please try again.';
      setServerError(message);
    } finally {
      setResending(false);
    }
  }

  const codeExpired = codeExpiry <= 0;

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Verify your email</CardTitle>
          <CardDescription>
            Enter the 6-digit code we sent to your email address.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {/* Expiry timer */}
            <div className={`flex items-center justify-center gap-1.5 text-sm ${codeExpired ? 'text-destructive' : 'text-muted-foreground'}`}>
              <Clock className="h-3.5 w-3.5" />
              {codeExpired ? (
                <span>Code expired — click Resend below</span>
              ) : (
                <span>Code expires in {formatTime(codeExpiry)}</span>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="code">Verification code</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                autoComplete="one-time-code"
                autoFocus
                className="text-center text-lg tracking-widest"
                {...register('code')}
              />
              {errors.code && (
                <p className="text-xs text-destructive">{errors.code.message}</p>
              )}
            </div>

            {serverError && (
              <p className="text-sm text-destructive" role="alert">{serverError}</p>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting || codeExpired}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify'
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Didn&apos;t receive the code?{' '}
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0 || resending}
                className="text-primary hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend'}
              </button>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
