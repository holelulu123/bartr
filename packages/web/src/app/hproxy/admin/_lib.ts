import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';

const API_URL = process.env.API_URL || 'http://localhost:4000';

export const HEALTH_SESSION_COOKIE = 'admin_session';

const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export function apiHealthUrl(path: string): string {
  return `${API_URL}${path}`;
}

/** Headers for server-to-server health API calls (service key auth). */
export function serviceHeaders(): Record<string, string> {
  const key = process.env.HEALTH_SERVICE_KEY;
  return key ? { 'X-Service-Key': key } : {};
}

/** Normalize PEM stored in env var — replace literal \n with real newlines. */
export function normalizePem(pem: string): string {
  return pem.replace(/\\n/g, '\n');
}

function getSigningKey(): string {
  const key = process.env.HEALTH_PUBLIC_KEY;
  if (!key) throw new Error('HEALTH_PUBLIC_KEY is not configured');
  return key;
}

export function createSessionToken(): string {
  const ts = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = `${ts}:${nonce}`;
  const sig = crypto.createHmac('sha256', getSigningKey()).update(payload).digest('hex');
  return `${payload}:${sig}`;
}

export function verifyHealthSession(request: NextRequest): boolean {
  const cookie = request.cookies.get(HEALTH_SESSION_COOKIE);
  if (!cookie?.value) return false;

  // Format: timestamp:nonce:signature
  const parts = cookie.value.split(':');
  if (parts.length !== 3) return false;

  const [ts, nonce, sig] = parts;

  // Check expiry
  const tokenAge = Date.now() - parseInt(ts, 10);
  if (isNaN(tokenAge) || tokenAge < 0 || tokenAge > SESSION_MAX_AGE_MS) return false;

  const payload = `${ts}:${nonce}`;
  let expected: string;
  try {
    expected = crypto.createHmac('sha256', getSigningKey()).update(payload).digest('hex');
  } catch {
    return false;
  }

  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}
