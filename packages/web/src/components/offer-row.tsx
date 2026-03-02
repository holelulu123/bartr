'use client';

import Link from 'next/link';
import { ArrowUp, ArrowDown, Star, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { getCountryFlag } from '@/lib/countries';
import { useAuth } from '@/contexts/auth-context';
import { usePrices } from '@/hooks/use-prices';
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
  return Number(val).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
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

  // Get market price to compute crypto equivalent of fiat limits
  let coinPrice: number | undefined;
  if (priceData) {
    const cryptoPrices = priceData[offer.crypto_currency];
    if (cryptoPrices && typeof cryptoPrices !== 'string') {
      coinPrice = cryptoPrices[offer.fiat_currency];
    }
  }

  // Compute effective price (market + margin or fixed)
  const effectivePrice = offer.rate_type === 'fixed'
    ? Number(offer.fixed_price) || undefined
    : coinPrice !== undefined
      ? coinPrice * (1 + (Number(offer.margin_percent) || 0) / 100)
      : undefined;

  // Crypto equivalents
  const minFiat = Number(offer.min_amount) || 0;
  const maxFiat = Number(offer.max_amount) || 0;
  const minCrypto = effectivePrice ? minFiat / effectivePrice : undefined;
  const maxCrypto = effectivePrice ? maxFiat / effectivePrice : undefined;
  const isFixed = minFiat === maxFiat && minFiat > 0;

  const ratingAvg = Number(offer.seller_rating_avg) || 0;
  const stars = Math.round(ratingAvg);

  return (
    <div className={cn(
      'grid items-center gap-4 rounded-lg border px-4 py-3 border-l-[3px]',
      'grid-cols-[70px_200px_1fr_180px_130px_100px]',
      'max-md:grid-cols-[70px_1fr_180px_100px]',
      isBuy
        ? 'border-l-emerald-500 bg-emerald-500/[0.03] border-border'
        : 'border-l-red-400 bg-red-400/[0.03] border-border',
    )}>
      {/* Type indicator + pair */}
      <div className="space-y-1">
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="cursor-help">
                <Badge variant={isBuy ? 'default' : 'secondary'} className="gap-1 text-sm px-2 py-0.5">
                  {isBuy ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
                  {isBuy ? 'Buy' : 'Sell'}
                </Badge>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {offer.seller_nickname} wants to {isBuy ? 'buy' : 'sell'} {offer.crypto_currency} for {offer.fiat_currency}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <p className={cn('text-sm font-semibold', CRYPTO_COLORS[offer.crypto_currency] ?? 'text-foreground')}>
          {offer.crypto_currency}/{offer.fiat_currency}
        </p>
      </div>

      {/* Seller — identicon + name + stars */}
      <div className="hidden md:flex items-center gap-2 overflow-hidden">
        <Link href={`/user/${offer.seller_nickname}`} className="shrink-0">
          <MiniIdenticon seed={offer.seller_nickname} size={32} />
        </Link>
        <div className="min-w-0 overflow-hidden">
          {offer.country_code && (
            <span className="text-xs">{getCountryFlag(offer.country_code)}</span>
          )}
          <Link
            href={`/user/${offer.seller_nickname}`}
            className="text-xs font-semibold hover:underline block truncate"
          >
            {offer.seller_nickname}
          </Link>
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={cn('h-3.5 w-3.5', n <= stars ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/30')}
              />
            ))}
            <span className="text-xs text-muted-foreground ml-1">
              {ratingAvg.toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Amount */}
      <div className="min-w-0">
        <p className="text-[15px] font-bold leading-tight">
          {isFixed
            ? `${fmt(minFiat)} ${offer.fiat_currency}`
            : offer.min_amount || offer.max_amount
              ? `${fmt(minFiat)} – ${fmt(maxFiat)} ${offer.fiat_currency}`
              : 'Any amount'}
        </p>
        {effectivePrice !== undefined && (offer.min_amount || offer.max_amount) && (
          <p className="text-xs text-muted-foreground leading-tight mt-0.5">
            {isFixed
              ? `${fmt(minCrypto!, 6)} ${offer.crypto_currency}`
              : `${fmt(minCrypto!, 6)} – ${fmt(maxCrypto!, 6)} ${offer.crypto_currency}`}
          </p>
        )}
      </div>

      {/* Price per coin + margin */}
      <div>
        <p className="text-[15px] font-bold leading-tight whitespace-nowrap">
          {effectivePrice !== undefined
            ? `${fmt(effectivePrice)} ${offer.fiat_currency}`
            : '--'}
        </p>
        {offer.rate_type === 'market' && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="mt-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0 text-xs font-medium cursor-help whitespace-nowrap">
                  {Number(offer.margin_percent) > 0 ? '+' : ''}{offer.margin_percent}%
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                The {isBuy ? 'buyer' : 'seller'} seeks {Number(offer.margin_percent) === 0 ? 'market price' : `${Math.abs(Number(offer.margin_percent))}% ${Number(offer.margin_percent) > 0 ? 'above' : 'below'} market price`} ({offer.price_source})
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {offer.rate_type === 'fixed' && coinPrice !== undefined && effectivePrice !== undefined && (
          (() => {
            const pct = ((effectivePrice / coinPrice - 1) * 100);
            const sign = pct >= 0 ? '+' : '';
            return (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className={cn(
                      'mt-0.5 rounded px-1.5 py-0 text-xs font-medium cursor-help whitespace-nowrap',
                      pct >= 0 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/15 text-red-600 dark:text-red-400',
                    )}>
                      {sign}{pct.toFixed(1)}%
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Fixed price is {Math.abs(pct).toFixed(1)}% {pct >= 0 ? 'above' : 'below'} current market price
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })()
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

      {/* Action */}
      <div className="flex items-center gap-1.5">
        <Button asChild size="sm" variant="outline">
          <Link href={`/exchange/${offer.id}`}>
            View
          </Link>
        </Button>
        {user?.nickname !== offer.seller_nickname && (
          <Button asChild size="sm" variant="ghost" className="px-2 text-orange-500 hover:text-orange-600 hover:bg-orange-500/10">
            <Link href={`/messages?contact=${offer.seller_nickname}`}>
              <MessageSquare className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
