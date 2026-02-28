'use client';

import { usePrices } from '@/hooks/use-prices';

interface PriceTickerProps {
  crypto: string;
  fiat: string;
  className?: string;
}

export function PriceTicker({ crypto, fiat, className }: PriceTickerProps) {
  const { data: prices, isLoading } = usePrices();

  if (isLoading) {
    return <span className={className}>...</span>;
  }

  if (!prices) {
    return <span className={className}>--</span>;
  }

  const cryptoPrices = prices[crypto];
  if (!cryptoPrices || typeof cryptoPrices === 'string') {
    return <span className={className}>--</span>;
  }

  const price = cryptoPrices[fiat];
  if (price === undefined) {
    return <span className={className}>--</span>;
  }

  const formatted = price >= 1
    ? price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });

  return <span className={className}>{formatted} {fiat}</span>;
}
