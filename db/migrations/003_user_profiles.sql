-- Add profile fields to users
ALTER TABLE users ADD COLUMN bio TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN avatar_key TEXT;
