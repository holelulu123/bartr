import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { exchange as exchangeApi } from '@/lib/api';
import type { OffersFilter, CreateOfferPayload, UpdateOfferPayload } from '@/lib/api';

export const exchangeKeys = {
  all: ['exchange'] as const,
  lists: () => [...exchangeKeys.all, 'list'] as const,
  list: (filters: OffersFilter) => [...exchangeKeys.lists(), filters] as const,
  infiniteLists: () => [...exchangeKeys.all, 'infinite'] as const,
  infiniteList: (filters: Omit<OffersFilter, 'page'>) => [...exchangeKeys.infiniteLists(), filters] as const,
  details: () => [...exchangeKeys.all, 'detail'] as const,
  detail: (id: string) => [...exchangeKeys.details(), id] as const,
};

export function useOffers(filters: OffersFilter = {}) {
  return useQuery({
    queryKey: exchangeKeys.list(filters),
    queryFn: () => exchangeApi.getOffers(filters),
  });
}

export function useInfiniteOffers(filters: Omit<OffersFilter, 'page'> = {}) {
  return useInfiniteQuery({
    queryKey: exchangeKeys.infiniteList(filters),
    queryFn: ({ pageParam = 1 }) => exchangeApi.getOffers({ ...filters, page: pageParam as number }),
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.pages ? last.pagination.page + 1 : undefined,
    initialPageParam: 1,
  });
}

export function useOffer(id: string) {
  return useQuery({
    queryKey: exchangeKeys.detail(id),
    queryFn: () => exchangeApi.getOffer(id),
    enabled: !!id,
  });
}

export function useCreateOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateOfferPayload) => exchangeApi.createOffer(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: exchangeKeys.lists() });
    },
  });
}

export function useUpdateOffer(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateOfferPayload) => exchangeApi.updateOffer(id, payload),
    onSuccess: (updated) => {
      qc.setQueryData(exchangeKeys.detail(id), updated);
      qc.invalidateQueries({ queryKey: exchangeKeys.lists() });
    },
  });
}

export function useDeleteOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => exchangeApi.deleteOffer(id),
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: exchangeKeys.detail(id) });
      qc.invalidateQueries({ queryKey: exchangeKeys.lists() });
    },
  });
}
