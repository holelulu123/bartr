'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUp, ArrowDown, Edit, Plus, Trash2, Pause, Play } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useOffers, useUpdateOffer, useDeleteOffer } from '@/hooks/use-exchange';
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
import type { ExchangeOffer } from '@/lib/api';
import { SETTLEMENT_METHOD_LABELS } from '@bartr/shared';
import type { OfferStatus, SettlementMethod } from '@bartr/shared';

type StatusFilter = 'all' | OfferStatus;

const TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
];

const STATUS_COLORS: Record<OfferStatus, string> = {
  active: 'bg-green-500/15 text-green-400 border-green-500/30',
  paused: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  removed: 'bg-neutral-500/15 text-neutral-400 border-neutral-500/30',
};

export default function MyOffersDashboard() {
  const { user } = useAuth();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [deleteTarget, setDeleteTarget] = useState<ExchangeOffer | null>(null);

  const { data, isLoading } = useOffers({
    user_id: user?.id,
    limit: 50,
  });

  const deleteMutation = useDeleteOffer();

  // Client-side status filter (API filters by active status only for public browse)
  const allOffers = data?.offers ?? [];
  const offers = statusFilter === 'all'
    ? allOffers
    : allOffers.filter((o) => o.status === statusFilter);

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Offers</h1>
          {!isLoading && (
            <p className="text-sm text-muted-foreground mt-1">
              {offers.length} {offers.length === 1 ? 'offer' : 'offers'}
              {statusFilter !== 'all' && ` · ${statusFilter}`}
            </p>
          )}
        </div>
        <Button asChild>
          <Link href="/exchange/new">
            <Plus className="h-4 w-4 mr-2" />
            New offer
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
      ) : offers.length === 0 ? (
        <div className="py-20 text-center space-y-3">
          <p className="text-lg font-medium">No offers found</p>
          {statusFilter !== 'all' ? (
            <p className="text-sm text-muted-foreground">
              No {statusFilter} offers.{' '}
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
                You haven&apos;t created any exchange offers yet.
              </p>
              <Button asChild>
                <Link href="/exchange/new">Create your first offer</Link>
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {offers.map((offer) => (
            <OfferRow
              key={offer.id}
              offer={offer}
              onDelete={() => setDeleteTarget(offer)}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove offer?</DialogTitle>
            <DialogDescription>
              This will remove your {deleteTarget?.offer_type} offer for {deleteTarget?.crypto_currency}/{deleteTarget?.fiat_currency}.
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
              {deleteMutation.isPending ? 'Removing…' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OfferRow({
  offer,
  onDelete,
}: {
  offer: ExchangeOffer;
  onDelete: () => void;
}) {
  const updateMutation = useUpdateOffer(offer.id);
  const isBuy = offer.offer_type === 'buy';

  async function handleTogglePause() {
    const newStatus = offer.status === 'active' ? 'paused' : 'active';
    await updateMutation.mutateAsync({ status: newStatus });
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
      {/* Type badge */}
      <Badge variant={isBuy ? 'default' : 'secondary'} className="gap-1 shrink-0">
        {isBuy ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
        {isBuy ? 'Buy' : 'Sell'}
      </Badge>

      {/* Pair + status */}
      <div className="flex-1 min-w-0">
        <Link
          href={`/exchange/${offer.id}`}
          className="text-sm font-medium hover:underline"
        >
          {offer.crypto_currency}/{offer.fiat_currency}
        </Link>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-2 py-0 text-xs font-medium capitalize',
              STATUS_COLORS[offer.status],
            )}
          >
            {offer.status}
          </span>
          <span className="text-xs text-muted-foreground">
            {offer.rate_type === 'fixed'
              ? `${offer.fixed_price} ${offer.fiat_currency}`
              : `Market ${offer.margin_percent > 0 ? '+' : ''}${offer.margin_percent}%`}
          </span>
        </div>
      </div>

      {/* Settlement methods (compact) */}
      <div className="hidden sm:flex gap-1 shrink-0">
        {offer.payment_methods.slice(0, 2).map((pm) => (
          <Badge key={pm} variant="outline" className="text-xs px-1.5 py-0">
            {SETTLEMENT_METHOD_LABELS[pm as SettlementMethod] ?? pm}
          </Badge>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {offer.status !== 'removed' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleTogglePause}
            disabled={updateMutation.isPending}
            className="h-8 w-8 p-0"
            aria-label={offer.status === 'active' ? 'Pause offer' : 'Resume offer'}
          >
            {offer.status === 'active' ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
          aria-label="Remove offer"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
