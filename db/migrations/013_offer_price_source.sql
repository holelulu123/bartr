-- 013_offer_price_source.sql
-- Add price_source column and make min/max amounts required

-- Backfill NULLs to 0 before adding NOT NULL constraint
UPDATE exchange_offers SET min_amount = 0 WHERE min_amount IS NULL;
UPDATE exchange_offers SET max_amount = 0 WHERE max_amount IS NULL;

-- Add price_source column
DO $$ BEGIN
  ALTER TABLE exchange_offers
    ADD COLUMN price_source TEXT NOT NULL DEFAULT 'coingecko'
    CHECK (price_source IN ('coingecko', 'binance', 'kraken'));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Make min/max amount required (idempotent: SET NOT NULL on already NOT NULL column is a no-op)
ALTER TABLE exchange_offers ALTER COLUMN min_amount SET NOT NULL;
ALTER TABLE exchange_offers ALTER COLUMN max_amount SET NOT NULL;
