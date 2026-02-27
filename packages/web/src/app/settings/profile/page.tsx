'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Camera, Loader2, Save } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useUser, useUpdateProfile, useUploadAvatar } from '@/hooks/use-users';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  const { mutateAsync: uploadAvatar, isPending: uploadingAvatar } = useUploadAvatar();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

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

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Show preview
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    // Upload immediately
    try {
      await uploadAvatar(file);
    } catch {
      // Upload failure is non-critical; preview already set
    }
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
          <CardTitle>Avatar</CardTitle>
          <CardDescription>JPEG, PNG or WebP · max 5 MB</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <div className="relative">
            <Avatar className="h-20 w-20 text-xl">
              <AvatarImage src={avatarPreview ?? profile?.avatar_url ?? undefined} alt={me?.nickname} />
              <AvatarFallback>{me?.nickname?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
              aria-label="Change avatar"
            >
              {uploadingAvatar ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleAvatarChange}
            data-testid="avatar-input"
          />
          <p className="text-sm text-muted-foreground">
            Click the camera icon to upload a new photo.
          </p>
        </CardContent>
      </Card>

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
