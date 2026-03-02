'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useCrypto } from '@/contexts/crypto-context';
import { auth } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const schema = z
  .object({
    email: z.string().email('Enter a valid email'),
    password: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/^[\x20-\x7E]+$/, 'Only English letters, numbers, and symbols')
      .regex(/[a-z]/, 'Must contain a lowercase letter')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[0-9]/, 'Must contain a number')
      .regex(/[^a-zA-Z0-9]/, 'Must contain a special character'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;

  if (score <= 2) return { score, label: 'Weak', color: 'bg-red-500' };
  if (score <= 3) return { score, label: 'Fair', color: 'bg-orange-500' };
  if (score <= 4) return { score, label: 'Good', color: 'bg-yellow-500' };
  if (score <= 5) return { score, label: 'Strong', color: 'bg-lime-500' };
  return { score, label: 'Very strong', color: 'bg-green-500' };
}

type FormData = z.infer<typeof schema>;

export default function EmailRegisterPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, setTokens, refreshUser } = useAuth();
  const { register: cryptoRegister } = useCrypto();

  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const watchedEmail = watch('email', '');
  const watchedPassword = watch('password', '');
  const watchedConfirm = watch('confirmPassword', '');

  // If user is already authenticated AND verified, redirect away from register page.
  // Unverified users should stay (they just registered and need to verify).
  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace('/market');
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) return null;

  async function onSubmit(data: FormData) {
    setServerError('');

    try {
      // crypto.subtle requires HTTPS (or localhost). If unavailable, register
      // without E2E keys — the user can set them up later via HTTPS.
      let cryptoPayload: {
        public_key?: string;
        private_key_blob?: string;
        recovery_key_blob?: string;
      } = {};

      if (globalThis.crypto?.subtle) {
        const { publicKeyBase64, privateKeyBlob, recoveryKeyBlob } =
          await cryptoRegister(data.password);
        cryptoPayload = {
          public_key: publicKeyBase64,
          private_key_blob: privateKeyBlob,
          recovery_key_blob: recoveryKeyBlob,
        };
      }

      const tokens = await auth.register({
        email: data.email,
        password: data.password,
        ...cryptoPayload,
      });

      setTokens(tokens.access_token, tokens.refresh_token);
      await refreshUser();
      router.replace('/market');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('409')) {
        setServerError('Email already registered.');
      } else if (msg.includes('429')) {
        setServerError('Too many attempts. Please wait and try again.');
      } else if (msg.includes('400')) {
        setServerError('Invalid registration data. Please check your inputs.');
      } else {
        setServerError('Registration failed. Please try again.');
      }
    }
  }

  // ── Registration form ─────────────────────────────────────────────────────

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Create your account</CardTitle>
          <CardDescription>Sign up with your email and a strong password. A nickname will be assigned automatically.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                {...register('email')}
              />
              {!errors.email && (
                watchedEmail.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(watchedEmail) ? (
                  <p className="text-xs text-green-600">Valid email format</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Enter a valid email address</p>
                )
              )}
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                {...register('confirmPassword')}
              />
            </div>

            {(() => {
              const strength = watchedPassword.length > 0
                ? getPasswordStrength(watchedPassword)
                : { score: 0, label: '', color: '' };
              const passwordsMatch = watchedPassword.length > 0 && watchedConfirm.length > 0 && watchedPassword === watchedConfirm;
              return (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition-colors ${
                            i < strength.score ? strength.color : 'bg-muted'
                          }`}
                        />
                      ))}
                    </div>
                    <p className={`text-xs ${
                      watchedPassword.length === 0 ? 'invisible' :
                      strength.score <= 2 ? 'text-red-500' :
                      strength.score <= 3 ? 'text-orange-500' :
                      strength.score <= 4 ? 'text-yellow-600' :
                      'text-green-600'
                    }`}>
                      {watchedPassword.length > 0 ? strength.label : '\u00A0'}
                    </p>
                  </div>
                  <ul className="space-y-0.5 text-sm">
                    {[
                      { test: watchedPassword.length >= 8, label: '8+ characters' },
                      { test: /[a-z]/.test(watchedPassword), label: 'Lowercase letter (a-z)' },
                      { test: /[A-Z]/.test(watchedPassword), label: 'Uppercase letter (A-Z)' },
                      { test: /[0-9]/.test(watchedPassword), label: 'Number (0-9)' },
                      { test: /[^a-zA-Z0-9]/.test(watchedPassword), label: 'Special character (!@#$%)' },
                      { test: passwordsMatch, label: 'Passwords match' },
                    ].map(({ test, label }) => (
                      <li key={label} className={test ? 'text-green-600' : 'text-red-500'}>
                        {test ? '✓' : '✗'} {label}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}

            {serverError && (
              <p className="text-sm text-destructive" role="alert">{serverError}</p>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating keys…
                </>
              ) : (
                'Create account'
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
