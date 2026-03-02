'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Palette, User, ArrowUpDown, Loader2, Check } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useUpdateProfile } from '@/hooks/use-users';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';

export default function SettingsPage() {
  const router = useRouter();
  const { user: me, isAuthenticated, isLoading } = useAuth();
  const { mutateAsync: updateProfile } = useUpdateProfile();

  const [maxOffers, setMaxOffers] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Sync from auth user
  useEffect(() => {
    if (me) {
      setMaxOffers(me.max_exchange_offers?.toString() ?? '');
    }
  }, [me]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  async function saveMaxOffers() {
    setError('');
    setSaved(false);
    const parsed = maxOffers.trim() === '' ? null : parseInt(maxOffers, 10);
    if (parsed !== null && (isNaN(parsed) || parsed < 1 || parsed > 100)) {
      setError('Must be between 1 and 100');
      return;
    }
    const current = me?.max_exchange_offers ?? null;
    if (parsed === current) {
      setSaved(true);
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ max_exchange_offers: parsed });
      setSaved(true);
    } catch (e: unknown) {
      const body = (e as { body?: { error?: string } })?.body;
      setError(body?.error ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-xl px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Profile
          </CardTitle>
          <CardDescription>Edit your nickname, bio, and avatar</CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/settings/profile"
            className="flex items-center justify-between text-sm hover:text-primary transition-colors"
            data-testid="profile-settings-link"
          >
            Edit profile
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowUpDown className="h-4 w-4" />
            Trading
          </CardTitle>
          <CardDescription>Configure your P2P exchange limits</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="max_exchange_offers">Max active exchange offers</Label>
            <div className="flex gap-2">
              <Input
                id="max_exchange_offers"
                type="number"
                min={1}
                max={100}
                placeholder="Unlimited"
                value={maxOffers}
                onChange={(e) => { setMaxOffers(e.target.value); setSaved(false); }}
                className="max-w-[160px]"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={saveMaxOffers}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : saved ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  'Save'
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Limit how many active exchange offers you can have. Leave empty for unlimited.
            </p>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4" />
            Appearance
          </CardTitle>
          <CardDescription>Choose between light and dark mode</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeToggle />
        </CardContent>
      </Card>
    </div>
  );
}
