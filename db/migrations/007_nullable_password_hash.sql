-- Google users no longer need a password hash at insert time.
-- They set it in a second step (POST /auth/register) after OAuth.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
