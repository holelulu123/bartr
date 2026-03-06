'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Star, Calendar, Clock, Package, ArrowUpDown, ArrowUp, ArrowDown, Lock, Trash2, Pause, Play } from 'lucide-react';
import { useUser, useUserRatings } from '@/hooks/use-users';
import { useListings } from '@/hooks/use-listings';
import { useOffers, useDeleteOffer, useUpdateOffer } from '@/hooks/use-exchange';
import { usePrices } from '@/hooks/use-prices';
import { useAuth } from '@/contexts/auth-context';
import { ReputationBadge } from '@/components/reputation-badge';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SETTLEMENT_METHOD_LABELS } from '@bartr/shared';
import type { SettlementMethod } from '@bartr/shared';
import type { ExchangeOffer } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

// Coloured identicon — deterministic geometric pattern from nickname string.
// Pure SVG, no external dependencies, no network requests.
function Identicon({ seed, size = 80 }: { seed: string; size?: number }) {
  const cells = 5;
  const cellSize = size / cells;

  if (!seed) return null;

  // Generate a numeric hash from the seed string
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = Math.imul(31, hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const h = ((hash >>> 0) * 2654435761) >>> 0;

  // Pick two colours from the hash
  const hue1 = (h % 360);
  const hue2 = (hue1 + 150) % 360;
  const fg = `hsl(${hue1},65%,55%)`;
  const bg = `hsl(${hue2},30%,18%)`;

  // Build symmetric 5×5 grid — only left half + centre is random, right mirrors left
  const grid: boolean[][] = Array.from({ length: cells }, (_, r) =>
    Array.from({ length: cells }, (_, c) => {
      const col = c < Math.ceil(cells / 2) ? c : cells - 1 - c;
      const bit = (h >>> (r * Math.ceil(cells / 2) + col)) & 1;
      return bit === 1;
    }),
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ borderRadius: '50%' }}
    >
      <rect width={size} height={size} fill={bg} />
      {grid.map((row, r) =>
        row.map((on, c) =>
          on ? (
            <rect
              key={`${r}-${c}`}
              x={c * cellSize}
              y={r * cellSize}
              width={cellSize}
              height={cellSize}
              fill={fg}
            />
          ) : null,
        ),
      )}
    </svg>
  );
}

