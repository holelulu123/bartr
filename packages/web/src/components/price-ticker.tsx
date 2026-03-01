'use client';

import { usePrices, useExchangePrices, getExchangePrice } from '@/hooks/use-prices';
import type { PriceSource } from '@bartr/shared';

interface PriceTickerProps {
  crypto: string;
  fiat: string;
  className?: string;
  source?: PriceSource;
}

export function PriceTicker({ crypto, fiat, className, source }: PriceTickerProps) {
  const { data: mergedPrices, isLoading: mergedLoading } = usePrices();
  const { data: exchangePrices, isLoading: exchangeLoading } = useExchangePrices();

  const isLoading = source ? exchangeLoading : mergedLoading;

  if (isLoading) {
    return <span className={className}>...</span>;
  }

  let price: number | undefined;

  if (source) {
    price = getExchangePrice(exchangePrices, source, crypto, fiat);
  } else {
    if (!mergedPrices) {
      return <span className={className}>--</span>;
    }
    const cryptoPrices = mergedPrices[crypto];
    if (!cryptoPrices || typeof cryptoPrices === 'string') {
      return <span className={className}>--</span>;
    }
    price = cryptoPrices[fiat];
  }

  if (price === undefined) {
    return <span className={className}>--</span>;
  }

  const formatted = price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return <span className={className}>{formatted} {fiat}</span>;
}
