'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUp, ArrowDown, Star, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getCountryFlag, getCountryName } from '@/lib/countries';
import { useAuth } from '@/contexts/auth-context';
import { usePrices } from '@/hooks/use-prices';
import { useDeleteOffer } from '@/hooks/use-exchange';
import { cn } from '@/lib/utils';
import type { ExchangeOffer } from '@/lib/api';
import { SETTLEMENT_METHOD_LABELS } from '@bartr/shared';
import type { SettlementMethod } from '@bartr/shared';

interface OfferRowProps {
  offer: ExchangeOffer;
}

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
  const n = Number(val);
  const formatted = n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  if (decimals <= 2) return formatted.replace(/\.00$/, '');
  return formatted;
}

/** Deterministic identicon — compact inline version */
function MiniIdenticon({ seed, size = 28 }: { seed: string; size?: number }) {
  const cells = 5;
  const cellSize = size / cells;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = Math.imul(31, hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const h = ((hash >>> 0) * 2654435761) >>> 0;
  const fg = `hsl(${h % 360},65%,55%)`;
  const bg = `hsl(${(h % 360 + 150) % 360},30%,18%)`;
  const grid: boolean[][] = Array.from({ length: cells }, (_, r) =>
    Array.from({ length: cells }, (_, c) => {
      const col = c < Math.ceil(cells / 2) ? c : cells - 1 - c;
      return ((h >>> (r * Math.ceil(cells / 2) + col)) & 1) === 1;
    }),
  );
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ borderRadius: '50%', flexShrink: 0 }}>
      <rect width={size} height={size} fill={bg} />
      {grid.map((row, r) =>
        row.map((on, c) =>
          on ? <rect key={`${r}-${c}`} x={c * cellSize} y={r * cellSize} width={cellSize} height={cellSize} fill={fg} /> : null,
        ),
      )}
    </svg>
  );
}

export function OfferRow({ offer }: OfferRowProps) {
  const isBuy = offer.offer_type === 'buy';
  const { user } = useAuth();
  const { data: priceData } = usePrices();
  const deleteMutation = useDeleteOffer();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
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

  const ratingAvg = Number(offer.seller_rating_avg) || 0;
  const stars = Math.round(ratingAvg);
  const tradeCount = Number(offer.seller_trade_count) || 0;

  return (
    <div className={cn(
      'grid items-center gap-3 rounded-lg border px-4 py-3 border-l-[3px]',
      'grid-cols-[90px_1.2fr_1fr_180px_140px_1fr_90px]',
      'max-md:grid-cols-[75px_1fr_180px_90px]',
      isBuy
        ? 'border-l-emerald-500 bg-emerald-500/[0.03] border-border'
        : 'border-l-red-400 bg-red-400/[0.03] border-border',
    )}>
      {/* Type + pair */}
      <div className="flex flex-col items-start gap-1">
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help">
                <Badge variant={isBuy ? 'default' : 'secondary'} className="gap-1 text-sm px-2 py-0.5">
                  {isBuy ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
                  {isBuy ? 'Buy' : 'Sell'}
                </Badge>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isBuy
                ? `${offer.seller_nickname} wants to buy ${offer.crypto_currency} with ${offer.fiat_currency}`
                : `${offer.seller_nickname} wants to sell ${offer.crypto_currency} for ${offer.fiat_currency}`}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <span className={cn('text-sm font-semibold whitespace-nowrap', CRYPTO_COLORS[offer.crypto_currency] ?? 'text-foreground')}>
          {offer.crypto_currency}/{offer.fiat_currency}
        </span>
      </div>

      {/* Trader */}
      <div className="hidden md:flex items-center gap-2 overflow-hidden">
        <Link href={`/user/${offer.seller_nickname}`} className="shrink-0">
          <MiniIdenticon seed={offer.seller_nickname} size={32} />
        </Link>
        <div className="min-w-0 overflow-hidden">
          <Link
            href={`/user/${offer.seller_nickname}`}
            className="text-base font-semibold hover:underline block truncate"
          >
            {offer.seller_nickname}
          </Link>
          {(offer.country_code || offer.city) && (
            <p className="text-sm text-muted-foreground truncate">
              {offer.country_code && getCountryFlag(offer.country_code)}{' '}
              {offer.country_code && getCountryName(offer.country_code)}
              {offer.city && `, ${offer.city}`}
            </p>
          )}
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={cn('h-4 w-4', n <= stars ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/30')}
                />
              ))}
              <span className="text-sm text-muted-foreground ml-0.5">
                {ratingAvg.toFixed(1)}
              </span>
            </div>
            <span className="text-sm text-muted-foreground">
              · {tradeCount} {tradeCount === 1 ? 'trade' : 'trades'}
            </span>
          </div>
        </div>
      </div>

      {/* Limit */}
      <div className="min-w-0">
        <p className="text-lg font-bold leading-tight whitespace-nowrap">
          {isFixed
            ? `${fmt(minFiat)} ${offer.fiat_currency}`
            : offer.min_amount || offer.max_amount
              ? `${fmt(minFiat)} – ${fmt(maxFiat)} ${offer.fiat_currency}`
              : 'Any amount'}
        </p>
        {effectivePrice !== undefined && (offer.min_amount || offer.max_amount) && (
          <p className="text-sm text-muted-foreground leading-tight mt-0.5 whitespace-nowrap">
            {isFixed
              ? `${fmt(minCrypto!, 6)} ${offer.crypto_currency}`
              : `${fmt(minCrypto!, 6)} – ${fmt(maxCrypto!, 6)} ${offer.crypto_currency}`}
          </p>
        )}
      </div>

      {/* Price + source + margin */}
      <div>
        <p className="text-lg font-bold leading-tight whitespace-nowrap">
          {effectivePrice !== undefined
            ? `${fmt(effectivePrice)} ${offer.fiat_currency}`
            : '--'}
        </p>
        {offer.rate_type === 'market' && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-sm text-muted-foreground capitalize">{offer.price_source}</span>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0 text-xs font-bold cursor-help whitespace-nowrap">
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
                      )}>
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

      {/* Payment methods */}
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

      {/* Offer Details (trade terms) */}
      <div className="hidden md:block min-w-0 overflow-hidden">
        {offer.terms ? (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-snug break-all">
            {offer.terms}
          </p>
        ) : (
          <span className="text-xs text-muted-foreground/50">—</span>
        )}
      </div>

      {/* Action */}
      <div className="flex items-center gap-1.5">
        <Button asChild size="sm" variant="outline">
          <Link href={`/exchange/${offer.id}`}>
            {isOwn ? 'View' : 'Offer'}
          </Link>
        </Button>
        {isOwn && (
          <Button
            size="sm"
            variant="ghost"
            className="px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setShowDeleteDialog(true)}
            aria-label="Delete offer"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

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
