import crypto from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { HEALTH_SESSION_COOKIE, createSessionToken, normalizePem } from '../_lib';

const COOLDOWN_MS = 30_000;
const failedAttempts = new Map<string, number>();

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  // Check cooldown
  const lastFailure = failedAttempts.get(ip);
  if (lastFailure) {
    const elapsed = Date.now() - lastFailure;
    if (elapsed < COOLDOWN_MS) {
      const retryAfter = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      return NextResponse.json(
        { error: `Too many attempts, try again in ${retryAfter} seconds` },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } },
      );
    }
    failedAttempts.delete(ip);
  }

  let privateKeyPem: string;
  try {
    const body = await request.json();
    privateKeyPem = (body.privateKey || '').trim();
    if (!privateKeyPem) throw new Error('missing');
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const publicKeyPem = normalizePem(process.env.HEALTH_PUBLIC_KEY || '');
  if (!publicKeyPem) {
    return NextResponse.json({ error: 'Health auth not configured' }, { status: 500 });
  }

  // Verify: sign a challenge with the submitted private key,
  // then verify the signature against the stored public key.
  try {
    const challenge = Buffer.from('health-auth-verify');
    const signature = crypto.sign(null, challenge, privateKeyPem);
    const valid = crypto.verify(null, challenge, publicKeyPem, signature);

    if (!valid) {
      failedAttempts.set(ip, Date.now());
      return NextResponse.json({ error: 'Invalid key' }, { status: 401 });
    }
  } catch {
    failedAttempts.set(ip, Date.now());
    return NextResponse.json({ error: 'Invalid key' }, { status: 401 });
  }

  // Success
  failedAttempts.delete(ip);

  const token = createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(HEALTH_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  });
  return res;
}
