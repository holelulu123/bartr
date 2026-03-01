import crypto from 'node:crypto';

/** Generate a random 6-digit verification code. */
export function generateVerificationCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** SHA-256 hash a verification code (mirrors refresh-token hashing pattern). */
export function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}
