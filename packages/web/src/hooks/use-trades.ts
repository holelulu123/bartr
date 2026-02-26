import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trades as tradesApi } from '@/lib/api';
import type { TradesFilter, RateTradePayload } from '@/lib/api';

export const tradeKeys = {
  all: ['trades'] as const,
  lists: () => [...tradeKeys.all, 'list'] as const,
  list: (filters: TradesFilter) => [...tradeKeys.lists(), filters] as const,
  details: () => [...tradeKeys.all, 'detail'] as const,
  detail: (id: string) => [...tradeKeys.details(), id] as const,
};

export function useTrades(filters: TradesFilter = {}) {
  return useQuery({
    queryKey: tradeKeys.list(filters),
    queryFn: () => tradesApi.getTrades(filters),
  });
}

export function useTrade(id: string) {
  return useQuery({
    queryKey: tradeKeys.detail(id),
    queryFn: () => tradesApi.getTrade(id),
    enabled: !!id,
  });
}

export function useCreateOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (listing_id: string) => tradesApi.createOffer(listing_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tradeKeys.lists() });
    },
  });
}

export function useAcceptTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tradesApi.acceptTrade(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: tradeKeys.detail(id) });
      qc.invalidateQueries({ queryKey: tradeKeys.lists() });
    },
  });
}

export function useDeclineTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tradesApi.declineTrade(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: tradeKeys.detail(id) });
      qc.invalidateQueries({ queryKey: tradeKeys.lists() });
    },
  });
}

export function useCancelTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tradesApi.cancelTrade(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: tradeKeys.detail(id) });
      qc.invalidateQueries({ queryKey: tradeKeys.lists() });
    },
  });
}

export function useCompleteTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tradesApi.completeTrade(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: tradeKeys.detail(id) });
      qc.invalidateQueries({ queryKey: tradeKeys.lists() });
    },
  });
}

export function useRateTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tradeId, payload }: { tradeId: string; payload: RateTradePayload }) =>
      tradesApi.rateTrade(tradeId, payload),
    onSuccess: (_, { tradeId }) => {
      qc.invalidateQueries({ queryKey: tradeKeys.detail(tradeId) });
    },
  });
}
