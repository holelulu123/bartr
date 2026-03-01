import { useQuery } from '@tanstack/react-query';
import { prices as pricesApi } from '@/lib/api';
import type { SupportedCoin, ExchangePricesResponse, PriceData } from '@/lib/api/types';
import type { PriceSource } from '@bartr/shared';

export const priceKeys = {
  all: ['prices'] as const,
  exchanges: ['prices', 'exchanges'] as const,
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

export function useExchangePrices() {
  return useQuery({
    queryKey: priceKeys.exchanges,
    queryFn: () => pricesApi.getExchangePrices(),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

/**
 * Extract a single crypto→fiat price from exchange-specific data.
 * Returns undefined if the exchange has no data for this pair.
 */
export function getExchangePrice(
  data: ExchangePricesResponse | undefined,
  source: PriceSource,
  crypto: string,
  fiat: string,
): number | undefined {
  if (!data) return undefined;
  const exchangeData: PriceData | null = data[source];
  if (!exchangeData) return undefined;
  const cryptoPrices = exchangeData[crypto];
  if (!cryptoPrices || typeof cryptoPrices === 'string') return undefined;
  return cryptoPrices[fiat];
}

// ── Static coin lists ──────────────────────────────────────────────────────

const CRYPTO_COINS: SupportedCoin[] = [
  { symbol: 'BTC', name: 'Bitcoin', coin_type: 'crypto', is_active: true, sort_order: 1 },
  { symbol: 'ETH', name: 'Ethereum', coin_type: 'crypto', is_active: true, sort_order: 2 },
  { symbol: 'USDT', name: 'USDT', coin_type: 'crypto', is_active: true, sort_order: 3 },
  { symbol: 'USDC', name: 'USDC', coin_type: 'crypto', is_active: true, sort_order: 4 },
  { symbol: 'SOL', name: 'Solana', coin_type: 'crypto', is_active: true, sort_order: 5 },
  { symbol: 'XRP', name: 'XRP', coin_type: 'crypto', is_active: true, sort_order: 6 },
];

const FIAT_COINS: SupportedCoin[] = [
  { symbol: 'USD', name: 'US Dollar', coin_type: 'fiat', is_active: true, sort_order: 100 },
  { symbol: 'EUR', name: 'Euro', coin_type: 'fiat', is_active: true, sort_order: 101 },
  { symbol: 'ILS', name: 'Israeli Shekel', coin_type: 'fiat', is_active: true, sort_order: 102 },
  { symbol: 'GBP', name: 'British Pound', coin_type: 'fiat', is_active: true, sort_order: 103 },
  { symbol: 'CAD', name: 'Canadian Dollar', coin_type: 'fiat', is_active: true, sort_order: 104 },
  { symbol: 'AUD', name: 'Australian Dollar', coin_type: 'fiat', is_active: true, sort_order: 105 },
  { symbol: 'JPY', name: 'Japanese Yen', coin_type: 'fiat', is_active: true, sort_order: 106 },
  { symbol: 'CHF', name: 'Swiss Franc', coin_type: 'fiat', is_active: true, sort_order: 107 },
  { symbol: 'CNY', name: 'Chinese Yuan', coin_type: 'fiat', is_active: true, sort_order: 108 },
  { symbol: 'INR', name: 'Indian Rupee', coin_type: 'fiat', is_active: true, sort_order: 109 },
  { symbol: 'KRW', name: 'South Korean Won', coin_type: 'fiat', is_active: true, sort_order: 110 },
  { symbol: 'BRL', name: 'Brazilian Real', coin_type: 'fiat', is_active: true, sort_order: 111 },
  { symbol: 'MXN', name: 'Mexican Peso', coin_type: 'fiat', is_active: true, sort_order: 112 },
  { symbol: 'SGD', name: 'Singapore Dollar', coin_type: 'fiat', is_active: true, sort_order: 113 },
  { symbol: 'HKD', name: 'Hong Kong Dollar', coin_type: 'fiat', is_active: true, sort_order: 114 },
  { symbol: 'NOK', name: 'Norwegian Krone', coin_type: 'fiat', is_active: true, sort_order: 115 },
  { symbol: 'SEK', name: 'Swedish Krona', coin_type: 'fiat', is_active: true, sort_order: 116 },
  { symbol: 'DKK', name: 'Danish Krone', coin_type: 'fiat', is_active: true, sort_order: 117 },
  { symbol: 'PLN', name: 'Polish Zloty', coin_type: 'fiat', is_active: true, sort_order: 118 },
  { symbol: 'CZK', name: 'Czech Koruna', coin_type: 'fiat', is_active: true, sort_order: 119 },
  { symbol: 'HUF', name: 'Hungarian Forint', coin_type: 'fiat', is_active: true, sort_order: 120 },
  { symbol: 'RON', name: 'Romanian Leu', coin_type: 'fiat', is_active: true, sort_order: 121 },
  { symbol: 'TRY', name: 'Turkish Lira', coin_type: 'fiat', is_active: true, sort_order: 122 },
  { symbol: 'ZAR', name: 'South African Rand', coin_type: 'fiat', is_active: true, sort_order: 123 },
  { symbol: 'THB', name: 'Thai Baht', coin_type: 'fiat', is_active: true, sort_order: 124 },
  { symbol: 'TWD', name: 'Taiwan Dollar', coin_type: 'fiat', is_active: true, sort_order: 125 },
  { symbol: 'PHP', name: 'Philippine Peso', coin_type: 'fiat', is_active: true, sort_order: 126 },
  { symbol: 'IDR', name: 'Indonesian Rupiah', coin_type: 'fiat', is_active: true, sort_order: 127 },
  { symbol: 'MYR', name: 'Malaysian Ringgit', coin_type: 'fiat', is_active: true, sort_order: 128 },
  { symbol: 'VND', name: 'Vietnamese Dong', coin_type: 'fiat', is_active: true, sort_order: 129 },
  { symbol: 'AED', name: 'UAE Dirham', coin_type: 'fiat', is_active: true, sort_order: 130 },
  { symbol: 'SAR', name: 'Saudi Riyal', coin_type: 'fiat', is_active: true, sort_order: 131 },
  { symbol: 'ARS', name: 'Argentine Peso', coin_type: 'fiat', is_active: true, sort_order: 132 },
  { symbol: 'CLP', name: 'Chilean Peso', coin_type: 'fiat', is_active: true, sort_order: 133 },
  { symbol: 'COP', name: 'Colombian Peso', coin_type: 'fiat', is_active: true, sort_order: 134 },
  { symbol: 'PEN', name: 'Peruvian Sol', coin_type: 'fiat', is_active: true, sort_order: 135 },
  { symbol: 'NGN', name: 'Nigerian Naira', coin_type: 'fiat', is_active: true, sort_order: 136 },
  { symbol: 'KES', name: 'Kenyan Shilling', coin_type: 'fiat', is_active: true, sort_order: 137 },
  { symbol: 'EGP', name: 'Egyptian Pound', coin_type: 'fiat', is_active: true, sort_order: 138 },
  { symbol: 'PKR', name: 'Pakistani Rupee', coin_type: 'fiat', is_active: true, sort_order: 139 },
  { symbol: 'BDT', name: 'Bangladeshi Taka', coin_type: 'fiat', is_active: true, sort_order: 140 },
  { symbol: 'UAH', name: 'Ukrainian Hryvnia', coin_type: 'fiat', is_active: true, sort_order: 141 },
  { symbol: 'GEL', name: 'Georgian Lari', coin_type: 'fiat', is_active: true, sort_order: 142 },
  { symbol: 'AMD', name: 'Armenian Dram', coin_type: 'fiat', is_active: true, sort_order: 143 },
  { symbol: 'NZD', name: 'New Zealand Dollar', coin_type: 'fiat', is_active: true, sort_order: 144 },
  { symbol: 'ISK', name: 'Icelandic Krona', coin_type: 'fiat', is_active: true, sort_order: 145 },
];

const ALL_COINS = [...CRYPTO_COINS, ...FIAT_COINS];

const FIAT_FLAGS: Record<string, string> = {
  USD: '🇺🇸', EUR: '🇪🇺', ILS: '🇮🇱', GBP: '🇬🇧', CAD: '🇨🇦', AUD: '🇦🇺',
  JPY: '🇯🇵', CHF: '🇨🇭', CNY: '🇨🇳', INR: '🇮🇳', KRW: '🇰🇷', BRL: '🇧🇷',
  MXN: '🇲🇽', SGD: '🇸🇬', HKD: '🇭🇰', NOK: '🇳🇴', SEK: '🇸🇪', DKK: '🇩🇰',
  PLN: '🇵🇱', CZK: '🇨🇿', HUF: '🇭🇺', RON: '🇷🇴', TRY: '🇹🇷', ZAR: '🇿🇦',
  THB: '🇹🇭', TWD: '🇹🇼', PHP: '🇵🇭', IDR: '🇮🇩', MYR: '🇲🇾', VND: '🇻🇳',
  AED: '🇦🇪', SAR: '🇸🇦', ARS: '🇦🇷', CLP: '🇨🇱', COP: '🇨🇴', PEN: '🇵🇪',
  NGN: '🇳🇬', KES: '🇰🇪', EGP: '🇪🇬', PKR: '🇵🇰', BDT: '🇧🇩', UAH: '🇺🇦',
  GEL: '🇬🇪', AMD: '🇦🇲', NZD: '🇳🇿', ISK: '🇮🇸',
};

export function getFiatFlag(symbol: string): string {
  return FIAT_FLAGS[symbol] ?? '💱';
}

export function useSupportedCoins() {
  return { data: { coins: ALL_COINS }, isLoading: false, isError: false };
}
