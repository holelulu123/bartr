import { get, post, put, del } from './client';
import type {
  ExchangeOffer,
  OffersResponse,
  OffersFilter,
  CreateOfferPayload,
  UpdateOfferPayload,
} from './types';

export function getOffers(filters: OffersFilter = {}): Promise<OffersResponse> {
  const params = new URLSearchParams();
  if (filters.offer_type) params.set('offer_type', filters.offer_type);
  if (filters.crypto_currency) params.set('crypto_currency', filters.crypto_currency);
  if (filters.fiat_currency) params.set('fiat_currency', filters.fiat_currency);
  if (filters.payment_method) params.set('payment_method', filters.payment_method);
  if (filters.country_code) params.set('country_code', filters.country_code);
  if (filters.user_id) params.set('user_id', filters.user_id);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));

  const qs = params.toString();
  return get<OffersResponse>(`/exchange/offers${qs ? `?${qs}` : ''}`);
}

export function getOffer(id: string): Promise<ExchangeOffer> {
  return get<ExchangeOffer>(`/exchange/offers/${id}`);
}

export function createOffer(payload: CreateOfferPayload): Promise<ExchangeOffer> {
  return post<ExchangeOffer>('/exchange/offers', payload);
}

export function updateOffer(id: string, payload: UpdateOfferPayload): Promise<ExchangeOffer> {
  return put<ExchangeOffer>(`/exchange/offers/${id}`, payload);
}

export function deleteOffer(id: string): Promise<void> {
  return del(`/exchange/offers/${id}`);
}
