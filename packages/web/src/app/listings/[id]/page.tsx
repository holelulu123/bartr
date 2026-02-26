'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Clock, Edit, MessageSquare, Trash2 } from 'lucide-react';
import { useListing, useDeleteListing } from '@/hooks/use-listings';
import { useAuth } from '@/contexts/auth-context';
import { useCreateOffer } from '@/hooks/use-trades';
import { useCreateThread } from '@/hooks/use-messages';
import { ReputationBadge } from '@/components/reputation-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { ListingDetail } from '@/lib/api';

const PAYMENT_LABELS: Record<string, string> = {
  btc: 'BTC',
  xmr: 'XMR',
  eth: 'ETH',
  cash: 'Cash',
  bank: 'Bank Transfer',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// ── Image Gallery ──────────────────────────────────────────────────────────

function ImageGallery({ listing }: { listing: ListingDetail }) {
  const [activeIdx, setActiveIdx] = useState(0);

  if (!listing.images || listing.images.length === 0) {
    return (
      <div className="aspect-[4/3] rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
        No images
      </div>
    );
  }

  // Use storage_key as image src (served via API or CDN in production)
  const activeImage = listing.images[activeIdx];

  return (
    <div className="space-y-2">
      <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-muted">
        <Image
          src={`/api/images/${activeImage.storage_key}`}
          alt={listing.title}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
          priority
        />
      </div>
      {listing.images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {listing.images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setActiveIdx(i)}
              className={cn(
                'relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors',
                i === activeIdx ? 'border-primary' : 'border-transparent',
              )}
              aria-label={`Image ${i + 1}`}
            >
              <Image
                src={`/api/images/${img.storage_key}`}
                alt={`${listing.title} ${i + 1}`}
                fill
                className="object-cover"
                sizes="64px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function ListingDetailSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6" aria-label="Loading listing">
      <div className="h-5 w-24 bg-muted animate-pulse rounded" />
      <div className="grid md:grid-cols-[1fr_320px] gap-8">
        <div className="space-y-4">
          <div className="aspect-[4/3] rounded-xl bg-muted animate-pulse" />
          <div className="h-6 w-3/4 bg-muted animate-pulse rounded" />
          <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
          <div className="space-y-2">
            <div className="h-4 bg-muted animate-pulse rounded" />
            <div className="h-4 bg-muted animate-pulse rounded" />
            <div className="h-4 w-2/3 bg-muted animate-pulse rounded" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-border p-4 space-y-3">
            <div className="h-5 w-24 bg-muted animate-pulse rounded" />
            <div className="h-4 w-32 bg-muted animate-pulse rounded" />
            <div className="h-9 bg-muted animate-pulse rounded" />
            <div className="h-9 bg-muted animate-pulse rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const { data: listing, isLoading, isError } = useListing(id);
  const deleteMutation = useDeleteListing();
  const createOfferMutation = useCreateOffer();
  const createThreadMutation = useCreateThread();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const isOwner = !!(user && listing && user.nickname === listing.seller_nickname);

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleDelete() {
    await deleteMutation.mutateAsync(id);
    setDeleteDialogOpen(false);
    router.push('/listings');
  }

  async function handleMakeOffer() {
    const trade = await createOfferMutation.mutateAsync(id);
    router.push(`/trades/${trade.id}`);
  }

  async function handleMessageSeller() {
    const thread = await createThreadMutation.mutateAsync({
      recipient_nickname: listing!.seller_nickname,
      listing_id: id,
    });
    router.push(`/messages/${thread.id}`);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) return <ListingDetailSkeleton />;

  if (isError || !listing) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center space-y-2">
        <p className="text-lg font-medium">Listing not found</p>
        <p className="text-sm text-muted-foreground">
          This listing may have been removed or doesn&apos;t exist.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/listings">Browse listings</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Back navigation */}
      <Link
        href="/listings"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to listings
      </Link>

      <div className="grid md:grid-cols-[1fr_320px] gap-8">
        {/* ── Left: images + details ── */}
        <div className="space-y-6">
          <ImageGallery listing={listing} />

          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold">{listing.title}</h1>
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Posted {timeAgo(listing.created_at)}</span>
                {listing.status !== 'active' && (
                  <Badge variant="outline" className="capitalize">
                    {listing.status}
                  </Badge>
                )}
              </div>
            </div>

            {/* Price */}
            {listing.price_indication && (
              <div>
                <p className="text-sm text-muted-foreground uppercase tracking-wide text-xs font-medium mb-1">
                  Price
                </p>
                <p className="text-2xl font-semibold text-primary">
                  {listing.price_indication}
                  {listing.currency && (
                    <span className="text-base font-normal text-muted-foreground ml-1.5">
                      {listing.currency}
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Category */}
            {listing.category_name && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Category
                </p>
                <Badge variant="secondary">{listing.category_name}</Badge>
              </div>
            )}

            {/* Payment methods */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Accepted payments
              </p>
              <div className="flex flex-wrap gap-2">
                {listing.payment_methods.map((method) => (
                  <Badge key={method} variant="outline">
                    {PAYMENT_LABELS[method] ?? method}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Description
              </p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{listing.description}</p>
            </div>
          </div>
        </div>

        {/* ── Right: seller card + actions ── */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            {/* Seller info */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Seller
              </p>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium shrink-0">
                  {listing.seller_nickname.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <Link
                    href={`/user/${listing.seller_nickname}`}
                    className="font-medium text-sm hover:underline truncate block"
                  >
                    {listing.seller_nickname}
                  </Link>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2 border-t border-border">
              {isOwner ? (
                <>
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/listings/${id}/edit`}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit listing
                    </Link>
                  </Button>
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete listing
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    className="w-full"
                    onClick={handleMakeOffer}
                    disabled={createOfferMutation.isPending || listing.status !== 'active'}
                  >
                    {createOfferMutation.isPending ? 'Creating offer…' : 'Make Offer'}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleMessageSeller}
                    disabled={createThreadMutation.isPending}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    {createThreadMutation.isPending ? 'Opening…' : 'Message Seller'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Delete confirmation dialog ── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete listing?</DialogTitle>
            <DialogDescription>
              This will permanently delete &ldquo;{listing.title}&rdquo;. This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
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
