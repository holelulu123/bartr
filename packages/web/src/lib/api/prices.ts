import { get } from './client';
import type { PriceData, SupportedCoinsResponse } from './types';

export function getPrices(): Promise<PriceData> {
  return get<PriceData>('/prices');
}

export function getCryptoPrice(crypto: string): Promise<{ symbol: string; prices: Record<string, number>; updated_at: string }> {
  return get(`/prices/${crypto}`);
}

export function getSupportedCoins(): Promise<SupportedCoinsResponse> {
  return get<SupportedCoinsResponse>('/supported-coins');
}
