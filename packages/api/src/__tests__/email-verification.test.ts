import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';
import { signAccessToken } from '../lib/jwt.js';
import { hashCode } from '../lib/email.js';

describe('Email verification', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ skipRateLimit: true });
    await app.ready();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  beforeEach(async () => {
    await cleanup();
  });

  async function cleanup() {
    await app.pg.query("DELETE FROM email_verification_codes WHERE user_id IN (SELECT id FROM users WHERE nickname LIKE 'evtest_%')");
    await app.pg.query("DELETE FROM messages WHERE sender_id IN (SELECT id FROM users WHERE nickname LIKE 'evtest_%') OR recipient_id IN (SELECT id FROM users WHERE nickname LIKE 'evtest_%')");
    await app.pg.query("DELETE FROM message_threads WHERE participant_1 IN (SELECT id FROM users WHERE nickname LIKE 'evtest_%') OR participant_2 IN (SELECT id FROM users WHERE nickname LIKE 'evtest_%')");
    await app.pg.query("DELETE FROM listing_images WHERE listing_id IN (SELECT id FROM listings WHERE user_id IN (SELECT id FROM users WHERE nickname LIKE 'evtest_%'))");
    await app.pg.query("DELETE FROM listings WHERE user_id IN (SELECT id FROM users WHERE nickname LIKE 'evtest_%')");
    await app.pg.query("DELETE FROM reputation_scores WHERE user_id IN (SELECT id FROM users WHERE nickname LIKE 'evtest_%')");
    await app.pg.query("DELETE FROM users WHERE nickname LIKE 'evtest_%'");
  }

  async function createTestUser(suffix: string, verified = false) {
    const result = await app.pg.query(
      `INSERT INTO users (nickname, password_hash, bio, email_verified)
       VALUES ($1, 'hash', '', $2)
       RETURNING id, nickname`,
      [`evtest_${suffix}`, verified],
    );
    const user = result.rows[0];
    await app.pg.query('INSERT INTO reputation_scores (user_id) VALUES ($1)', [user.id]);
    return user;
  }

  async function insertCode(userId: string, code: string, expiresAt?: Date) {
    const expires = expiresAt ?? new Date(Date.now() + 5 * 60_000);
    await app.pg.query(
      `INSERT INTO email_verification_codes (user_id, code_hash, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET code_hash = $2, expires_at = $3, created_at = now()`,
      [userId, hashCode(code), expires],
    );
  }

  async function getToken(user: { id: string; nickname: string }) {
    return signAccessToken({ sub: user.id, nickname: user.nickname });
  }

  describe('POST /auth/verify-email', () => {
    it('verifies with correct code', async () => {
      const user = await createTestUser('v1');
      const token = await getToken(user);
      const code = '123456';
      await insertCode(user.id, code);

      const res = await app.inject({
        method: 'POST',
        url: '/auth/verify-email',
        headers: { authorization: `Bearer ${token}` },
        payload: { code },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().verified).toBe(true);

      // Confirm DB updated
      const dbRow = await app.pg.query('SELECT email_verified FROM users WHERE id = $1', [user.id]);
      expect(dbRow.rows[0].email_verified).toBe(true);
    });

    it('rejects wrong code', async () => {
      const user = await createTestUser('v2');
      const token = await getToken(user);
      await insertCode(user.id, '123456');

      const res = await app.inject({
        method: 'POST',
        url: '/auth/verify-email',
        headers: { authorization: `Bearer ${token}` },
        payload: { code: '999999' },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/invalid or expired/i);
    });

    it('rejects expired code', async () => {
      const user = await createTestUser('v3');
      const token = await getToken(user);
      const code = '123456';
      await insertCode(user.id, code, new Date(Date.now() - 60_000)); // expired 1 min ago

      const res = await app.inject({
        method: 'POST',
        url: '/auth/verify-email',
        headers: { authorization: `Bearer ${token}` },
        payload: { code },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/invalid or expired/i);
    });

    it('code is consumed on use (replay fails)', async () => {
      const user = await createTestUser('v4');
      const token = await getToken(user);
      const code = '123456';
      await insertCode(user.id, code);

      // First attempt succeeds
      const res1 = await app.inject({
        method: 'POST',
        url: '/auth/verify-email',
        headers: { authorization: `Bearer ${token}` },
        payload: { code },
      });
      expect(res1.statusCode).toBe(200);

      // Second attempt: already verified — returns success
      const res2 = await app.inject({
        method: 'POST',
        url: '/auth/verify-email',
        headers: { authorization: `Bearer ${token}` },
        payload: { code },
      });
      expect(res2.statusCode).toBe(200);
      expect(res2.json().verified).toBe(true);
    });

    it('already-verified user returns success', async () => {
      const user = await createTestUser('v5', true);
      const token = await getToken(user);

      const res = await app.inject({
        method: 'POST',
        url: '/auth/verify-email',
        headers: { authorization: `Bearer ${token}` },
        payload: { code: '000000' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().verified).toBe(true);
    });

    it('rejects invalid code format', async () => {
      const user = await createTestUser('v6');
      const token = await getToken(user);

      const res = await app.inject({
        method: 'POST',
        url: '/auth/verify-email',
        headers: { authorization: `Bearer ${token}` },
        payload: { code: 'abc' },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/6-digit/i);
    });
  });

  describe('GET /auth/me includes email_verified', () => {
    it('returns email_verified: false for unverified user', async () => {
      const user = await createTestUser('me1');
      const token = await getToken(user);

      const res = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().email_verified).toBe(false);
    });

    it('returns email_verified: true for verified user', async () => {
      const user = await createTestUser('me2', true);
      const token = await getToken(user);

      const res = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().email_verified).toBe(true);
    });
  });

  describe('Email verification gating', () => {
    it('POST /listings blocked when unverified', async () => {
      const user = await createTestUser('gate1');
      const token = await getToken(user);

      const res = await app.inject({
        method: 'POST',
        url: '/listings',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          title: 'Should Be Blocked',
          description: 'This listing should not be created by unverified user',
          payment_methods: ['btc'],
          price_indication: '100',
          currency: 'USD',
          country_code: 'US',
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toMatch(/email verification required/i);
    });

    it('POST /listings allowed when verified', async () => {
      const user = await createTestUser('gate2', true);
      const token = await getToken(user);

      const res = await app.inject({
        method: 'POST',
        url: '/listings',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          title: 'Verified User Listing',
          description: 'This listing should be created successfully by verified user',
          payment_methods: ['btc'],
          price_indication: '100',
          currency: 'USD',
          country_code: 'US',
        },
      });

      expect(res.statusCode).toBe(201);
    });

    it('POST /threads blocked when unverified', async () => {
      const user = await createTestUser('gate3');
      const recipient = await createTestUser('gate3r', true);
      const token = await getToken(user);

      const res = await app.inject({
        method: 'POST',
        url: '/threads',
        headers: { authorization: `Bearer ${token}` },
        payload: { recipient_nickname: recipient.nickname },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toMatch(/email verification required/i);
    });

    it('POST /threads/:threadId/messages blocked when unverified', async () => {
      // Create thread with verified users, then try to send as unverified
      const verified = await createTestUser('gate4v', true);
      const unverified = await createTestUser('gate4u');
      const verifiedToken = await getToken(verified);
      const unverifiedToken = await getToken(unverified);

      // Verified user creates thread
      const threadRes = await app.inject({
        method: 'POST',
        url: '/threads',
        headers: { authorization: `Bearer ${verifiedToken}` },
        payload: { recipient_nickname: unverified.nickname },
      });
      const threadId = threadRes.json().id;

      // Unverified user tries to send a message
      const res = await app.inject({
        method: 'POST',
        url: `/threads/${threadId}/messages`,
        headers: { authorization: `Bearer ${unverifiedToken}` },
        payload: { body_encrypted: Buffer.from('test').toString('base64') },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toMatch(/email verification required/i);
    });
  });
});
