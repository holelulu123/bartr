-- Email/password authentication support
-- email_hash: HMAC-SHA256(lowercase(email)) -- allows fast lookup without decrypting
-- google_id is now nullable (email-only users have no google_id)
-- auth_provider tracks how the account was created

DO $$ BEGIN
  ALTER TABLE users ALTER COLUMN google_id DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_hash TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'google';

-- Backfill auth_provider for existing google users
UPDATE users SET auth_provider = 'google' WHERE google_id IS NOT NULL AND auth_provider = 'google';

CREATE INDEX IF NOT EXISTS users_email_hash_idx ON users (email_hash);
