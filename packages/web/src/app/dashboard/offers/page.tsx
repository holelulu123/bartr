'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUp, ArrowDown, Plus, Trash2, Pause, Play } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useOffers, useUpdateOffer, useDeleteOffer } from '@/hooks/use-exchange';
import { usePrices } from '@/hooks/use-prices';
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

const CRYPTO_COLORS: Record<string, string> = {
  BTC: 'text-orange-500',
  ETH: 'text-indigo-400',
  SOL: 'text-fuchsia-500',
  XRP: 'text-slate-400',
  USDT: 'text-emerald-500',
  USDC: 'text-blue-400',
};

function fmt(val: number | string | null | undefined, decimals = 2): string {
  if (val === null || val === undefined) return '0';
  return Number(val).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

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
  const [pauseTarget, setPauseTarget] = useState<ExchangeOffer | null>(null);

  const { data, isLoading } = useOffers({
    user_id: user?.id,
    limit: 50,
  });

  const deleteMutation = useDeleteOffer();
  const pauseMutation = useUpdateOffer(pauseTarget?.id ?? '');

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

  async function handlePause() {
    if (!pauseTarget) return;
    const newStatus = pauseTarget.status === 'active' ? 'paused' : 'active';
    await pauseMutation.mutateAsync({ status: newStatus });
    setPauseTarget(null);
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
              onTogglePause={() => setPauseTarget(offer)}
            />
          ))}
        </div>
      )}

      {/* Pause/Resume confirmation dialog */}
      <Dialog open={!!pauseTarget} onOpenChange={(open) => !open && setPauseTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pauseTarget?.status === 'active' ? 'Pause offer?' : 'Resume offer?'}
            </DialogTitle>
            <DialogDescription>
              {pauseTarget?.status === 'active'
                ? `This will pause your ${pauseTarget?.offer_type} offer for ${pauseTarget?.crypto_currency}/${pauseTarget?.fiat_currency}. It will no longer be visible to other users.`
                : `This will resume your ${pauseTarget?.offer_type} offer for ${pauseTarget?.crypto_currency}/${pauseTarget?.fiat_currency}. It will become visible to other users again.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPauseTarget(null)}>
              Keep
            </Button>
            <Button
              variant="destructive"
              onClick={handlePause}
              disabled={pauseMutation.isPending}
            >
              {pauseMutation.isPending
                ? (pauseTarget?.status === 'active' ? 'Pausing…' : 'Resuming…')
                : (pauseTarget?.status === 'active' ? 'Pause' : 'Resume')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete offer?</DialogTitle>
            <DialogDescription>
              This will permanently remove your {deleteTarget?.offer_type} offer for {deleteTarget?.crypto_currency}/{deleteTarget?.fiat_currency}. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Keep
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

function OfferRow({
  offer,
  onDelete,
  onTogglePause,
}: {
  offer: ExchangeOffer;
  onDelete: () => void;
  onTogglePause: () => void;
}) {
  const isBuy = offer.offer_type === 'buy';
  const { data: priceData } = usePrices();

  // Compute effective price
  let coinPrice: number | undefined;
  if (priceData) {
    const cp = priceData[offer.crypto_currency];
    if (cp && typeof cp !== 'string') coinPrice = cp[offer.fiat_currency];
  }
  const effectivePrice = offer.rate_type === 'fixed'
    ? Number(offer.fixed_price) || undefined
    : coinPrice !== undefined
      ? coinPrice * (1 + (Number(offer.margin_percent) || 0) / 100)
      : undefined;

  const minFiat = Number(offer.min_amount) || 0;
  const maxFiat = Number(offer.max_amount) || 0;
  const minCrypto = effectivePrice ? minFiat / effectivePrice : undefined;
  const maxCrypto = effectivePrice ? maxFiat / effectivePrice : undefined;
  const isFixedAmount = minFiat === maxFiat && minFiat > 0;

  return (
    <div className={cn(
      'grid items-center gap-4 rounded-lg border px-4 py-3 border-l-[3px]',
      'grid-cols-[70px_1fr_160px_120px_80px]',
      'max-md:grid-cols-[60px_1fr_80px]',
      isBuy
        ? 'border-l-emerald-500 bg-emerald-500/[0.03] border-border'
        : 'border-l-red-400 bg-red-400/[0.03] border-border',
      offer.status === 'paused' && 'opacity-60',
    )}>
      {/* Type + pair */}
      <div className="space-y-1">
        <Badge variant={isBuy ? 'default' : 'secondary'} className="gap-1 text-sm px-2 py-0.5">
          {isBuy ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
          {isBuy ? 'Buy' : 'Sell'}
        </Badge>
        <Link href={`/exchange/${offer.id}`} className="block">
          <p className={cn('text-sm font-semibold hover:underline', CRYPTO_COLORS[offer.crypto_currency] ?? 'text-foreground')}>
            {offer.crypto_currency}/{offer.fiat_currency}
          </p>
        </Link>
      </div>

      {/* Amount + crypto equivalent + status + settlement */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[15px] font-bold leading-tight">
            {isFixedAmount
              ? `${fmt(minFiat)} ${offer.fiat_currency}`
              : offer.min_amount || offer.max_amount
                ? `${fmt(minFiat)} – ${fmt(maxFiat)} ${offer.fiat_currency}`
                : 'Any amount'}
          </p>
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-2 py-0 text-[11px] font-medium capitalize',
              STATUS_COLORS[offer.status],
            )}
          >
            {offer.status}
          </span>
        </div>
        {effectivePrice !== undefined && (offer.min_amount || offer.max_amount) && (
          <p className="text-xs text-muted-foreground leading-tight mt-0.5">
            {isFixedAmount
              ? `${fmt(minCrypto!, 6)} ${offer.crypto_currency}`
              : `${fmt(minCrypto!, 6)} – ${fmt(maxCrypto!, 6)} ${offer.crypto_currency}`}
          </p>
        )}
      </div>

      {/* Price + margin */}
      <div className="hidden md:block">
        <p className="text-[15px] font-bold leading-tight whitespace-nowrap">
          {effectivePrice !== undefined
            ? `${fmt(effectivePrice)} ${offer.fiat_currency}`
            : '--'}
        </p>
        {offer.rate_type === 'market' && (
          <span className="mt-0.5 inline-block rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0 text-xs font-medium whitespace-nowrap">
            {Number(offer.margin_percent) > 0 ? '+' : ''}{offer.margin_percent}%
          </span>
        )}
        {offer.rate_type === 'fixed' && (
          <span className="text-xs text-muted-foreground">Fixed price</span>
        )}
      </div>

      {/* Settlement methods */}
      <div className="hidden md:flex flex-wrap gap-1 overflow-hidden">
        {offer.payment_methods.slice(0, 2).map((pm) => (
          <Badge key={pm} variant="outline" className="text-xs px-1.5 py-0">
            {SETTLEMENT_METHOD_LABELS[pm as SettlementMethod] ?? pm}
          </Badge>
        ))}
        {offer.payment_methods.length > 2 && (
          <Badge variant="outline" className="text-xs px-1.5 py-0">
            +{offer.payment_methods.length - 2}
          </Badge>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 justify-end">
        {offer.status !== 'removed' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onTogglePause}
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
          aria-label="Delete offer"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
