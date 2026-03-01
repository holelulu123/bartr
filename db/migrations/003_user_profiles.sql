-- Add profile fields to users
DO $$ BEGIN
  ALTER TABLE users ADD COLUMN bio TEXT DEFAULT '';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN avatar_key TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
