-- 018_trade_proposal_fields.sql
-- Add structured trade proposal fields for exchange offer trades.
-- Nullable — only exchange-offer trades populate these; listing trades don't.

ALTER TABLE trades ADD COLUMN IF NOT EXISTS fiat_amount NUMERIC(20, 2);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS payment_method TEXT;
