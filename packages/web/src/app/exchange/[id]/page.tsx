'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowUp, ArrowDown, MessageSquare, Star, Pause, Play, Trash2 } from 'lucide-react';
import { useOffer, useUpdateOffer, useDeleteOffer } from '@/hooks/use-exchange';
import { useUser } from '@/hooks/use-users';
import { useAuth } from '@/contexts/auth-context';
import { usePrices } from '@/hooks/use-prices';
import { PriceTicker } from '@/components/price-ticker';
import { CoinIcon } from '@/components/crypto-icons';
import { ReputationBadge } from '@/components/reputation-badge';
import { getCountryFlag, getCountryName } from '@/lib/countries';
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
import { SETTLEMENT_METHOD_LABELS } from '@bartr/shared';
import type { SettlementMethod } from '@bartr/shared';

function fmt(val: number | string | null | undefined, decimals = 2): string {
  if (val === null || val === undefined) return '0';
  return Number(val).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Deterministic identicon — compact version for inline use */
function MiniIdenticon({ seed, size = 32 }: { seed: string; size?: number }) {
  const cells = 5;
  const cellSize = size / cells;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = Math.imul(31, hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const h = ((hash >>> 0) * 2654435761) >>> 0;
  const hue1 = h % 360;
  const hue2 = (hue1 + 150) % 360;
  const fg = `hsl(${hue1},65%,55%)`;
  const bg = `hsl(${hue2},30%,18%)`;

  const grid: boolean[][] = Array.from({ length: cells }, (_, r) =>
    Array.from({ length: cells }, (_, c) => {
      const col = c < Math.ceil(cells / 2) ? c : cells - 1 - c;
      return ((h >>> (r * Math.ceil(cells / 2) + col)) & 1) === 1;
    }),
  );

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ borderRadius: '50%' }}>
      <rect width={size} height={size} fill={bg} />
      {grid.map((row, r) =>
        row.map((on, c) =>
          on ? <rect key={`${r}-${c}`} x={c * cellSize} y={r * cellSize} width={cellSize} height={cellSize} fill={fg} /> : null,
        ),
      )}
    </svg>
  );
}

function OfferDetailSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6" aria-label="Loading">
      <div className="h-5 w-32 bg-muted animate-pulse rounded" />
      <div className="h-8 w-64 bg-muted animate-pulse rounded" />
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function OfferDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  const { data: offer, isLoading, isError } = useOffer(id);
  const { data: sellerProfile } = useUser(offer?.seller_nickname ?? '');
  const { data: priceData } = usePrices();
  const updateMutation = useUpdateOffer(id);
  const deleteMutation = useDeleteOffer();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPauseDialog, setShowPauseDialog] = useState(false);

  if (isLoading) return <OfferDetailSkeleton />;

  if (isError || !offer) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-3">
        <p className="text-lg font-medium">Offer not found</p>
        <Button asChild variant="outline">
          <Link href="/exchange">Back to exchange</Link>
        </Button>
      </div>
    );
  }

  const isBuy = offer.offer_type === 'buy';
  const isOwner = user?.id === offer.user_id;
  const stars = sellerProfile ? Math.round(sellerProfile.reputation.rating_avg) : 0;

  // Compute effective price for crypto equivalent display
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
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header — nickname + pair + reputation */}
      <div>
        <Link
          href="/exchange"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to exchange
        </Link>

        <div className="flex items-center gap-3">
          <Badge variant={isBuy ? 'default' : 'secondary'} className="gap-1 text-[13px]">
            {isBuy ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
            {isBuy ? 'Buying' : 'Selling'}
          </Badge>
          <span className="inline-flex items-center gap-2">
            <CoinIcon symbol={offer.crypto_currency} className="h-6 w-6" />
            <h1 className="text-2xl font-bold">
              {offer.crypto_currency}/{offer.fiat_currency}
            </h1>
          </span>
        </div>

        {/* Seller info inline with header */}
        <div className="flex items-center gap-2.5 mt-3">
          <Link href={`/user/${offer.seller_nickname}`} className="shrink-0">
            <MiniIdenticon seed={offer.seller_nickname} size={36} />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link
                href={`/user/${offer.seller_nickname}`}
                className="text-[15px] font-medium hover:underline truncate"
              >
                {offer.seller_nickname}
              </Link>
              {sellerProfile && <ReputationBadge tier={sellerProfile.reputation.tier} />}
            </div>
            {sellerProfile && (
              <div className="flex items-center gap-0.5" aria-label={`Rating: ${sellerProfile.reputation.rating_avg.toFixed(1)} out of 5`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={cn('h-3.5 w-3.5', n <= stars ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/40')}
                  />
                ))}
                <span className="text-xs text-muted-foreground ml-1">
                  {sellerProfile.reputation.rating_avg.toFixed(1)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Offer details card */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        {/* Trade amount + Price — side by side on desktop */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-6">
          {/* Trade amount — shown first and prominent */}
          {(offer.min_amount || offer.max_amount) && (
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1">Trade amount</p>
              <p className="text-3xl font-bold">
                {isFixedAmount
                  ? `${fmt(minFiat)} ${offer.fiat_currency}`
                  : `${offer.min_amount ? fmt(minFiat) : '0'} – ${offer.max_amount ? fmt(maxFiat) : '∞'} ${offer.fiat_currency}`}
              </p>
              {effectivePrice !== undefined && (
                <p className="text-sm text-muted-foreground mt-1">
                  {isFixedAmount
                    ? `${fmt(minCrypto!, 6)} ${offer.crypto_currency}`
                    : `${fmt(minCrypto!, 6)} – ${fmt(maxCrypto!, 6)} ${offer.crypto_currency}`}
                </p>
              )}
              {isFixedAmount && (
                <p className="text-xs text-muted-foreground mt-0.5">Fixed amount</p>
              )}
            </div>
          )}

          {/* Price per coin + margin */}
          <div className="sm:text-right">
            <p className="text-sm text-muted-foreground mb-1">Price per {offer.crypto_currency}</p>
            <p className="text-2xl font-bold">
              {effectivePrice !== undefined
                ? `${fmt(effectivePrice)} ${offer.fiat_currency}`
                : '--'}
            </p>
            {offer.rate_type === 'market' && (
              <div className="mt-1.5">
                <span className="inline-block rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 text-sm font-medium">
                  {Number(offer.margin_percent) > 0 ? '+' : ''}{offer.margin_percent}% margin
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  {isBuy ? 'Buyer' : 'Seller'} seeks {Number(offer.margin_percent) === 0 ? 'market price' : `${Math.abs(Number(offer.margin_percent))}% ${Number(offer.margin_percent) > 0 ? 'above' : 'below'} market price`} ({offer.price_source})
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Settlement methods */}
        <div>
          <p className="text-sm text-muted-foreground mb-1.5">Settlement methods</p>
          <div className="flex flex-wrap gap-2">
            {offer.payment_methods.map((pm) => (
              <Badge key={pm} variant="outline" className="text-[13px] px-2.5 py-0.5">
                {SETTLEMENT_METHOD_LABELS[pm as SettlementMethod] ?? pm}
              </Badge>
            ))}
          </div>
        </div>

        {/* Country */}
        {offer.country_code && (
          <div>
            <p className="text-sm text-muted-foreground mb-1">Location</p>
            <p className="font-medium">
              {getCountryFlag(offer.country_code)} {getCountryName(offer.country_code)}
            </p>
          </div>
        )}

        {/* Terms */}
        {offer.terms && (
          <div>
            <p className="text-sm text-muted-foreground mb-1">Trade terms</p>
            <p className="text-[13px] whitespace-pre-wrap">{offer.terms}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      {isAuthenticated && !isOwner && (
        <div className="flex gap-3">
          <Button asChild className="flex-1">
            <Link href={`/messages?contact=${offer.seller_nickname}`}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat
            </Link>
          </Button>
        </div>
      )}

      {isOwner && (
        <div className="flex gap-3">
          {offer.status !== 'removed' && (
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowPauseDialog(true)}
            >
              {offer.status === 'active' ? (
                <><Pause className="h-4 w-4 mr-2" />Pause offer</>
              ) : (
                <><Play className="h-4 w-4 mr-2" />Resume offer</>
              )}
            </Button>
          )}
          <Button
            variant="destructive"
            className="flex-1"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete offer
          </Button>
        </div>
      )}

      {/* Pause/Resume confirmation dialog */}
      <Dialog open={showPauseDialog} onOpenChange={setShowPauseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {offer.status === 'active' ? 'Pause offer?' : 'Resume offer?'}
            </DialogTitle>
            <DialogDescription>
              {offer.status === 'active'
                ? `This will pause your ${offer.offer_type} offer for ${offer.crypto_currency}/${offer.fiat_currency}. It will no longer be visible to other users.`
                : `This will resume your ${offer.offer_type} offer for ${offer.crypto_currency}/${offer.fiat_currency}. It will become visible to other users again.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPauseDialog(false)}>
              Cancel
            </Button>
            <Button
              variant={offer.status === 'active' ? 'destructive' : 'default'}
              disabled={updateMutation.isPending}
              onClick={async () => {
                const newStatus = offer.status === 'active' ? 'paused' : 'active';
                await updateMutation.mutateAsync({ status: newStatus });
                setShowPauseDialog(false);
              }}
            >
              {updateMutation.isPending
                ? (offer.status === 'active' ? 'Pausing…' : 'Resuming…')
                : (offer.status === 'active' ? 'Pause' : 'Resume')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete offer?</DialogTitle>
            <DialogDescription>
              This will permanently remove your {offer.offer_type} offer for {offer.crypto_currency}/{offer.fiat_currency}. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={async () => {
                await deleteMutation.mutateAsync(offer.id);
                setShowDeleteDialog(false);
                router.push('/exchange');
              }}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
