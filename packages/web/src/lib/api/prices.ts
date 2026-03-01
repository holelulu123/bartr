import { get } from './client';
import type { PriceData, ExchangePricesResponse, SupportedCoinsResponse } from './types';

export function getPrices(): Promise<PriceData> {
  return get<PriceData>('/prices');
}

export function getExchangePrices(): Promise<ExchangePricesResponse> {
  return get<ExchangePricesResponse>('/prices/exchanges');
}

export function getCryptoPrice(crypto: string): Promise<{ symbol: string; prices: Record<string, number>; updated_at: string }> {
  return get(`/prices/${crypto}`);
}

export function getSupportedCoins(): Promise<SupportedCoinsResponse> {
  return get<SupportedCoinsResponse>('/supported-coins');
}
