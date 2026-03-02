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
