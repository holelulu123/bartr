'use client';

import Link from 'next/link';
import { ArrowUp, ArrowDown, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { getCountryFlag } from '@/lib/countries';
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
      'flex items-center gap-4 rounded-lg border px-4 py-3 border-l-[3px]',
      isBuy
        ? 'border-l-emerald-500 bg-emerald-500/[0.03] border-border'
        : 'border-l-red-400 bg-red-400/[0.03] border-border',
    )}>
      {/* Type indicator + pair */}
      <div className="shrink-0 space-y-1">
        <Badge variant={isBuy ? 'default' : 'secondary'} className="gap-1 text-[15px] px-2.5 py-0.5">
          {isBuy ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
          {isBuy ? 'Buy' : 'Sell'}
        </Badge>
        <p className={cn('text-[15px] font-semibold', CRYPTO_COLORS[offer.crypto_currency] ?? 'text-foreground')}>
          {offer.crypto_currency}/{offer.fiat_currency}
        </p>
      </div>

      {/* Seller — identicon + name + stars */}
      <div className="hidden sm:flex items-center gap-2 w-[200px] shrink-0">
        <Link href={`/user/${offer.seller_nickname}`} className="shrink-0">
          <MiniIdenticon seed={offer.seller_nickname} size={36} />
        </Link>
        <div className="min-w-0">
          <Link
            href={`/user/${offer.seller_nickname}`}
            className="text-[15px] font-semibold hover:underline block"
          >
            {offer.country_code && (
              <span className="mr-1">{getCountryFlag(offer.country_code)}</span>
            )}
            {offer.seller_nickname}
          </Link>
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={cn('h-4 w-4', n <= stars ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/30')}
              />
            ))}
            <span className="text-sm text-muted-foreground ml-1">
              {ratingAvg.toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Amount + Price + Margin */}
      <div className="flex-1 flex items-start min-w-0">
        {/* Amount */}
        <div className="min-w-0 flex-1 pl-6">
          <p className="text-lg font-bold leading-tight">
            {isFixed
              ? `${fmt(minFiat)} ${offer.fiat_currency}`
              : offer.min_amount || offer.max_amount
                ? `${fmt(minFiat)} – ${fmt(maxFiat)} ${offer.fiat_currency}`
                : 'Any amount'}
          </p>
          {effectivePrice !== undefined && (offer.min_amount || offer.max_amount) && (
            <p className="text-sm text-muted-foreground leading-tight mt-0.5">
              {isFixed
                ? `${fmt(minCrypto!, 6)} ${offer.crypto_currency}`
                : `${fmt(minCrypto!, 6)} – ${fmt(maxCrypto!, 6)} ${offer.crypto_currency}`}
            </p>
          )}
        </div>

        {/* Price per coin + margin — left-aligned so margin aligns with price start */}
        <div className="shrink-0 ml-auto pl-8">
          <p className="text-lg font-bold leading-tight whitespace-nowrap">
            {effectivePrice !== undefined
              ? `${fmt(effectivePrice)} ${offer.fiat_currency}`
              : '--'}
          </p>
          {offer.rate_type === 'market' && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="mt-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0 text-[13px] font-medium cursor-help whitespace-nowrap">
                    {Number(offer.margin_percent) > 0 ? '+' : ''}{offer.margin_percent}%
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  The {isBuy ? 'buyer' : 'seller'} seeks {Number(offer.margin_percent) === 0 ? 'market price' : `${Math.abs(Number(offer.margin_percent))}% ${Number(offer.margin_percent) > 0 ? 'above' : 'below'} market price`} ({offer.price_source})
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

      </div>

      {/* Settlement methods */}
      <div className="hidden md:flex flex-wrap gap-1 shrink-0 max-w-[160px]">
        {offer.payment_methods.slice(0, 2).map((pm) => (
          <Badge key={pm} variant="outline" className="text-[13px] px-1.5 py-0">
            {SETTLEMENT_METHOD_LABELS[pm as SettlementMethod] ?? pm}
          </Badge>
        ))}
        {offer.payment_methods.length > 2 && (
          <Badge variant="outline" className="text-[13px] px-1.5 py-0">
            +{offer.payment_methods.length - 2}
          </Badge>
        )}
      </div>

      {/* Action */}
      <div className="shrink-0">
        <Button asChild size="sm" variant="outline">
          <Link href={`/exchange/${offer.id}`}>
            View
          </Link>
        </Button>
      </div>
    </div>
  );
}
