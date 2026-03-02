-- Max exchange offers per user (NULL = unlimited)
DO $$ BEGIN
  ALTER TABLE users ADD COLUMN max_exchange_offers INTEGER DEFAULT NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
