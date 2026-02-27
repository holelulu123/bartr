'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useCrypto } from '@/contexts/crypto-context';
import { auth } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const schema = z.object({
  password: z.string().min(1, 'Password is required'),
});

type FormData = z.infer<typeof schema>;

export default function UnlockPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/listings';
  const { isAuthenticated } = useAuth();
  const { unlock } = useCrypto();
  const [unlockError, setUnlockError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  // If not authenticated at all, send to login
  if (!isAuthenticated) {
    router.replace('/login');
    return null;
  }

  async function onSubmit(data: FormData) {
    setUnlockError('');
    try {
      const blobs = await auth.getKeyBlobs();
      if (!blobs.private_key_blob) {
        router.replace(next);
        return;
      }
      await unlock(blobs.private_key_blob, data.password);
      router.replace(next);
    } catch {
      setUnlockError('Incorrect password. Try again or use your recovery key.');
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Unlock your keys</CardTitle>
          <CardDescription>
            Enter your password to decrypt your private key and enable end-to-end encrypted messaging.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                autoFocus
                {...register('password')}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            {unlockError && (
              <p className="text-sm text-destructive" role="alert">{unlockError}</p>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Unlocking…
                </>
              ) : (
                'Unlock'
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Forgot your password?{' '}
              <Link href="/auth/recover" className="text-primary hover:underline">
                Use recovery key
              </Link>
            </p>

            <p className="text-center text-sm text-muted-foreground">
              <Link href={next} className="text-muted-foreground hover:underline text-xs">
                Skip for now (messaging disabled)
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
