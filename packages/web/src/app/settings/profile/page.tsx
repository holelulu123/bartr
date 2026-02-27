'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Save } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useUser, useUpdateProfile } from '@/hooks/use-users';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const schema = z.object({
  nickname: z
    .string()
    .min(3, 'Must be 3–30 characters')
    .max(30, 'Must be 3–30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Only letters, numbers, _ and - allowed'),
  bio: z.string().max(500, 'Bio must be 500 characters or less').optional(),
});

type FormData = z.infer<typeof schema>;

export default function EditProfilePage() {
  const router = useRouter();
  const { user: me, isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useUser(me?.nickname ?? '');
  const { mutateAsync: updateProfile } = useUpdateProfile();

  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { nickname: '', bio: '' },
  });

  // Pre-fill form once profile loads
  useEffect(() => {
    if (profile) {
      reset({ nickname: profile.nickname, bio: profile.bio ?? '' });
    }
  }, [profile, reset]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || profileLoading) {
    return (
      <div className="container mx-auto max-w-xl px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  async function onSubmit(data: FormData) {
    setSaveError('');
    setSaveSuccess(false);
    try {
      const payload: { nickname?: string; bio?: string } = {};
      if (data.nickname !== profile?.nickname) payload.nickname = data.nickname;
      if (data.bio !== (profile?.bio ?? '')) payload.bio = data.bio;

      if (Object.keys(payload).length > 0) {
        await updateProfile(payload);
      }
      setSaveSuccess(true);
      // If nickname changed, redirect to new profile URL
      if (payload.nickname) {
        router.replace(`/user/${payload.nickname}`);
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('409')) {
        setSaveError('Nickname already taken.');
      } else {
        setSaveError('Failed to save. Please try again.');
      }
    }
  }

  const bioValue = watch('bio') ?? '';

  return (
    <div className="container mx-auto max-w-xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Edit profile</h1>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/user/${me?.nickname}`}>View profile</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile info</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                placeholder="Tell the community about yourself…"
                rows={4}
                {...register('bio')}
              />
              <p className="text-xs text-muted-foreground text-right">
                {bioValue.length} / 500
              </p>
              {errors.bio && (
                <p className="text-xs text-destructive">{errors.bio.message}</p>
              )}
            </div>

            {saveError && (
              <p className="text-sm text-destructive" role="alert">{saveError}</p>
            )}

            {saveSuccess && (
              <p className="text-sm text-green-500" role="status">Profile saved!</p>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting || !isDirty}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save changes
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
