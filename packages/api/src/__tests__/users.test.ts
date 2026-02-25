import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';
import { signAccessToken } from '../lib/jwt.js';

describe('User routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Build app with MinIO for full route registration
    // MinIO is available via Docker
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.pg.query("DELETE FROM users WHERE nickname LIKE 'proftest_%'");
    await app.close();
  });

  beforeEach(async () => {
    await app.pg.query("DELETE FROM users WHERE nickname LIKE 'proftest_%'");
  });

  async function createTestUser(suffix: string) {
    const result = await app.pg.query(
      `INSERT INTO users (google_id, nickname, email_encrypted, password_hash, bio)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nickname`,
      [`google_prof_${suffix}`, `proftest_${suffix}`, null, 'hash', ''],
    );
    const user = result.rows[0];
    // Init reputation
    await app.pg.query('INSERT INTO reputation_scores (user_id) VALUES ($1)', [user.id]);
    return user;
  }

  describe('GET /users/:nickname', () => {
    it('returns public profile with reputation', async () => {
      const user = await createTestUser('pub1');

      const res = await app.inject({
        method: 'GET',
        url: `/users/${user.nickname}`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.nickname).toBe('proftest_pub1');
      expect(body.reputation).toBeDefined();
      expect(body.reputation.tier).toBe('new');
      expect(body.avatar_url).toBeNull();
    });

    it('returns 404 for nonexistent user', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/users/nonexistent_user_xyz',
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('PUT /users/me', () => {
    it('updates bio', async () => {
      const user = await createTestUser('upd1');
      const token = await signAccessToken({ sub: user.id, nickname: user.nickname });

      const res = await app.inject({
        method: 'PUT',
        url: '/users/me',
        headers: { authorization: `Bearer ${token}` },
        payload: { bio: 'Hello, I trade crypto!' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().bio).toBe('Hello, I trade crypto!');
    });

    it('updates nickname', async () => {
      const user = await createTestUser('upd2');
      const token = await signAccessToken({ sub: user.id, nickname: user.nickname });

      const res = await app.inject({
        method: 'PUT',
        url: '/users/me',
        headers: { authorization: `Bearer ${token}` },
        payload: { nickname: 'proftest_newname' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().nickname).toBe('proftest_newname');
    });

    it('rejects short nickname', async () => {
      const user = await createTestUser('upd3');
      const token = await signAccessToken({ sub: user.id, nickname: user.nickname });

      const res = await app.inject({
        method: 'PUT',
        url: '/users/me',
        headers: { authorization: `Bearer ${token}` },
        payload: { nickname: 'ab' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejects bio over 500 chars', async () => {
      const user = await createTestUser('upd4');
      const token = await signAccessToken({ sub: user.id, nickname: user.nickname });

      const res = await app.inject({
        method: 'PUT',
        url: '/users/me',
        headers: { authorization: `Bearer ${token}` },
        payload: { bio: 'x'.repeat(501) },
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejects duplicate nickname', async () => {
      const user1 = await createTestUser('dup1');
      const user2 = await createTestUser('dup2');
      const token = await signAccessToken({ sub: user2.id, nickname: user2.nickname });

      const res = await app.inject({
        method: 'PUT',
        url: '/users/me',
        headers: { authorization: `Bearer ${token}` },
        payload: { nickname: user1.nickname },
      });

      expect(res.statusCode).toBe(409);
    });

    it('rejects unauthenticated request', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/users/me',
        payload: { bio: 'test' },
      });

      expect(res.statusCode).toBe(401);
    });
  });
});
