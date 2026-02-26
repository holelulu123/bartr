import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';
import { signAccessToken, signRefreshToken, verifyToken } from '../lib/jwt.js';
import crypto from 'node:crypto';

describe('Auth routes', () => {
  let app: FastifyInstance;
  let testUserId: string;

  beforeAll(async () => {
    app = await buildApp({ skipRateLimit: true });
    await app.ready();
  });

  afterAll(async () => {
    // Clean up test data
    await app.pg.query("DELETE FROM users WHERE nickname LIKE 'testuser_%'");
    await app.close();
  });

  beforeEach(async () => {
    // Clean test users between tests
    await app.pg.query("DELETE FROM users WHERE nickname LIKE 'testuser_%'");
    await app.pg.query('DELETE FROM refresh_tokens WHERE user_id NOT IN (SELECT id FROM users)');
  });

  describe('POST /auth/register', () => {
    it('creates a new user with valid data', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          google_id: 'google_test_123',
          email: 'test@example.com',
          nickname: 'testuser_one',
          password: 'securepassword123',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.access_token).toBeDefined();
      expect(body.refresh_token).toBeDefined();

      // Verify the access token is valid
      const payload = await verifyToken(body.access_token);
      expect(payload.nickname).toBe('testuser_one');
    });

    it('rejects short nickname', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          google_id: 'google_test_456',
          email: 'test2@example.com',
          nickname: 'ab',
          password: 'securepassword123',
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('3-30');
    });

    it('rejects short password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          google_id: 'google_test_789',
          email: 'test3@example.com',
          nickname: 'testuser_three',
          password: 'short',
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('8 characters');
    });

    it('rejects duplicate nickname', async () => {
      // Create first user
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          google_id: 'google_dup_1',
          email: 'dup1@example.com',
          nickname: 'testuser_dup',
          password: 'securepassword123',
        },
      });

      // Try duplicate nickname
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          google_id: 'google_dup_2',
          email: 'dup2@example.com',
          nickname: 'testuser_dup',
          password: 'securepassword123',
        },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error).toContain('Nickname');
    });

    it('rejects duplicate google_id', async () => {
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          google_id: 'google_same_id',
          email: 'first@example.com',
          nickname: 'testuser_first',
          password: 'securepassword123',
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          google_id: 'google_same_id',
          email: 'second@example.com',
          nickname: 'testuser_second',
          password: 'securepassword123',
        },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error).toContain('Google');
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotates refresh token and returns new tokens', async () => {
      // Register a user to get tokens
      const regRes = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          google_id: 'google_refresh_test',
          email: 'refresh@example.com',
          nickname: 'testuser_refresh',
          password: 'securepassword123',
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
      expect(body.refresh_token).not.toBe(refresh_token); // jti makes each token unique

      // Old token should no longer work (rotation invalidates it)
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

  describe('POST /auth/logout', () => {
    it('revokes refresh token', async () => {
      const regRes = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          google_id: 'google_logout_test',
          email: 'logout@example.com',
          nickname: 'testuser_logout',
          password: 'securepassword123',
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

      // Refresh should now fail
      const refreshRes = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refresh_token },
      });
      expect(refreshRes.statusCode).toBe(401);
    });
  });

  describe('POST /auth/register with E2E key blobs', () => {
    it('stores key blobs when provided', async () => {
      const pubKey = 'MCowBQYDK2VuAyEAtest_public_key_base64';
      const privBlob = Buffer.from('encrypted_private_key').toString('base64');
      const recovBlob = Buffer.from('recovery_wrapped_key').toString('base64');

      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          google_id: 'google_e2e_test',
          email: 'e2e@example.com',
          nickname: 'testuser_e2e',
          password: 'securepassword123',
          public_key: pubKey,
          private_key_blob: privBlob,
          recovery_key_blob: recovBlob,
        },
      });

      expect(res.statusCode).toBe(201);
      const { access_token } = res.json();

      // Verify blobs are stored and retrievable
      const keyRes = await app.inject({
        method: 'GET',
        url: '/auth/key-blobs',
        headers: { authorization: `Bearer ${access_token}` },
      });

      expect(keyRes.statusCode).toBe(200);
      const keys = keyRes.json();
      expect(keys.public_key).toBe(pubKey);
      expect(keys.private_key_blob).toBe(privBlob);
      expect(keys.recovery_key_blob).toBe(recovBlob);
    });

    it('registers without key blobs (legacy path)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          google_id: 'google_nokeys_test',
          email: 'nokeys@example.com',
          nickname: 'testuser_nokeys',
          password: 'securepassword123',
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
      expect(keys.public_key).toBeNull();
      expect(keys.private_key_blob).toBeNull();
      expect(keys.recovery_key_blob).toBeNull();
    });
  });

  describe('GET /auth/key-blobs', () => {
    it('requires authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/auth/key-blobs',
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /auth/me', () => {
    it('returns user info with valid token', async () => {
      const regRes = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          google_id: 'google_me_test',
          email: 'me@example.com',
          nickname: 'testuser_me',
          password: 'securepassword123',
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
});
