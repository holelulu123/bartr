-- 011_exchange_offers.sql
-- Crypto exchange module: supported coins + exchange offers

-- Supported coins table (crypto + fiat)
CREATE TABLE IF NOT EXISTS supported_coins (
  symbol TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  coin_type TEXT NOT NULL CHECK (coin_type IN ('crypto', 'fiat')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Seed crypto
INSERT INTO supported_coins (symbol, name, coin_type, sort_order) VALUES
  ('BTC', 'Bitcoin', 'crypto', 1),
  ('ETH', 'Ethereum', 'crypto', 2),
  ('USDT', 'Tether', 'crypto', 3),
  ('USDC', 'USD Coin', 'crypto', 4),
  ('SOL', 'Solana', 'crypto', 5),
  ('BNB', 'BNB', 'crypto', 6),
  ('XRP', 'XRP', 'crypto', 7),
  ('ADA', 'Cardano', 'crypto', 8),
  ('DOGE', 'Dogecoin', 'crypto', 9),
  ('LTC', 'Litecoin', 'crypto', 10),
  ('DOT', 'Polkadot', 'crypto', 11),
  ('AVAX', 'Avalanche', 'crypto', 12),
  ('MATIC', 'Polygon', 'crypto', 13),
  ('LINK', 'Chainlink', 'crypto', 14),
  ('ATOM', 'Cosmos', 'crypto', 15),
  ('UNI', 'Uniswap', 'crypto', 16),
  ('APT', 'Aptos', 'crypto', 17),
  ('ARB', 'Arbitrum', 'crypto', 18);

-- Seed fiat (USD, EUR, ILS first, then alphabetical)
INSERT INTO supported_coins (symbol, name, coin_type, sort_order) VALUES
  ('USD', 'US Dollar', 'fiat', 100),
  ('EUR', 'Euro', 'fiat', 101),
  ('ILS', 'Israeli Shekel', 'fiat', 102),
  ('GBP', 'British Pound', 'fiat', 103),
  ('CAD', 'Canadian Dollar', 'fiat', 104),
  ('AUD', 'Australian Dollar', 'fiat', 105),
  ('JPY', 'Japanese Yen', 'fiat', 106),
  ('CHF', 'Swiss Franc', 'fiat', 107),
  ('CNY', 'Chinese Yuan', 'fiat', 108),
  ('INR', 'Indian Rupee', 'fiat', 109),
  ('KRW', 'South Korean Won', 'fiat', 110),
  ('BRL', 'Brazilian Real', 'fiat', 111),
  ('MXN', 'Mexican Peso', 'fiat', 112),
  ('SEK', 'Swedish Krona', 'fiat', 113),
  ('NOK', 'Norwegian Krone', 'fiat', 114),
  ('DKK', 'Danish Krone', 'fiat', 115),
  ('PLN', 'Polish Zloty', 'fiat', 116),
  ('CZK', 'Czech Koruna', 'fiat', 117),
  ('HUF', 'Hungarian Forint', 'fiat', 118),
  ('RON', 'Romanian Leu', 'fiat', 119),
  ('TRY', 'Turkish Lira', 'fiat', 120),
  ('ZAR', 'South African Rand', 'fiat', 121),
  ('AED', 'UAE Dirham', 'fiat', 122),
  ('SAR', 'Saudi Riyal', 'fiat', 123),
  ('SGD', 'Singapore Dollar', 'fiat', 124),
  ('HKD', 'Hong Kong Dollar', 'fiat', 125),
  ('TWD', 'Taiwan Dollar', 'fiat', 126),
  ('THB', 'Thai Baht', 'fiat', 127),
  ('NZD', 'New Zealand Dollar', 'fiat', 128),
  ('RUB', 'Russian Ruble', 'fiat', 129),
  ('UAH', 'Ukrainian Hryvnia', 'fiat', 130),
  ('NGN', 'Nigerian Naira', 'fiat', 131),
  ('ARS', 'Argentine Peso', 'fiat', 132),
  ('CLP', 'Chilean Peso', 'fiat', 133),
  ('COP', 'Colombian Peso', 'fiat', 134),
  ('PHP', 'Philippine Peso', 'fiat', 135),
  ('IDR', 'Indonesian Rupiah', 'fiat', 136),
  ('MYR', 'Malaysian Ringgit', 'fiat', 137),
  ('VND', 'Vietnamese Dong', 'fiat', 138),
  ('PKR', 'Pakistani Rupee', 'fiat', 139),
  ('BGN', 'Bulgarian Lev', 'fiat', 140),
  ('HRK', 'Croatian Kuna', 'fiat', 141),
  ('KES', 'Kenyan Shilling', 'fiat', 142),
  ('GHS', 'Ghanaian Cedi', 'fiat', 143),
  ('EGP', 'Egyptian Pound', 'fiat', 144),
  ('MAD', 'Moroccan Dirham', 'fiat', 145);

-- Exchange offers table
CREATE TABLE IF NOT EXISTS exchange_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offer_type TEXT NOT NULL CHECK (offer_type IN ('buy', 'sell')),
  crypto_currency TEXT NOT NULL REFERENCES supported_coins(symbol),
  fiat_currency TEXT NOT NULL REFERENCES supported_coins(symbol),
  amount NUMERIC(20, 8),
  min_amount NUMERIC(20, 8),
  max_amount NUMERIC(20, 8),
  rate_type TEXT NOT NULL CHECK (rate_type IN ('market', 'fixed')),
  margin_percent NUMERIC(6, 2) DEFAULT 0,
  fixed_price NUMERIC(20, 2),
  payment_methods JSONB NOT NULL DEFAULT '[]',
  country_code TEXT,
  terms TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for exchange_offers
CREATE INDEX idx_exchange_offers_user_id ON exchange_offers(user_id);
CREATE INDEX idx_exchange_offers_offer_type ON exchange_offers(offer_type);
CREATE INDEX idx_exchange_offers_crypto ON exchange_offers(crypto_currency);
CREATE INDEX idx_exchange_offers_fiat ON exchange_offers(fiat_currency);
CREATE INDEX idx_exchange_offers_status ON exchange_offers(status);
CREATE INDEX idx_exchange_offers_country ON exchange_offers(country_code);

-- Add offer_id to message_threads (parallel to listing_id)
ALTER TABLE message_threads ADD COLUMN IF NOT EXISTS offer_id UUID REFERENCES exchange_offers(id);

-- Make listing_id nullable on trades, add offer_id
ALTER TABLE trades ALTER COLUMN listing_id DROP NOT NULL;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS offer_id UUID REFERENCES exchange_offers(id);

-- Ensure at least one of listing_id or offer_id is set on trades
ALTER TABLE trades ADD CONSTRAINT trades_source_check
  CHECK (listing_id IS NOT NULL OR offer_id IS NOT NULL);
