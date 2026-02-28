import { get, post, put, del, upload } from './client';
import type {
  ListingDetail,
  ListingsResponse,
  ListingsFilter,
  CreateListingPayload,
  UpdateListingPayload,
  Category,
} from './types';

export function getListings(filters: ListingsFilter = {}): Promise<ListingsResponse> {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.category) params.set('category', filters.category);
  if (filters.payment_method) params.set('payment_method', filters.payment_method);
  if (filters.country_code) params.set('country_code', filters.country_code);
  if (filters.status) params.set('status', filters.status);
  if (filters.user_id) params.set('user_id', filters.user_id);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));

  const qs = params.toString();
  return get<ListingsResponse>(`/listings${qs ? `?${qs}` : ''}`);
}

export function getListing(id: string): Promise<ListingDetail> {
  return get<ListingDetail>(`/listings/${id}`);
}

export function createListing(payload: CreateListingPayload): Promise<ListingDetail> {
  return post<ListingDetail>('/listings', payload);
}

export function updateListing(id: string, payload: UpdateListingPayload): Promise<ListingDetail> {
  return put<ListingDetail>(`/listings/${id}`, payload);
}

export function deleteListing(id: string): Promise<void> {
  return del(`/listings/${id}`);
}

export function uploadListingImage(listingId: string, file: File): Promise<{ id: string; storage_key: string }> {
  const formData = new FormData();
  formData.append('image', file);
  return upload(`/listings/${listingId}/images`, formData);
}

export function deleteListingImage(listingId: string, imageId: string): Promise<void> {
  return del(`/listings/${listingId}/images/${imageId}`);
}

export function getCategories(): Promise<{ categories: Category[] }> {
  return get<{ categories: Category[] }>('/categories');
}