// Active status — green dot if active within 5 minutes, else "X ago"
function ActiveStatus({ lastActive }: { lastActive: string }) {
  const diffMs = Date.now() - new Date(lastActive).getTime();
  const isOnline = diffMs < 5 * 60_000;

  if (isOnline) {
    return (
      <span className="flex items-center gap-1 text-xs text-green-500">
        <span className="h-2 w-2 rounded-full bg-green-500 inline-block" aria-hidden="true" />
        Active now
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Clock className="h-3 w-3" />
      Active {timeAgo(lastActive)}
    </span>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

const PAYMENT_LABELS: Record<string, string> = {
  btc: 'BTC', eth: 'ETH', usdt: 'USDT', usdc: 'USDC', cash: 'Cash', bank_transfer: 'Bank',
};

const CRYPTO_COLORS: Record<string, string> = {
  BTC: 'text-orange-500',
  ETH: 'text-indigo-400',
  SOL: 'text-fuchsia-500',
  XRP: 'text-slate-400',
  USDT: 'text-emerald-500',
  USDC: 'text-blue-400',
};

function fmtNum(val: number | string | null | undefined, decimals = 2): string {
  if (val === null || val === undefined) return '0';
  const n = Number(val);
  const formatted = n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  if (decimals <= 2) return formatted.replace(/\.00$/, '');
  return formatted;
}

function CompactOfferRow({ offer }: { offer: ExchangeOffer }) {
  const isBuy = offer.offer_type === 'buy';
  const isPrivate = !!offer.accepted_trade_status;
  const { user } = useAuth();
  const { data: priceData } = usePrices();
  const deleteMutation = useDeleteOffer();
  const updateMutation = useUpdateOffer(offer.id);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const isOwn = user?.nickname === offer.seller_nickname;

  let coinPrice: number | undefined;
  if (priceData) {
    const cryptoPrices = priceData[offer.crypto_currency];
    if (cryptoPrices && typeof cryptoPrices !== 'string') {
      coinPrice = cryptoPrices[offer.fiat_currency];
    }
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
  const isFixed = minFiat === maxFiat && minFiat > 0;

  return (
    <Link
      href={`/exchange/${offer.id}`}
      className={cn(
        'grid items-center gap-3 rounded-lg border px-4 py-3 border-l-[3px] transition-colors hover:bg-accent/50',
        'grid-cols-[80px_1fr_160px_120px_60px]',
        isPrivate
          ? 'border-l-purple-500 bg-purple-500/[0.04] border-purple-500/20'
          : isBuy
            ? 'border-l-emerald-500 bg-emerald-500/[0.03] border-border'
            : 'border-l-red-400 bg-red-400/[0.03] border-border',
      )}
    >
      {/* Type + pair stacked */}
      <div className="flex flex-col items-start gap-1">
        {isPrivate ? (
          <Badge variant="outline" className="gap-1 text-xs px-1.5 py-0 border-purple-500/40 text-purple-400 bg-purple-500/10">
            <Lock className="h-3 w-3" />
            Contract
          </Badge>
        ) : (
          <Badge variant={isBuy ? 'default' : 'secondary'} className="gap-1 text-xs px-1.5 py-0.5">
            {isBuy ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
            {isBuy ? 'Buy' : 'Sell'}
          </Badge>
        )}
        <span className={cn('text-sm font-semibold whitespace-nowrap', CRYPTO_COLORS[offer.crypto_currency] ?? 'text-foreground')}>
          {offer.crypto_currency}/{offer.fiat_currency}
        </span>
      </div>

      {/* Limits: fiat + crypto equiv */}
      <div className="min-w-0">
        <p className="text-base font-bold leading-tight whitespace-nowrap">
          {isFixed
            ? `${fmtNum(minFiat)} ${offer.fiat_currency}`
            : minFiat || maxFiat
              ? `${fmtNum(minFiat)} – ${fmtNum(maxFiat)} ${offer.fiat_currency}`
              : 'Any amount'}
        </p>
        {effectivePrice !== undefined && (minFiat || maxFiat) && (
          <p className="text-xs text-muted-foreground leading-tight mt-0.5 whitespace-nowrap">
            {isFixed
              ? `${fmtNum(minCrypto!, 6)} ${offer.crypto_currency}`
              : `${fmtNum(minCrypto!, 6)} – ${fmtNum(maxCrypto!, 6)} ${offer.crypto_currency}`}
          </p>
        )}
      </div>

      {/* Price + source + margin */}
      <div>
        <p className="text-base font-bold leading-tight whitespace-nowrap">
          {effectivePrice !== undefined ? `${fmtNum(effectivePrice)} ${offer.fiat_currency}` : '--'}
        </p>
        {offer.rate_type === 'market' && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-muted-foreground capitalize">{offer.price_source}</span>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0 text-xs font-bold cursor-help whitespace-nowrap" onClick={(e) => e.preventDefault()}>
                    {Number(offer.margin_percent) > 0 ? '+' : ''}{offer.margin_percent}%
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {Number(offer.margin_percent) === 0 ? 'Market price' : `${Math.abs(Number(offer.margin_percent))}% ${Number(offer.margin_percent) > 0 ? 'above' : 'below'} market`}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
        {offer.rate_type === 'fixed' && coinPrice !== undefined && effectivePrice !== undefined && (
          (() => {
            const pct = ((effectivePrice / coinPrice - 1) * 100);
            const sign = pct >= 0 ? '+' : '';
            return (
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs text-muted-foreground">Fixed</span>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className={cn(
                        'rounded px-1.5 py-0 text-xs font-bold cursor-help whitespace-nowrap',
                        pct >= 0 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/15 text-red-600 dark:text-red-400',
                      )} onClick={(e) => e.preventDefault()}>
                        {sign}{pct.toFixed(1)}%
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      Fixed price is {Math.abs(pct).toFixed(1)}% {pct >= 0 ? 'above' : 'below'} market
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            );
          })()
        )}
      </div>

      {/* Settlement methods */}
      <div className="flex flex-wrap gap-1 overflow-hidden">
        {offer.payment_methods.slice(0, 2).map((pm) => (
          <span key={pm} className="text-xs text-muted-foreground whitespace-nowrap">
            {SETTLEMENT_METHOD_LABELS[pm as SettlementMethod] ?? pm}
          </span>
        ))}
        {offer.payment_methods.length > 2 && (
          <span className="text-xs text-muted-foreground">+{offer.payment_methods.length - 2}</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {isOwn && !isPrivate && offer.status !== 'removed' && (
          <Button
            size="sm"
            variant="ghost"
            className="px-2"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowPauseDialog(true); }}
            aria-label={offer.status === 'active' ? 'Pause offer' : 'Resume offer'}
          >
            {offer.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
        )}
        {isOwn && (
          <Button
            size="sm"
            variant="ghost"
            className="px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDeleteDialog(true); }}
            aria-label="Delete offer"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Delete dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Delete offer?</DialogTitle>
            <DialogDescription>
              This will permanently remove your {offer.offer_type} offer for {offer.crypto_currency}/{offer.fiat_currency}. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={async () => { await deleteMutation.mutateAsync(offer.id); setShowDeleteDialog(false); }}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pause/Resume dialog */}
      <Dialog open={showPauseDialog} onOpenChange={setShowPauseDialog}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>{offer.status === 'active' ? 'Pause offer?' : 'Resume offer?'}</DialogTitle>
            <DialogDescription>
              {offer.status === 'active'
                ? `This will pause your ${offer.offer_type} offer for ${offer.crypto_currency}/${offer.fiat_currency}.`
                : `This will resume your ${offer.offer_type} offer for ${offer.crypto_currency}/${offer.fiat_currency}.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPauseDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={updateMutation.isPending}
              onClick={async () => { await updateMutation.mutateAsync({ status: offer.status === 'active' ? 'paused' : 'active' }); setShowPauseDialog(false); }}
            >
              {updateMutation.isPending ? (offer.status === 'active' ? 'Pausing…' : 'Resuming…') : (offer.status === 'active' ? 'Pause' : 'Resume')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Link>
  );
}

export default function UserProfilePage() {
  const { nickname } = useParams<{ nickname: string }>();
  const { user: me } = useAuth();
  const { data: profile, isLoading, isError } = useUser(nickname);
  const { data: ratingsData } = useUserRatings(nickname);
  const { data: listingsData } = useListings(
    profile?.id ? { user_id: profile.id, status: 'active', limit: 6 } : {},
  );
  const { data: offersData } = useOffers(
    profile?.id ? { user_id: profile.id, limit: 6 } : {},
  );

  const isOwnProfile = me?.nickname === nickname;

  // Filter offers: only those created by this user, hide private contracts from unauthorized viewers
  const visibleOffers = (offersData?.offers ?? []).filter((offer) => {
    // Only show offers created by this profile user
    if (offer.user_id !== profile?.id) return false;
    // Private contracts (in-progress): only visible to owner or accepted buyer
    if (offer.accepted_trade_status) {
      return isOwnProfile || me?.nickname === offer.accepted_buyer_nickname;
    }
    return true;
  });

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-16 text-center">
        <p className="text-muted-foreground text-lg">User not found.</p>
        <Link href="/listings" className="mt-4 inline-block text-sm text-primary hover:underline">
          Browse listings
        </Link>
      </div>
    );
  }

  const stars = Math.round(profile.reputation.rating_avg);

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">

      {/* Profile header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start">
            <Identicon seed={profile.nickname} size={80} />

            <div className="flex-1 text-center sm:text-left space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <h1 className="text-2xl font-bold">{profile.nickname}</h1>
                <ReputationBadge tier={profile.reputation.tier} />
              </div>

              {/* Star rating */}
              <div className="flex items-center justify-center sm:justify-start gap-1" aria-label={`Rating: ${profile.reputation.rating_avg.toFixed(1)} out of 5`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={cn('h-4 w-4', n <= stars ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground')}
                  />
                ))}
                <span className="text-sm text-muted-foreground ml-1">
                  {profile.reputation.rating_avg.toFixed(1)} · {profile.reputation.completed_trades} successful trade{profile.reputation.completed_trades !== 1 ? 's' : ''}
                </span>
              </div>

              {profile.bio && (
                <p className="text-sm text-muted-foreground max-w-md">{profile.bio}</p>
              )}

              <div className="flex flex-wrap justify-center sm:justify-start gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Joined {formatDate(profile.created_at)}
                </span>
                <ActiveStatus lastActive={profile.last_active} />
              </div>
            </div>

            {isOwnProfile && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/settings/profile">Edit profile</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Active listings */}
      {listingsData && listingsData.listings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Active listings
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {listingsData.listings.map((listing) => (
              <Link
                key={listing.id}
                href={`/listings/${listing.id}`}
                className="block rounded-lg border border-border p-3 hover:border-primary/50 transition-colors"
              >
                <p className="font-medium text-sm truncate">{listing.title}</p>
                <div className="mt-1 flex items-center gap-2">
                  {listing.price_indication && (
                    <span className="text-xs text-muted-foreground">
                      {listing.price_indication} {listing.currency ?? ''}
                    </span>
                  )}
                  <div className="flex gap-1 flex-wrap">
                    {listing.payment_methods.slice(0, 2).map((pm) => (
                      <Badge key={pm} variant="secondary" className="text-xs px-1 py-0 h-auto">
                        {PAYMENT_LABELS[pm] ?? pm}
                      </Badge>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Active contracts — only offers created by this user */}
      {visibleOffers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4" />
              {profile.nickname} Active Contracts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {visibleOffers.map((offer) => (
              <CompactOfferRow key={offer.id} offer={offer} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent ratings */}
      {ratingsData && ratingsData.ratings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4" />
              Recent ratings
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {ratingsData.ratings.slice(0, 5).map((rating) => (
              <div key={rating.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={cn(
                          'h-3 w-3',
                          n <= rating.score ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground',
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">{timeAgo(rating.created_at)}</span>
                </div>
                {rating.comment && (
                  <p className="mt-1 text-sm text-muted-foreground">{rating.comment}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
