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

// Helper: insert a user row directly as if OAuth callback had run
async function createOAuthUser(
  app: FastifyInstance,
  googleId: string,
  nickname: string,
): Promise<string> {
  const result = await app.pg.query(
    `INSERT INTO users (google_id, nickname, auth_provider)
     VALUES ($1, $2, 'google')
     RETURNING id`,
    [googleId, nickname],
  );
  await app.pg.query('INSERT INTO reputation_scores (user_id) VALUES ($1)', [result.rows[0].id]);
  return result.rows[0].id;
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
  ];
  const TEST_EMAIL_HASHES = TEST_EMAILS.map(testEmailHmac);

  async function cleanupTestUsers() {
    // Delete OAuth test users by nickname prefix
    await app.pg.query("DELETE FROM reputation_scores WHERE user_id IN (SELECT id FROM users WHERE nickname LIKE 'testuser_%')");
    await app.pg.query("DELETE FROM users WHERE nickname LIKE 'testuser_%'");
    // Delete email test users by their specific email hashes only
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

  // ── POST /auth/register (Google — set password + keys after OAuth) ──────────

  describe('POST /auth/register', () => {
    it('sets password + key blobs for a Google user created by OAuth callback', async () => {
      await createOAuthUser(app, 'google_test_123', 'testuser_one');

      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          google_id: 'google_test_123',
          password: 'securepassword123',
          ...TEST_KEYS,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.access_token).toBeDefined();
      expect(body.refresh_token).toBeDefined();

      const payload = await verifyToken(body.access_token);
      expect(payload.nickname).toBe('testuser_one');
    });

    it('rejects short password', async () => {
      await createOAuthUser(app, 'google_test_456', 'testuser_two');

      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          google_id: 'google_test_456',
          password: 'short',
          ...TEST_KEYS,
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('8 characters');
    });

    it('rejects registration without key blobs', async () => {
      await createOAuthUser(app, 'google_nokeys_test', 'testuser_nokeys');

      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          google_id: 'google_nokeys_test',
          password: 'securepassword123',
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('required');
    });

    it('returns 404 for unknown google_id', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          google_id: 'nonexistent_google_id',
          password: 'securepassword123',
          ...TEST_KEYS,
        },
      });

      expect(res.statusCode).toBe(404);
    });

    it('rejects missing google_id', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { password: 'securepassword123', ...TEST_KEYS },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // ── POST /auth/register — E2E key blobs ────────────────────────────────────

  describe('POST /auth/register — E2E key blobs', () => {
    it('stores key blobs and returns them via GET /auth/key-blobs', async () => {
      await createOAuthUser(app, 'google_e2e_test', 'testuser_e2e');

      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          google_id: 'google_e2e_test',
          password: 'securepassword123',
          ...TEST_KEYS,
        },
      });

      expect(res.statusCode).toBe(201);
      const { access_token } = res.json();

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

  // ── GET /auth/key-blobs ────────────────────────────────────────────────────

  describe('GET /auth/key-blobs', () => {
    it('requires authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/auth/key-blobs',
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // ── POST /auth/refresh ─────────────────────────────────────────────────────

  describe('POST /auth/refresh', () => {
    it('rotates refresh token and returns new tokens', async () => {
      await createOAuthUser(app, 'google_refresh_test', 'testuser_refresh');

      const regRes = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          google_id: 'google_refresh_test',
          password: 'securepassword123',
          ...TEST_KEYS,
        },
      });

      const { refresh_token } = regRes.json();

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
      await createOAuthUser(app, 'google_logout_test', 'testuser_logout');

      const regRes = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          google_id: 'google_logout_test',
          password: 'securepassword123',
          ...TEST_KEYS,
        },
      });

      const { refresh_token } = regRes.json();

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
      await createOAuthUser(app, 'google_me_test', 'testuser_me');

      const regRes = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          google_id: 'google_me_test',
          password: 'securepassword123',
          ...TEST_KEYS,
        },
      });

      const { access_token } = regRes.json();

      const res = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { authorization: `Bearer ${access_token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.nickname).toBe('testuser_me');
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

    it('rejects missing key blobs', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register/email',
        payload: { email: 'nokeys@example.com', password: 'securepassword123' },
      });
      expect(res.statusCode).toBe(400);
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
