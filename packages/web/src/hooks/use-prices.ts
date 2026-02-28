import { useQuery } from '@tanstack/react-query';
import { prices as pricesApi } from '@/lib/api';

export const priceKeys = {
  all: ['prices'] as const,
  coins: () => ['supported-coins'] as const,
};

export function usePrices() {
  return useQuery({
    queryKey: priceKeys.all,
    queryFn: () => pricesApi.getPrices(),
    refetchInterval: 30_000, // 30 seconds
    staleTime: 15_000,
  });
}

export function useSupportedCoins() {
  return useQuery({
    queryKey: priceKeys.coins(),
    queryFn: () => pricesApi.getSupportedCoins(),
    staleTime: 1000 * 60 * 10, // coins rarely change
  });
}
