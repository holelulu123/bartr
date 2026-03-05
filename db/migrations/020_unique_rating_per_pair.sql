-- Migration 020: One rating per user pair (not per trade)
-- If X rates Y on trade 1, X cannot rate Y again on trade 2.

ALTER TABLE ratings
  DROP CONSTRAINT IF EXISTS ratings_trade_id_from_user_id_key;

ALTER TABLE ratings
  ADD CONSTRAINT ratings_from_to_unique UNIQUE (from_user_id, to_user_id);
