import { get, post } from './client';
import type {
  Trade,
  TradeDetail,
  TradesResponse,
  TradesFilter,
  CompleteTradeResponse,
  Rating,
  RateTradePayload,
} from './types';

export function getTrades(filters: TradesFilter = {}): Promise<TradesResponse> {
  const params = new URLSearchParams();
  if (filters.role) params.set('role', filters.role);
  if (filters.status) params.set('status', filters.status);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));

  const qs = params.toString();
  return get<TradesResponse>(`/trades${qs ? `?${qs}` : ''}`);
}

export function getTrade(id: string): Promise<TradeDetail> {
  return get<TradeDetail>(`/trades/${id}`);
}

export function createOffer(listing_id: string): Promise<Trade> {
  return post<Trade>('/trades', { listing_id });
}

export function acceptTrade(id: string): Promise<Trade> {
  return post<Trade>(`/trades/${id}/accept`);
}

export function declineTrade(id: string): Promise<Trade> {
  return post<Trade>(`/trades/${id}/decline`);
}

export function cancelTrade(id: string): Promise<Trade> {
  return post<Trade>(`/trades/${id}/cancel`);
}

export function completeTrade(id: string): Promise<CompleteTradeResponse> {
  return post<CompleteTradeResponse>(`/trades/${id}/complete`);
}

export function rateTrade(tradeId: string, payload: RateTradePayload): Promise<Rating> {
  return post<Rating>(`/trades/${tradeId}/rate`, payload);
}
