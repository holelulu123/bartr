'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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

const schema = z.object({
  password: z.string().min(8, 'At least 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setTokens, refreshUser, isAuthenticated, isLoading } = useAuth();
  const { register: cryptoRegister } = useCrypto();

  const googleId = searchParams.get('google_id') ?? '';

  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace('/listings');
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!googleId) router.replace('/login');
  }, [googleId, router]);

  async function onSubmit(data: FormData) {
    setServerError('');
    try {
      const { publicKeyBase64, privateKeyBlob, recoveryKeyBlob } =
        await cryptoRegister(data.password);

      const tokens = await auth.register({
        google_id: googleId,
        password: data.password,
        public_key: publicKeyBase64,
        private_key_blob: privateKeyBlob,
        recovery_key_blob: recoveryKeyBlob,
      });

      setTokens(tokens.access_token, tokens.refresh_token);
      await refreshUser();
      router.replace('/listings');
    } catch (e: unknown) {
      if (e instanceof Error) {
        setServerError(e.message || 'Registration failed. Please try again.');
      } else {
        setServerError('Registration failed. Please try again.');
      }
    }
  }

  if (isLoading) return null;

  // ── Set password ──────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Set your password</CardTitle>
          <CardDescription>
            Choose a strong password — it encrypts your private key and secures your account.
            A nickname will be assigned automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
