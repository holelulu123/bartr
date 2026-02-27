'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useAdminFlags, useUpdateFlag } from '@/hooks/use-moderation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ModerationStatus } from '@bartr/shared';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_FILTERS: { label: string; value: ModerationStatus | 'pending' }[] = [
  { label: 'Pending', value: 'pending' },
  { label: 'Reviewed', value: 'reviewed' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Dismissed', value: 'dismissed' },
];

export default function AdminFlagsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [statusFilter, setStatusFilter] = useState<ModerationStatus | 'pending'>('pending');

  const { data, isLoading: flagsLoading } = useAdminFlags({ status: statusFilter as ModerationStatus });
  const updateFlagMutation = useUpdateFlag();

  // Redirect non-admins
  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.replace('/');
    }
  }, [authLoading, user, router]);

  if (authLoading) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (!user || user.role !== 'admin') return null;

  async function handleAction(flagId: string, status: ModerationStatus) {
    await updateFlagMutation.mutateAsync({ id: flagId, status });
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <ShieldAlert className="h-6 w-6 text-destructive" />
        <h1 className="text-2xl font-bold">Moderation — Flags</h1>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap" role="tablist">
        {STATUS_FILTERS.map(({ label, value }) => (
          <Button
            key={value}
            variant={statusFilter === value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(value)}
            role="tab"
            aria-selected={statusFilter === value}
            data-testid={`filter-${value}`}
          >
            {label}
          </Button>
        ))}
      </div>

      {flagsLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : !data || data.flags.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center" data-testid="no-flags">
          No {statusFilter} flags.
        </p>
      ) : (
        <div className="space-y-3">
          {data.flags.map((flag) => (
            <Card key={flag.id} data-testid="flag-card">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="text-sm font-medium">
                      <span className="text-muted-foreground">Reported by</span>{' '}
                      <Link href={`/user/${flag.reporter_nickname}`} className="hover:underline">
                        {flag.reporter_nickname}
                      </Link>
                      <span className="text-muted-foreground"> · {timeAgo(flag.created_at)}</span>
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs capitalize">
                        {flag.target_type}
                      </Badge>
                      <Badge variant="secondary" className="text-xs capitalize">
                        {flag.status}
                      </Badge>
                      {flag.target_type === 'listing' && (
                        <Link
                          href={`/listings/${flag.target_id}`}
                          className="text-xs text-primary hover:underline"
                          data-testid="flag-listing-link"
                        >
                          View listing →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{flag.reason}</p>
                {flag.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction(flag.id, 'dismissed')}
                      disabled={updateFlagMutation.isPending}
                      data-testid="dismiss-flag"
                    >
                      Dismiss
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction(flag.id, 'reviewed')}
                      disabled={updateFlagMutation.isPending}
                      data-testid="review-flag"
                    >
                      Mark reviewed
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleAction(flag.id, 'resolved')}
                      disabled={updateFlagMutation.isPending}
                      data-testid="resolve-flag"
                    >
                      Resolve
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Total: {data?.pagination.total ?? 0} flags
      </p>
    </div>
  );
}
