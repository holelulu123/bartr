import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { listings as listingsApi } from '@/lib/api';
import type { ListingsFilter, CreateListingPayload, UpdateListingPayload } from '@/lib/api';

export const listingKeys = {
  all: ['listings'] as const,
  lists: () => [...listingKeys.all, 'list'] as const,
  list: (filters: ListingsFilter) => [...listingKeys.lists(), filters] as const,
  infiniteLists: () => [...listingKeys.all, 'infinite'] as const,
  infiniteList: (filters: Omit<ListingsFilter, 'page'>) => [...listingKeys.infiniteLists(), filters] as const,
  details: () => [...listingKeys.all, 'detail'] as const,
  detail: (id: string) => [...listingKeys.details(), id] as const,
  categories: () => ['categories'] as const,
};

export function useListings(filters: ListingsFilter = {}) {
  return useQuery({
    queryKey: listingKeys.list(filters),
    queryFn: () => listingsApi.getListings(filters),
  });
}

export function useInfiniteListings(filters: Omit<ListingsFilter, 'page'> = {}) {
  return useInfiniteQuery({
    queryKey: listingKeys.infiniteList(filters),
    queryFn: ({ pageParam = 1 }) => listingsApi.getListings({ ...filters, page: pageParam as number }),
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.pages ? last.pagination.page + 1 : undefined,
    initialPageParam: 1,
  });
}

export function useListing(id: string) {
  return useQuery({
    queryKey: listingKeys.detail(id),
    queryFn: () => listingsApi.getListing(id),
    enabled: !!id,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: listingKeys.categories(),
    queryFn: () => listingsApi.getCategories(),
    staleTime: 1000 * 60 * 10, // categories rarely change
  });
}

export function useCreateListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateListingPayload) => listingsApi.createListing(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: listingKeys.lists() });
    },
  });
}

export function useUpdateListing(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateListingPayload) => listingsApi.updateListing(id, payload),
    onSuccess: (updated) => {
      qc.setQueryData(listingKeys.detail(id), updated);
      qc.invalidateQueries({ queryKey: listingKeys.lists() });
    },
  });
}

export function useDeleteListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => listingsApi.deleteListing(id),
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: listingKeys.detail(id) });
      qc.invalidateQueries({ queryKey: listingKeys.lists() });
    },
  });
}

export function useUploadListingImage(listingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => listingsApi.uploadListingImage(listingId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: listingKeys.detail(listingId) });
    },
  });
}

export function useDeleteListingImage(listingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (imageId: string) => listingsApi.deleteListingImage(listingId, imageId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: listingKeys.detail(listingId) });
    },
  });
}
