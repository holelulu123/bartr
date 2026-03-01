import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';
import { signAccessToken, signRefreshToken, verifyToken } from '../lib/jwt.js';

function testEmailHmac(email: string): string {
  const raw = process.env.ENCRYPTION_KEY;
  const key = raw
    ? Buffer.from(raw, 'hex')
    : Buffer.from('bartr-dev-encryption-key-32bytes!'.padEnd(32).slice(0, 32));
  return crypto.createHmac('sha256', key).update(email.toLowerCase().trim()).digest('hex');
}

// Every register call must include key blobs
const TEST_KEYS = {
  public_key: 'MCowBQYDK2VuAyEAtest_public_key_base64',
  private_key_blob: Buffer.from('encrypted_private_key').toString('base64'),
  recovery_key_blob: Buffer.from('recovery_wrapped_key').toString('base64'),
};

// Helper: register a user via email and return tokens
async function registerEmailUser(
  app: FastifyInstance,
  email: string,
  password = 'securepassword123',
): Promise<{ access_token: string; refresh_token: string }> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register/email',
    payload: { email, password, ...TEST_KEYS },
  });
  return res.json();
}

describe('Auth routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ skipRateLimit: true });
    await app.ready();
  });

  // Email addresses used in tests — compute HMACs so we only delete these specific users
  const TEST_EMAILS = [
    'newuser@example.com', 'short@example.com', 'dupe@example.com',
    'nokeys@example.com', 'logintest@example.com', 'rolecheck@example.com',
    'refresh@example.com', 'logout@example.com', 'me@example.com',
    'e2ekeys@example.com',
  ];
  const TEST_EMAIL_HASHES = TEST_EMAILS.map(testEmailHmac);

  async function cleanupTestUsers() {
    if (TEST_EMAIL_HASHES.length > 0) {
      await app.pg.query("DELETE FROM reputation_scores WHERE user_id IN (SELECT id FROM users WHERE email_hash = ANY($1))", [TEST_EMAIL_HASHES]);
      await app.pg.query('DELETE FROM users WHERE email_hash = ANY($1)', [TEST_EMAIL_HASHES]);
    }
    await app.pg.query('DELETE FROM refresh_tokens WHERE user_id NOT IN (SELECT id FROM users)');
  }

  afterAll(async () => {
    await cleanupTestUsers();
    await app.close();
  });

  beforeEach(async () => {
    await cleanupTestUsers();
  });

  // ── GET /auth/key-blobs ────────────────────────────────────────────────────

  describe('GET /auth/key-blobs', () => {
    it('requires authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/auth/key-blobs',
      });

      expect(res.statusCode).toBe(401);
    });

    it('stores key blobs and returns them via GET /auth/key-blobs', async () => {
      const { access_token } = await registerEmailUser(app, 'e2ekeys@example.com');

      const keyRes = await app.inject({
        method: 'GET',
        url: '/auth/key-blobs',
        headers: { authorization: `Bearer ${access_token}` },
      });

      expect(keyRes.statusCode).toBe(200);
      const keys = keyRes.json();
      expect(keys.public_key).toBe(TEST_KEYS.public_key);
      expect(keys.private_key_blob).toBe(TEST_KEYS.private_key_blob);
      expect(keys.recovery_key_blob).toBe(TEST_KEYS.recovery_key_blob);
    });
  });

  // ── POST /auth/refresh ─────────────────────────────────────────────────────

  describe('POST /auth/refresh', () => {
    it('rotates refresh token and returns new tokens', async () => {
      const { refresh_token } = await registerEmailUser(app, 'refresh@example.com');

      const res = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refresh_token },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.access_token).toBeDefined();
      expect(body.refresh_token).toBeDefined();
      expect(body.refresh_token).not.toBe(refresh_token);

      const oldRes = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refresh_token },
      });
      expect(oldRes.statusCode).toBe(401);
    });

    it('rejects invalid refresh token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refresh_token: 'totally.invalid.token' },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // ── POST /auth/logout ──────────────────────────────────────────────────────

  describe('POST /auth/logout', () => {
    it('revokes refresh token', async () => {
      const { refresh_token } = await registerEmailUser(app, 'logout@example.com');

      const logoutRes = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        payload: { refresh_token },
      });

      expect(logoutRes.statusCode).toBe(200);
      expect(logoutRes.json().ok).toBe(true);

      const refreshRes = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refresh_token },
      });
      expect(refreshRes.statusCode).toBe(401);
    });
  });

  // ── GET /auth/me ───────────────────────────────────────────────────────────

  describe('GET /auth/me', () => {
    it('returns user info with valid token', async () => {
      const { access_token } = await registerEmailUser(app, 'me@example.com');

      const res = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { authorization: `Bearer ${access_token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.nickname).toBeTruthy();
      expect(body.id).toBeDefined();
    });

    it('rejects request without token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/auth/me',
      });

      expect(res.statusCode).toBe(401);
    });

    it('rejects request with invalid token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { authorization: 'Bearer invalid.token.here' },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // ── POST /auth/register/email ──────────────────────────────────────────────

  describe('POST /auth/register/email', () => {
    it('creates a new user and auto-assigns a nickname', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register/email',
        payload: {
          email: 'newuser@example.com',
          password: 'securepassword123',
          ...TEST_KEYS,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.access_token).toBeDefined();
      expect(body.refresh_token).toBeDefined();

      // Nickname is auto-generated — verify it exists in the token
      const payload = await verifyToken(body.access_token);
      expect(payload.nickname).toBeTruthy();
      expect(typeof payload.nickname).toBe('string');
    });

    it('embeds role=user in the access token for new registrations', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register/email',
        payload: {
          email: 'rolecheck@example.com',
          password: 'securepassword123',
          ...TEST_KEYS,
        },
      });

      expect(res.statusCode).toBe(201);
      const payload = await verifyToken(res.json().access_token);
      expect(payload.role).toBe('user');
    });

    it('rejects missing email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register/email',
        payload: { password: 'securepassword123', ...TEST_KEYS },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects short password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register/email',
        payload: {
          email: 'short@example.com',
          password: 'short',
          ...TEST_KEYS,
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects duplicate email', async () => {
      const payload = {
        email: 'dupe@example.com',
        password: 'securepassword123',
        ...TEST_KEYS,
      };
      await app.inject({ method: 'POST', url: '/auth/register/email', payload });
      const res = await app.inject({ method: 'POST', url: '/auth/register/email', payload });
      expect(res.statusCode).toBe(409);
      expect(res.json().error).toMatch(/email already registered/i);
    });

    it('allows registration without key blobs (non-HTTPS clients)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register/email',
        payload: { email: 'nokeys@example.com', password: 'securepassword123' },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toHaveProperty('access_token');
    });
  });

  // ── POST /auth/login/email ─────────────────────────────────────────────────

  describe('POST /auth/login/email', () => {
    beforeEach(async () => {
      await app.inject({
        method: 'POST',
        url: '/auth/register/email',
        payload: {
          email: 'logintest@example.com',
          password: 'correctpassword123',
          ...TEST_KEYS,
        },
      });
    });

    it('returns tokens for valid credentials', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login/email',
        payload: { email: 'logintest@example.com', password: 'correctpassword123' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.access_token).toBeDefined();
      expect(body.refresh_token).toBeDefined();
    });

    it('is case-insensitive for email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login/email',
        payload: { email: 'LOGINTEST@EXAMPLE.COM', password: 'correctpassword123' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('rejects wrong password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login/email',
        payload: { email: 'logintest@example.com', password: 'wrongpassword' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects unknown email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login/email',
        payload: { email: 'nobody@example.com', password: 'anypassword123' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects missing fields', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login/email',
        payload: { email: 'logintest@example.com' },
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
