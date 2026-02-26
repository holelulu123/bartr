import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';
import { signAccessToken } from '../lib/jwt.js';

describe('Message routes', () => {
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
    await app.pg.query("DELETE FROM messages WHERE sender_id IN (SELECT id FROM users WHERE nickname LIKE 'msgtest_%')");
    await app.pg.query("DELETE FROM message_threads WHERE participant_1 IN (SELECT id FROM users WHERE nickname LIKE 'msgtest_%') OR participant_2 IN (SELECT id FROM users WHERE nickname LIKE 'msgtest_%')");
    await app.pg.query("DELETE FROM listings WHERE user_id IN (SELECT id FROM users WHERE nickname LIKE 'msgtest_%')");
    await app.pg.query("DELETE FROM reputation_scores WHERE user_id IN (SELECT id FROM users WHERE nickname LIKE 'msgtest_%')");
    await app.pg.query("DELETE FROM users WHERE nickname LIKE 'msgtest_%'");
  }

  async function createTestUser(suffix: string) {
    const result = await app.pg.query(
      `INSERT INTO users (google_id, nickname, email_encrypted, password_hash, bio)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nickname`,
      [`google_msg_${suffix}`, `msgtest_${suffix}`, null, 'hash', ''],
    );
    const user = result.rows[0];
    await app.pg.query('INSERT INTO reputation_scores (user_id) VALUES ($1)', [user.id]);
    return user;
  }

  async function getToken(user: { id: string; nickname: string }) {
    return signAccessToken({ sub: user.id, nickname: user.nickname });
  }

  describe('POST /threads', () => {
    it('creates a new thread between two users', async () => {
      const user1 = await createTestUser('thread1a');
      const user2 = await createTestUser('thread1b');
      const token1 = await getToken(user1);

      const res = await app.inject({
        method: 'POST',
        url: '/threads',
        headers: { authorization: `Bearer ${token1}` },
        payload: { recipient_nickname: user2.nickname },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().id).toBeDefined();
      expect(res.json().participant_1).toBe(user1.id);
      expect(res.json().participant_2).toBe(user2.id);
    });

    it('returns existing thread instead of creating duplicate', async () => {
      const user1 = await createTestUser('dup1a');
      const user2 = await createTestUser('dup1b');
      const token1 = await getToken(user1);

      const res1 = await app.inject({
        method: 'POST',
        url: '/threads',
        headers: { authorization: `Bearer ${token1}` },
        payload: { recipient_nickname: user2.nickname },
      });

      const res2 = await app.inject({
        method: 'POST',
        url: '/threads',
        headers: { authorization: `Bearer ${token1}` },
        payload: { recipient_nickname: user2.nickname },
      });

      expect(res2.statusCode).toBe(200);
      expect(res2.json().id).toBe(res1.json().id);
      expect(res2.json().existing).toBe(true);
    });

    it('rejects messaging yourself', async () => {
      const user = await createTestUser('self1');
      const token = await getToken(user);

      const res = await app.inject({
        method: 'POST',
        url: '/threads',
        headers: { authorization: `Bearer ${token}` },
        payload: { recipient_nickname: user.nickname },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('yourself');
    });

    it('rejects nonexistent recipient', async () => {
      const user = await createTestUser('norecip');
      const token = await getToken(user);

      const res = await app.inject({
        method: 'POST',
        url: '/threads',
        headers: { authorization: `Bearer ${token}` },
        payload: { recipient_nickname: 'ghost_user_xyz' },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /threads/:threadId/messages', () => {
    it('sends a message in a thread', async () => {
      const user1 = await createTestUser('send1a');
      const user2 = await createTestUser('send1b');
      const token1 = await getToken(user1);

      const threadRes = await app.inject({
        method: 'POST',
        url: '/threads',
        headers: { authorization: `Bearer ${token1}` },
        payload: { recipient_nickname: user2.nickname },
      });
      const threadId = threadRes.json().id;

      const res = await app.inject({
        method: 'POST',
        url: `/threads/${threadId}/messages`,
        headers: { authorization: `Bearer ${token1}` },
        payload: { body: 'Hey, interested in trading!' },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().body).toBe('Hey, interested in trading!');
      expect(res.json().sender_id).toBe(user1.id);
    });

    it('rejects empty message', async () => {
      const user1 = await createTestUser('empty1a');
      const user2 = await createTestUser('empty1b');
      const token1 = await getToken(user1);

      const threadRes = await app.inject({
        method: 'POST',
        url: '/threads',
        headers: { authorization: `Bearer ${token1}` },
        payload: { recipient_nickname: user2.nickname },
      });

      const res = await app.inject({
        method: 'POST',
        url: `/threads/${threadRes.json().id}/messages`,
        headers: { authorization: `Bearer ${token1}` },
        payload: { body: '' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejects non-participant', async () => {
      const user1 = await createTestUser('nonp1a');
      const user2 = await createTestUser('nonp1b');
      const outsider = await createTestUser('nonp1c');
      const token1 = await getToken(user1);
      const outsiderToken = await getToken(outsider);

      const threadRes = await app.inject({
        method: 'POST',
        url: '/threads',
        headers: { authorization: `Bearer ${token1}` },
        payload: { recipient_nickname: user2.nickname },
      });

      const res = await app.inject({
        method: 'POST',
        url: `/threads/${threadRes.json().id}/messages`,
        headers: { authorization: `Bearer ${outsiderToken}` },
        payload: { body: 'Sneaky message' },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /threads/:threadId/messages', () => {
    it('retrieves messages in a thread', async () => {
      const user1 = await createTestUser('get1a');
      const user2 = await createTestUser('get1b');
      const token1 = await getToken(user1);
      const token2 = await getToken(user2);

      const threadRes = await app.inject({
        method: 'POST',
        url: '/threads',
        headers: { authorization: `Bearer ${token1}` },
        payload: { recipient_nickname: user2.nickname },
      });
      const threadId = threadRes.json().id;

      // Send messages back and forth
      await app.inject({
        method: 'POST',
        url: `/threads/${threadId}/messages`,
        headers: { authorization: `Bearer ${token1}` },
        payload: { body: 'Hello!' },
      });
      await app.inject({
        method: 'POST',
        url: `/threads/${threadId}/messages`,
        headers: { authorization: `Bearer ${token2}` },
        payload: { body: 'Hi there!' },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/threads/${threadId}/messages`,
        headers: { authorization: `Bearer ${token1}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0].body).toBe('Hello!');
      expect(body.messages[1].body).toBe('Hi there!');
      expect(body.pagination.total).toBe(2);
    });
  });

  describe('GET /threads', () => {
    it('lists my threads', async () => {
      const user1 = await createTestUser('list1a');
      const user2 = await createTestUser('list1b');
      const user3 = await createTestUser('list1c');
      const token1 = await getToken(user1);

      await app.inject({
        method: 'POST',
        url: '/threads',
        headers: { authorization: `Bearer ${token1}` },
        payload: { recipient_nickname: user2.nickname },
      });
      await app.inject({
        method: 'POST',
        url: '/threads',
        headers: { authorization: `Bearer ${token1}` },
        payload: { recipient_nickname: user3.nickname },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/threads',
        headers: { authorization: `Bearer ${token1}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().threads).toHaveLength(2);
      expect(res.json().pagination.total).toBe(2);
    });
  });
});
