export const APP_NAME = 'Bartr';

export type ListingStatus = 'active' | 'paused' | 'sold' | 'removed';

export type TradeStatus = 'offered' | 'accepted' | 'completed' | 'declined' | 'cancelled';

export type PaymentMethod = 'btc' | 'eth' | 'usdt' | 'usdc' | 'cash' | 'bank_transfer';

export type ReputationTier = 'new' | 'verified' | 'trusted' | 'elite';

export type ModerationStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';

export type OfferType = 'buy' | 'sell';
export type RateType = 'market' | 'fixed';
export type OfferStatus = 'active' | 'paused' | 'removed';
export type CoinType = 'crypto' | 'fiat';

export interface HealthResponse {
  status: 'ok' | 'error';
  db: boolean;
  redis: boolean;
}
