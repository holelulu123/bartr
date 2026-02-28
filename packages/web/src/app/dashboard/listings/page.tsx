'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Edit, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useListings, useDeleteListing, useUpdateListing } from '@/hooks/use-listings';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { ListingSummary } from '@/lib/api';
import type { ListingStatus } from '@bartr/shared';

type StatusFilter = 'all' | ListingStatus;

const TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'sold', label: 'Sold' },
];

const STATUS_COLORS: Record<ListingStatus, string> = {
  active: 'bg-green-500/15 text-green-400 border-green-500/30',
  paused: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  sold: 'bg-neutral-500/15 text-neutral-400 border-neutral-500/30',
};

export default function MyListingsDashboard() {
  const { user } = useAuth();
  const router = useRouter();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [deleteTarget, setDeleteTarget] = useState<ListingSummary | null>(null);

  const { data, isLoading } = useListings({
    user_id: user?.id,
    ...(statusFilter !== 'all' && { status: statusFilter }),
    limit: 50,
  });

  const deleteMutation = useDeleteListing();

  const listings = data?.listings ?? [];

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Listings</h1>
          {!isLoading && (
            <p className="text-sm text-muted-foreground mt-1">
              {listings.length} {listings.length === 1 ? 'listing' : 'listings'}
              {statusFilter !== 'all' && ` · ${statusFilter}`}
            </p>
          )}
        </div>
        <Button asChild>
          <Link href="/listings/new">
            <Plus className="h-4 w-4 mr-2" />
            New listing
          </Link>
        </Button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              statusFilter === tab.value
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
            aria-selected={statusFilter === tab.value}
            role="tab"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="py-20 text-center space-y-3">
          <p className="text-lg font-medium">No listings found</p>
          {statusFilter !== 'all' ? (
            <p className="text-sm text-muted-foreground">
              No {statusFilter} listings.{' '}
              <button
                className="underline text-primary hover:no-underline"
                onClick={() => setStatusFilter('all')}
              >
                View all
              </button>
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                You haven&apos;t posted any listings yet.
              </p>
              <Button asChild>
                <Link href="/listings/new">Post your first listing</Link>
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {listings.map((listing) => (
            <ListingRow
              key={listing.id}
              listing={listing}
              onDelete={() => setDeleteTarget(listing)}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete listing?</DialogTitle>
            <DialogDescription>
              This will permanently delete &ldquo;{deleteTarget?.title}&rdquo;. This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Listing row ────────────────────────────────────────────────────────────

function ListingRow({
  listing,
  onDelete,
}: {
  listing: ListingSummary;
  onDelete: () => void;
}) {
  const updateMutation = useUpdateListing(listing.id);

  async function handleMarkSold() {
    await updateMutation.mutateAsync({ status: 'sold' });
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
      {/* Thumbnail */}
      <div className="h-12 w-12 shrink-0 rounded-md bg-muted overflow-hidden">
        {listing.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.thumbnail}
            alt={listing.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
            —
          </div>
        )}
      </div>

      {/* Title + status */}
      <div className="flex-1 min-w-0">
        <Link
          href={`/listings/${listing.id}`}
          className="text-sm font-medium hover:underline truncate block"
        >
          {listing.title}
        </Link>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-2 py-0 text-xs font-medium capitalize',
              STATUS_COLORS[listing.status],
            )}
          >
            {listing.status}
          </span>
          {listing.price_indication && (
            <span className="text-xs text-muted-foreground">
              {listing.price_indication}
              {listing.currency && ` ${listing.currency}`}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {listing.status !== 'sold' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkSold}
            disabled={updateMutation.isPending}
            className="text-xs h-8"
            aria-label={`Mark ${listing.title} as sold`}
          >
            Mark sold
          </Button>
        )}
        {listing.status !== 'sold' && (
          <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0">
            <Link href={`/listings/${listing.id}/edit`} aria-label={`Edit ${listing.title}`}>
              <Edit className="h-4 w-4" />
            </Link>
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
          aria-label={`Delete ${listing.title}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
