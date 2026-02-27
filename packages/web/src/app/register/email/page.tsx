'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Copy, KeyRound, Loader2 } from 'lucide-react';
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
    nickname: z
      .string()
      .min(3, 'Must be 3–30 characters')
      .max(30, 'Must be 3–30 characters')
      .regex(/^[a-zA-Z0-9_-]+$/, 'Only letters, numbers, _ and - allowed'),
    password: z.string().min(8, 'At least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

export default function EmailRegisterPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, setTokens, refreshUser } = useAuth();
  const { register: cryptoRegister } = useCrypto();

  const [step, setStep] = useState<'form' | 'recovery'>('form');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace('/listings');
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) return null;

  async function onSubmit(data: FormData) {
    setServerError('');
    try {
      const { publicKeyBase64, privateKeyBlob, recoveryKeyHex, recoveryKeyBlob } =
        await cryptoRegister(data.password);

      const tokens = await auth.registerEmail({
        email: data.email,
        nickname: data.nickname,
        password: data.password,
        public_key: publicKeyBase64,
        private_key_blob: privateKeyBlob,
        recovery_key_blob: recoveryKeyBlob,
      });

      setTokens(tokens.access_token, tokens.refresh_token);
      await refreshUser();

      setRecoveryKey(recoveryKeyHex);
      setStep('recovery');
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('409')) {
        setServerError(
          e.message.toLowerCase().includes('email')
            ? 'Email already registered.'
            : 'Nickname already taken.',
        );
      } else {
        setServerError('Registration failed. Please try again.');
      }
    }
  }

  async function copyRecoveryKey() {
    await navigator.clipboard.writeText(recoveryKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Recovery key screen ───────────────────────────────────────────────────

  if (step === 'recovery') {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <KeyRound className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Save your recovery key</CardTitle>
            <CardDescription>
              If you forget your password, this is the only way to recover your encrypted messages.
              Store it somewhere safe — it will never be shown again.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative rounded-md bg-muted p-4 font-mono text-sm break-all select-all">
              {recoveryKey}
              <Button
                size="sm"
                variant="ghost"
                className="absolute right-2 top-2 h-7 w-7 p-0"
                onClick={copyRecoveryKey}
                aria-label="Copy recovery key"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Write it down or store it in a password manager.
            </p>
            <Button className="w-full" onClick={() => router.replace('/listings')}>
              I have saved my recovery key
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Registration form ─────────────────────────────────────────────────────

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Create your account</CardTitle>
          <CardDescription>Sign up with your email and a strong password</CardDescription>
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
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nickname">Nickname</Label>
              <Input
                id="nickname"
                placeholder="satoshi"
                autoComplete="username"
                {...register('nickname')}
              />
              {errors.nickname && (
                <p className="text-xs text-destructive">{errors.nickname.message}</p>
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
              <p className="text-xs text-muted-foreground">
                Used to encrypt your private key — not just for login.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>

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
