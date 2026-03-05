export const APP_NAME = 'Bartr';

export type ListingStatus = 'active' | 'paused' | 'sold' | 'removed';

export type ListingCondition = 'brand_new' | 'like_new' | 'good' | 'fair' | 'for_parts';

export const LISTING_CONDITION_LABELS: Record<ListingCondition, string> = {
  brand_new: 'Brand New',
  like_new: 'Like New',
  good: 'Good',
  fair: 'Fair',
  for_parts: 'For Parts',
};

export type TradeStatus = 'offered' | 'accepted' | 'completed' | 'declined' | 'cancelled';

export type CryptoPaymentMethod = 'btc' | 'eth' | 'usdt' | 'usdc' | 'sol' | 'xrp' | 'trx' | 'ton';

export const CRYPTO_PAYMENT_METHODS: CryptoPaymentMethod[] = ['btc', 'eth', 'usdt', 'usdc', 'sol', 'xrp', 'trx', 'ton'];

export const CRYPTO_PAYMENT_METHOD_LABELS: Record<CryptoPaymentMethod, string> = {
  btc: 'Bitcoin',
  eth: 'Ethereum',
  usdt: 'USDT',
  usdc: 'USDC',
  sol: 'Solana',
  xrp: 'XRP',
  trx: 'TRON',
  ton: 'TON',
};

export type PaymentMethod =
  | 'btc' | 'eth' | 'usdt' | 'usdc' | 'sol' | 'xrp' | 'trx' | 'ton'
  | 'cash' | 'bank_transfer' | 'paypal' | 'wise' | 'revolut'
  | 'zelle' | 'venmo' | 'sepa' | 'interac' | 'pix'
  | 'upi' | 'mpesa' | 'skrill' | 'neteller' | 'western_union'
  | 'moneygram' | 'gift_card' | 'other';

export type SettlementMethod = PaymentMethod;

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  btc: 'Bitcoin',
  eth: 'Ethereum',
  usdt: 'USDT',
  usdc: 'USDC',
  sol: 'Solana',
  xrp: 'XRP',
  trx: 'TRON',
  ton: 'TON',
  cash: 'Cash (in person)',
  bank_transfer: 'Bank transfer',
  paypal: 'PayPal',
  wise: 'Wise',
  revolut: 'Revolut',
  zelle: 'Zelle',
  venmo: 'Venmo',
  sepa: 'SEPA',
  interac: 'Interac',
  pix: 'Pix',
  upi: 'UPI',
  mpesa: 'M-Pesa',
  skrill: 'Skrill',
  neteller: 'Neteller',
  western_union: 'Western Union',
  moneygram: 'MoneyGram',
  gift_card: 'Gift card',
  other: 'Other',
};

/** @deprecated Use PAYMENT_METHOD_LABELS instead */
export const SETTLEMENT_METHOD_LABELS = PAYMENT_METHOD_LABELS;

export type ReputationTier = 'new' | 'verified' | 'trusted' | 'elite';

export type ModerationStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';

export type OfferType = 'buy' | 'sell';
export type RateType = 'market' | 'fixed';
export type OfferStatus = 'active' | 'paused' | 'removed';
export type PriceSource = 'coingecko' | 'binance' | 'kraken';
export type CoinType = 'crypto' | 'fiat';

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  uptime_seconds: number;
  timestamp: string;
  services: {
    db: { ok: boolean; latency_ms: number };
    redis: { ok: boolean; latency_ms: number };
    minio: { ok: boolean; latency_ms: number };
  };
  price_feed: {
    last_update: string | null;
    stale: boolean;
  };
  stats: {
    users: number;
    active_offers: number;
    trades_today: number;
    contracts_created: number;
    active_users: number;
    total_messages: number;
    total_listings: number;
    active_listings: number;
    active_contracts: number;
    successful_contracts: number;
  };
}

export interface SystemMetrics {
  cpu_cores: number;
  cpu_percent_per_core: number[];
  ram_used_bytes: number;
  ram_total_bytes: number;
  ram_percent: number;
  disk_used_bytes: number;
  disk_total_bytes: number;
  disk_percent: number;
  disk_read_bytes_sec: number;
  disk_write_bytes_sec: number;
  net_rx_bytes_sec: number;
  net_tx_bytes_sec: number;
  load_avg: [number, number, number];
  uptime_seconds: number;
}

export interface MetricSample {
  timestamp: number;
  value: number;
}

export interface ResendQuota {
  sent: number;
  limit: number;
  resets_at: string;
}

export interface ApiPerformanceMetrics {
  resp_time_p50: number;
  resp_time_p95: number;
  req_rate: number;
  error_rate: number;
}

export interface InfraMetrics {
  redis_mem_bytes: number;
  pg_connections: number;
}

export interface DailyCount {
  date: string;
  count: number;
}

export interface GrowthData {
  users: DailyCount[];
  listings: DailyCount[];
  messages: DailyCount[];
  contracts: DailyCount[];
}

// ── Fiat currencies ─────────────────────────────────────────────────────────

export interface FiatCurrency {
  code: string;
  name: string;
  flag: string;
}

