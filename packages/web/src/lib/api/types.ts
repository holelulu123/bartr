import type { ListingStatus, TradeStatus, PaymentMethod, ReputationTier, ModerationStatus, OfferType, RateType, OfferStatus, CoinType, PriceSource } from '@bartr/shared';

// Common
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface PaginatedResponse<T> {
  pagination: Pagination;
  [key: string]: T[] | Pagination;
}

// Auth
export interface TokenPair {
  access_token: string;
  refresh_token: string;
}

export interface CurrentUser {
  id: string;
  nickname: string;
  created_at: string;
  last_active: string;
  role?: string;
}

export interface RegisterPayload {
  google_id: string;
  password: string;
  public_key: string;
  private_key_blob: string;
  recovery_key_blob: string;
}

export interface KeyBlobs {
  public_key: string | null;
  private_key_blob: string | null;
  recovery_key_blob: string | null;
}

// Users
export interface UserProfile {
  id: string;
  nickname: string;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
  last_active: string;
  reputation: {
    composite_score: number;
    rating_avg: number;
    tier: ReputationTier;
  };
}

export interface UpdateProfilePayload {
  nickname?: string;
  bio?: string;
}

// Listings
export interface ListingSummary {
  id: string;
  title: string;
  price_indication: string | null;
  currency: string | null;
  payment_methods: PaymentMethod[];
  country_code: string | null;
  status: ListingStatus;
  created_at: string;
  seller_nickname: string;
  category_name: string | null;
  category_slug: string | null;
  thumbnail: string | null;
}

export interface ListingDetail {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category_id: number | null;
  payment_methods: PaymentMethod[];
  price_indication: string | null;
  currency: string | null;
  country_code: string | null;
  status: ListingStatus;
  created_at: string;
  updated_at: string;
  seller_nickname: string;
  category_name: string | null;
  category_slug: string | null;
  images: ListingImage[];
}

export interface ListingImage {
  id: string;
  storage_key: string;
  order_index: number;
}

export interface CreateListingPayload {
  title: string;
  description: string;
  category_id?: number;
  payment_methods: PaymentMethod[];
  price_indication?: string;
  currency?: string;
  country_code?: string;
}

export interface UpdateListingPayload {
  title?: string;
  description?: string;
  category_id?: number;
  payment_methods?: PaymentMethod[];
  price_indication?: string;
  currency?: string;
  country_code?: string | null;
  status?: ListingStatus;
}

export interface ListingsResponse {
  listings: ListingSummary[];
  pagination: Pagination;
}

export interface ListingsFilter {
  q?: string;
  category?: string;
  payment_method?: PaymentMethod;
  country_code?: string;
  status?: ListingStatus;
  user_id?: string;
  page?: number;
  limit?: number;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
}

// Trades
export interface Trade {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  status: TradeStatus;
  created_at: string;
  updated_at: string;
}

export interface TradeSummary extends Trade {
  listing_title: string;
  buyer_nickname: string;
  seller_nickname: string;
}

export interface TradeEvent {
  id: string;
  event_type: string;
  created_by: string;
  created_at: string;
}

export interface TradeDetail extends TradeSummary {
  events: TradeEvent[];
}

export interface TradesResponse {
  trades: TradeSummary[];
  pagination: Pagination;
}

export interface TradesFilter {
  role?: 'buyer' | 'seller';
  status?: TradeStatus;
  page?: number;
  limit?: number;
}

export interface CompleteTradeResponse {
  id: string;
  status: TradeStatus;
  message: string;
}

// Ratings
export interface Rating {
  id: string;
  trade_id: string;
  from_user_id: string;
  to_user_id: string;
  score: number;
  comment: string | null;
  created_at: string;
}

export interface RateTradePayload {
  score: number;
  comment?: string;
}

export interface UserRatingsResponse {
  ratings: Rating[];
  pagination: Pagination;
}

// Messages
export interface MessageThread {
  id: string;
  listing_id: string | null;
  created_at: string;
  participant_1_nickname: string;
  participant_2_nickname: string;
  listing_title: string | null;
  last_message_at: string | null;
  last_sender_nickname: string | null;
}

export interface Message {
  id: string;
  sender_id: string;
  sender_nickname: string;
  recipient_id: string;
  body_encrypted: string;  // base64 ciphertext — decrypt client-side
  created_at: string;
}

export interface ThreadsResponse {
  threads: MessageThread[];
  pagination: Pagination;
}

export interface MessagesResponse {
  messages: Message[];
  pagination: Pagination;
}

export interface CreateThreadPayload {
  recipient_nickname: string;
  listing_id?: string;
}

// Moderation
export interface Flag {
  id: string;
  target_type: 'listing' | 'user' | 'message';
  target_id: string;
  reason: string;
  status: ModerationStatus;
  created_at: string;
}

export interface CreateFlagPayload {
  target_type: 'listing' | 'user' | 'message';
  target_id: string;
  reason: string;
}

export interface AdminFlag extends Flag {
  reporter_nickname: string;
}

export interface AdminFlagsResponse {
  flags: AdminFlag[];
  pagination: Pagination;
}

export interface ModerationCheckResponse {
  allowed: boolean;
  blocked_keyword: string | null;
}

// Exchange
export interface SupportedCoin {
  symbol: string;
  name: string;
  coin_type: CoinType;
  is_active: boolean;
  sort_order: number;
}

export interface ExchangeOffer {
  id: string;
  user_id: string;
  offer_type: OfferType;
  crypto_currency: string;
  fiat_currency: string;
  amount: number | null;
  min_amount: number;
  max_amount: number;
  rate_type: RateType;
  margin_percent: number;
  fixed_price: number | null;
  payment_methods: PaymentMethod[];
  country_code: string | null;
  terms: string | null;
  price_source: PriceSource;
  status: OfferStatus;
  created_at: string;
  updated_at: string;
  seller_nickname: string;
}

export interface CreateOfferPayload {
  offer_type: OfferType;
  crypto_currency: string;
  fiat_currency: string;
  amount?: number;
  min_amount: number;
  max_amount: number;
  rate_type: RateType;
  margin_percent?: number;
  fixed_price?: number;
  payment_methods: PaymentMethod[];
  country_code?: string;
  terms?: string;
  price_source?: PriceSource;
}

export interface UpdateOfferPayload {
  amount?: number | null;
  min_amount?: number | null;
  max_amount?: number | null;
  rate_type?: RateType;
  margin_percent?: number;
  fixed_price?: number | null;
  payment_methods?: PaymentMethod[];
  country_code?: string | null;
  terms?: string | null;
  status?: OfferStatus;
}

export interface OffersFilter {
  offer_type?: OfferType;
  crypto_currency?: string;
  fiat_currency?: string;
  payment_method?: PaymentMethod;
  country_code?: string;
  user_id?: string;
  page?: number;
  limit?: number;
}

export interface OffersResponse {
  offers: ExchangeOffer[];
  pagination: Pagination;
}

export interface PriceData {
  [crypto: string]: {
    [fiat: string]: number;
  } | string; // updated_at is a string
}

export interface ExchangePricesResponse {
  coingecko: PriceData | null;
  binance: PriceData | null;
  kraken: PriceData | null;
}

export interface SupportedCoinsResponse {
  coins: SupportedCoin[];
}
