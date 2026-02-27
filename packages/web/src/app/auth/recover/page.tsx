'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useCrypto } from '@/contexts/crypto-context';
import { auth } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const schema = z.object({
  recoveryKey: z
    .string()
    .min(1, 'Recovery key is required')
    .regex(/^[0-9a-fA-F]+$/, 'Recovery key must be a hexadecimal string'),
});

type FormData = z.infer<typeof schema>;

export default function RecoverPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/listings';
  const { isAuthenticated } = useAuth();
  const { unlockWithRecovery } = useCrypto();
  const [recoverError, setRecoverError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  if (!isAuthenticated) {
    router.replace('/login');
    return null;
  }

  async function onSubmit(data: FormData) {
    setRecoverError('');
    try {
      const blobs = await auth.getKeyBlobs();
      if (!blobs.recovery_key_blob) {
        setRecoverError('No recovery key found for this account.');
        return;
      }
      await unlockWithRecovery(blobs.recovery_key_blob, data.recoveryKey.toLowerCase().trim());
      router.replace(next);
    } catch {
      setRecoverError('Invalid recovery key. Please check and try again.');
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Recover with recovery key</CardTitle>
          <CardDescription>
            Enter the recovery key you saved when you registered. This will restore access to your encrypted messages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="recoveryKey">Recovery key</Label>
              <Input
                id="recoveryKey"
                placeholder="aabbccdd1122…"
                autoComplete="off"
                autoFocus
                className="font-mono text-sm"
                {...register('recoveryKey')}
              />
              {errors.recoveryKey && (
                <p className="text-xs text-destructive">{errors.recoveryKey.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                The hex string shown after you registered.
              </p>
            </div>

            {recoverError && (
              <p className="text-sm text-destructive" role="alert">{recoverError}</p>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Recovering…
                </>
              ) : (
                'Recover access'
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              <Link
                href={`/auth/unlock${next !== '/listings' ? `?next=${encodeURIComponent(next)}` : ''}`}
                className="text-primary hover:underline"
              >
                Back to password unlock
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
