-- Migration 005: E2E encryption key storage
-- Adds per-user keypair fields for end-to-end encrypted messaging.
--
-- public_key:         X25519 public key, base64-encoded. Visible to other users
--                     (needed to encrypt messages to this user).
-- private_key_blob:   X25519 private key wrapped with a key derived from the
--                     user's password (PBKDF2). Server cannot decrypt this.
-- recovery_key_blob:  Same private key wrapped with a random recovery key shown
--                     to the user once at registration. Allows key recovery if
--                     password is forgotten.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS public_key TEXT,
  ADD COLUMN IF NOT EXISTS private_key_blob BYTEA,
  ADD COLUMN IF NOT EXISTS recovery_key_blob BYTEA;

COMMENT ON COLUMN users.public_key IS 'X25519 public key (base64). Used by other users to encrypt messages to this user.';
COMMENT ON COLUMN users.private_key_blob IS 'X25519 private key wrapped with password-derived key (AES-KW). Server cannot decrypt.';
COMMENT ON COLUMN users.recovery_key_blob IS 'X25519 private key wrapped with recovery key (AES-KW). Allows password-less key recovery.';
