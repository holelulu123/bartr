export const APP_NAME = 'Bartr';

export type ListingStatus = 'active' | 'paused' | 'sold' | 'removed';

export type TradeStatus = 'offered' | 'accepted' | 'completed' | 'declined' | 'cancelled';

export type PaymentMethod = 'btc' | 'eth' | 'usdt' | 'usdc' | 'cash' | 'bank_transfer';

export type SettlementMethod =
  | 'cash' | 'bank_transfer' | 'paypal' | 'wise' | 'revolut'
  | 'zelle' | 'venmo' | 'sepa' | 'interac' | 'pix'
  | 'upi' | 'mpesa' | 'skrill' | 'neteller' | 'western_union'
  | 'moneygram' | 'gift_card' | 'other';

export const SETTLEMENT_METHOD_LABELS: Record<SettlementMethod, string> = {
  cash: 'Cash',
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
