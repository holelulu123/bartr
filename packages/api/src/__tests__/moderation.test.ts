import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';
import { signAccessToken } from '../lib/jwt.js';
import { checkKeywordFilter } from '../routes/moderation.js';

describe('Moderation routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ skipRateLimit: true });
    await app.ready();

    await app.pg.query(`
      ALTER TABLE listings ADD COLUMN IF NOT EXISTS country_code TEXT
    `);
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  beforeEach(async () => {
    await cleanup();
  });

  async function cleanup() {
    await app.pg.query("DELETE FROM moderation_flags WHERE reporter_id IN (SELECT id FROM users WHERE nickname LIKE 'modtest_%')");
    await app.pg.query("DELETE FROM listings WHERE user_id IN (SELECT id FROM users WHERE nickname LIKE 'modtest_%')");
    await app.pg.query("DELETE FROM reputation_scores WHERE user_id IN (SELECT id FROM users WHERE nickname LIKE 'modtest_%')");
    await app.pg.query("DELETE FROM users WHERE nickname LIKE 'modtest_%'");
  }

  async function createTestUser(suffix: string) {
    const result = await app.pg.query(
      `INSERT INTO users (google_id, nickname, email_encrypted, password_hash, bio, email_verified)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       RETURNING id, nickname`,
      [`google_mod_${suffix}`, `modtest_${suffix}`, null, 'hash', ''],
    );
    const user = result.rows[0];
    await app.pg.query('INSERT INTO reputation_scores (user_id) VALUES ($1)', [user.id]);
    return user;
  }

  async function createAdminUser(suffix: string) {
    const result = await app.pg.query(
      `INSERT INTO users (google_id, nickname, email_encrypted, password_hash, bio, role, email_verified)
       VALUES ($1, $2, $3, $4, $5, 'admin', TRUE)
       RETURNING id, nickname, role`,
      [`google_mod_${suffix}`, `modtest_${suffix}`, null, 'hash', ''],
    );
    const user = result.rows[0];
    await app.pg.query('INSERT INTO reputation_scores (user_id) VALUES ($1)', [user.id]);
    return user;
  }

  async function getToken(user: { id: string; nickname: string }) {
    return signAccessToken({ sub: user.id, nickname: user.nickname });
  }

  async function getAdminToken(user: { id: string; nickname: string }) {
    return signAccessToken({ sub: user.id, nickname: user.nickname, role: 'admin' });
  }

  describe('POST /flags', () => {
    it('creates a flag on a listing', async () => {
      const reporter = await createTestUser('flag1');
      const seller = await createTestUser('flag1s');
      const token = await getToken(reporter);
      const sellerToken = await getToken(seller);

      // Create a listing to flag
      const listRes = await app.inject({
        method: 'POST',
        url: '/listings',
        headers: { authorization: `Bearer ${sellerToken}` },
        payload: {
          title: 'Suspicious item for sale here',
          description: 'This listing has suspicious content for moderation testing',
          payment_methods: ['btc'],
          price_indication: '100',
          currency: 'USD',
          country_code: 'US',
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/flags',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          target_type: 'listing',
          target_id: listRes.json().id,
          reason: 'This listing looks suspicious and may be fraudulent',
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().status).toBe('pending');
      expect(res.json().target_type).toBe('listing');
    });

    it('creates a flag on a user', async () => {
      const reporter = await createTestUser('flaguser1');
      const target = await createTestUser('flaguser1t');
      const token = await getToken(reporter);

      const res = await app.inject({
        method: 'POST',
        url: '/flags',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          target_type: 'user',
          target_id: target.id,
          reason: 'This user is behaving suspiciously and may be a scammer',
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().target_type).toBe('user');
    });

    it('rejects duplicate pending flag', async () => {
      const reporter = await createTestUser('dupflag');
      const target = await createTestUser('dupflagt');
      const token = await getToken(reporter);

      await app.inject({
        method: 'POST',
        url: '/flags',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          target_type: 'user',
          target_id: target.id,
          reason: 'First report about this user being suspicious',
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/flags',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          target_type: 'user',
          target_id: target.id,
          reason: 'Second report about the same user being suspicious',
        },
      });

      expect(res.statusCode).toBe(409);
    });

    it('rejects invalid target_type', async () => {
      const reporter = await createTestUser('badtype');
      const token = await getToken(reporter);

      const res = await app.inject({
        method: 'POST',
        url: '/flags',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          target_type: 'invalid',
          target_id: '00000000-0000-0000-0000-000000000000',
          reason: 'Testing invalid target type with enough characters',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejects short reason', async () => {
      const reporter = await createTestUser('shortreason');
      const target = await createTestUser('shortreasont');
      const token = await getToken(reporter);

      const res = await app.inject({
        method: 'POST',
        url: '/flags',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          target_type: 'user',
          target_id: target.id,
          reason: 'bad',
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /flags/mine', () => {
    it('lists my submitted flags', async () => {
      const reporter = await createTestUser('myflags');
      const target = await createTestUser('myflagst');
      const token = await getToken(reporter);

      await app.inject({
        method: 'POST',
        url: '/flags',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          target_type: 'user',
          target_id: target.id,
          reason: 'Reporting this user for testing my flags endpoint',
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/flags/mine',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().flags).toHaveLength(1);
    });
  });

  describe('Admin flag management', () => {
    it('admin can list pending flags', async () => {
      const reporter = await createTestUser('admin1r');
      const target = await createTestUser('admin1t');
      const admin = await createAdminUser('admin1a');
      const reporterToken = await getToken(reporter);
      const adminToken = await getAdminToken(admin);

      await app.inject({
        method: 'POST',
        url: '/flags',
        headers: { authorization: `Bearer ${reporterToken}` },
        payload: {
          target_type: 'user',
          target_id: target.id,
          reason: 'Creating a flag to test admin listing endpoint',
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/admin/flags',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().flags.length).toBeGreaterThanOrEqual(1);
    });

    it('non-admin is rejected from GET /admin/flags with 403', async () => {
      const user = await createTestUser('nonadmin1');
      const token = await getToken(user);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/flags',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toMatch(/admin access required/i);
    });

    it('unauthenticated request is rejected from GET /admin/flags with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/flags',
      });

      expect(res.statusCode).toBe(401);
    });

    it('admin can update flag status to resolved', async () => {
      const reporter = await createTestUser('resolve1r');
      const target = await createTestUser('resolve1t');
      const admin = await createAdminUser('resolve1a');
      const reporterToken = await getToken(reporter);
      const adminToken = await getAdminToken(admin);

      const flagRes = await app.inject({
        method: 'POST',
        url: '/flags',
        headers: { authorization: `Bearer ${reporterToken}` },
        payload: {
          target_type: 'user',
          target_id: target.id,
          reason: 'Creating a flag to test status update to resolved',
        },
      });

      const res = await app.inject({
        method: 'PUT',
        url: `/admin/flags/${flagRes.json().id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { status: 'resolved' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('resolved');
    });

    it('non-admin is rejected from PUT /admin/flags/:id with 403', async () => {
      const reporter = await createTestUser('resolve2r');
      const target = await createTestUser('resolve2t');
      const reporterToken = await getToken(reporter);

      const flagRes = await app.inject({
        method: 'POST',
        url: '/flags',
        headers: { authorization: `Bearer ${reporterToken}` },
        payload: {
          target_type: 'user',
          target_id: target.id,
          reason: 'Creating a flag to test non-admin rejection',
        },
      });

      const res = await app.inject({
        method: 'PUT',
        url: `/admin/flags/${flagRes.json().id}`,
        headers: { authorization: `Bearer ${reporterToken}` },
        payload: { status: 'resolved' },
      });

      expect(res.statusCode).toBe(403);
    });

    it('rejects invalid flag status', async () => {
      const reporter = await createTestUser('badstatus');
      const target = await createTestUser('badstatust');
      const admin = await createAdminUser('badstatusa');
      const reporterToken = await getToken(reporter);
      const adminToken = await getAdminToken(admin);

      const flagRes = await app.inject({
        method: 'POST',
        url: '/flags',
        headers: { authorization: `Bearer ${reporterToken}` },
        payload: {
          target_type: 'user',
          target_id: target.id,
          reason: 'Creating a flag to test invalid status update',
        },
      });

      const res = await app.inject({
        method: 'PUT',
        url: `/admin/flags/${flagRes.json().id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { status: 'invalid' },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('Keyword filter', () => {
    it('detects blocked keywords', () => {
      expect(checkKeywordFilter('Buy this stolen laptop')).toBe('stolen');
      expect(checkKeywordFilter('Selling illegal items')).toBe('illegal');
      expect(checkKeywordFilter('Normal listing for GPU')).toBeNull();
    });

    it('POST /moderation/check returns filter result', async () => {
      const res1 = await app.inject({
        method: 'POST',
        url: '/moderation/check',
        payload: { text: 'Buy this stolen laptop' },
      });
      expect(res1.json().allowed).toBe(false);
      expect(res1.json().blocked_keyword).toBe('stolen');

      const res2 = await app.inject({
        method: 'POST',
        url: '/moderation/check',
        payload: { text: 'Selling a GPU for crypto' },
      });
      expect(res2.json().allowed).toBe(true);
      expect(res2.json().blocked_keyword).toBeNull();
    });
  });
});