export const FIAT_CURRENCIES: FiatCurrency[] = [
  { code: 'USD', name: 'US Dollar', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', flag: '🇪🇺' },
  { code: 'ILS', name: 'Israeli Shekel', flag: '🇮🇱' },
  { code: 'GBP', name: 'British Pound', flag: '🇬🇧' },
  { code: 'CAD', name: 'Canadian Dollar', flag: '🇨🇦' },
  { code: 'AUD', name: 'Australian Dollar', flag: '🇦🇺' },
  { code: 'JPY', name: 'Japanese Yen', flag: '🇯🇵' },
  { code: 'CHF', name: 'Swiss Franc', flag: '🇨🇭' },
  { code: 'CNY', name: 'Chinese Yuan', flag: '🇨🇳' },
  { code: 'INR', name: 'Indian Rupee', flag: '🇮🇳' },
  { code: 'KRW', name: 'South Korean Won', flag: '🇰🇷' },
  { code: 'BRL', name: 'Brazilian Real', flag: '🇧🇷' },
  { code: 'MXN', name: 'Mexican Peso', flag: '🇲🇽' },
  { code: 'SGD', name: 'Singapore Dollar', flag: '🇸🇬' },
  { code: 'HKD', name: 'Hong Kong Dollar', flag: '🇭🇰' },
  { code: 'NOK', name: 'Norwegian Krone', flag: '🇳🇴' },
  { code: 'SEK', name: 'Swedish Krona', flag: '🇸🇪' },
  { code: 'DKK', name: 'Danish Krone', flag: '🇩🇰' },
  { code: 'PLN', name: 'Polish Zloty', flag: '🇵🇱' },
  { code: 'CZK', name: 'Czech Koruna', flag: '🇨🇿' },
  { code: 'HUF', name: 'Hungarian Forint', flag: '🇭🇺' },
  { code: 'RON', name: 'Romanian Leu', flag: '🇷🇴' },
  { code: 'TRY', name: 'Turkish Lira', flag: '🇹🇷' },
  { code: 'ZAR', name: 'South African Rand', flag: '🇿🇦' },
  { code: 'THB', name: 'Thai Baht', flag: '🇹🇭' },
  { code: 'TWD', name: 'Taiwan Dollar', flag: '🇹🇼' },
  { code: 'PHP', name: 'Philippine Peso', flag: '🇵🇭' },
  { code: 'IDR', name: 'Indonesian Rupiah', flag: '🇮🇩' },
  { code: 'MYR', name: 'Malaysian Ringgit', flag: '🇲🇾' },
  { code: 'VND', name: 'Vietnamese Dong', flag: '🇻🇳' },
  { code: 'AED', name: 'UAE Dirham', flag: '🇦🇪' },
  { code: 'SAR', name: 'Saudi Riyal', flag: '🇸🇦' },
  { code: 'ARS', name: 'Argentine Peso', flag: '🇦🇷' },
  { code: 'CLP', name: 'Chilean Peso', flag: '🇨🇱' },
  { code: 'COP', name: 'Colombian Peso', flag: '🇨🇴' },
  { code: 'PEN', name: 'Peruvian Sol', flag: '🇵🇪' },
  { code: 'NGN', name: 'Nigerian Naira', flag: '🇳🇬' },
  { code: 'KES', name: 'Kenyan Shilling', flag: '🇰🇪' },
  { code: 'EGP', name: 'Egyptian Pound', flag: '🇪🇬' },
  { code: 'PKR', name: 'Pakistani Rupee', flag: '🇵🇰' },
  { code: 'BDT', name: 'Bangladeshi Taka', flag: '🇧🇩' },
  { code: 'UAH', name: 'Ukrainian Hryvnia', flag: '🇺🇦' },
  { code: 'GEL', name: 'Georgian Lari', flag: '🇬🇪' },
  { code: 'AMD', name: 'Armenian Dram', flag: '🇦🇲' },
  { code: 'NZD', name: 'New Zealand Dollar', flag: '🇳🇿' },
  { code: 'ISK', name: 'Icelandic Krona', flag: '🇮🇸' },
];

export const VALID_FIAT_CODES = new Set(FIAT_CURRENCIES.map((c) => c.code));

const FIAT_FLAG_MAP = Object.fromEntries(FIAT_CURRENCIES.map((c) => [c.code, c.flag]));

export function getFiatFlag(code: string): string {
  return FIAT_FLAG_MAP[code] ?? '💱';
}

const FIAT_SYMBOL_MAP: Record<string, string> = {
  USD: '$', EUR: '€', ILS: '₪', GBP: '£', CAD: 'C$', AUD: 'A$',
  JPY: '¥', CHF: 'CHF', CNY: '¥', INR: '₹', KRW: '₩', BRL: 'R$',
  MXN: 'MX$', SGD: 'S$', HKD: 'HK$', NOK: 'kr', SEK: 'kr', DKK: 'kr',
  PLN: 'zł', CZK: 'Kč', HUF: 'Ft', RON: 'lei', TRY: '₺', ZAR: 'R',
  THB: '฿', TWD: 'NT$', PHP: '₱', IDR: 'Rp', MYR: 'RM', VND: '₫',
  AED: 'د.إ', SAR: '﷼', ARS: 'AR$', CLP: 'CL$', COP: 'CO$', PEN: 'S/.',
  NGN: '₦', KES: 'KSh', EGP: 'E£', PKR: '₨', BDT: '৳', UAH: '₴',
  GEL: '₾', AMD: '֏', NZD: 'NZ$', ISK: 'kr',
};

export function getFiatSymbol(code: string): string {
  return FIAT_SYMBOL_MAP[code] ?? code;
}
