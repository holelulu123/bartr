import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';

const API_URL = process.env.API_URL || 'http://localhost:4000';

export const HEALTH_SESSION_COOKIE = 'health_session';

export function apiHealthUrl(path: string): string {
  return `${API_URL}${path}`;
}

/** Normalize PEM stored in env var — replace literal \n with real newlines. */
export function normalizePem(pem: string): string {
  return pem.replace(/\\n/g, '\n');
}

function getSigningKey(): string {
  return process.env.HEALTH_PUBLIC_KEY || 'dev-health-key';
}

export function createSessionToken(): string {
  const ts = Date.now().toString();
  const sig = crypto.createHmac('sha256', getSigningKey()).update(ts).digest('hex');
  return `${ts}:${sig}`;
}

export function verifyHealthSession(request: NextRequest): boolean {
  const cookie = request.cookies.get(HEALTH_SESSION_COOKIE);
  if (!cookie?.value) return false;

  const colonIdx = cookie.value.indexOf(':');
  if (colonIdx === -1) return false;

  const ts = cookie.value.slice(0, colonIdx);
  const sig = cookie.value.slice(colonIdx + 1);

  const expected = crypto.createHmac('sha256', getSigningKey()).update(ts).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}
