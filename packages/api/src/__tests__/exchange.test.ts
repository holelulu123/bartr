import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';
import { signAccessToken } from '../lib/jwt.js';

describe('Exchange offer city field', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ skipRateLimit: true });
    await app.ready();

    // Ensure city column exists
    await app.pg.query('ALTER TABLE exchange_offers ADD COLUMN IF NOT EXISTS city TEXT');
  });

  afterAll(async () => {
    await app.pg.query("DELETE FROM exchange_offers WHERE user_id IN (SELECT id FROM users WHERE nickname LIKE 'exchtest_%')");
    await app.pg.query("DELETE FROM reputation_scores WHERE user_id IN (SELECT id FROM users WHERE nickname LIKE 'exchtest_%')");
    await app.pg.query("DELETE FROM users WHERE nickname LIKE 'exchtest_%'");
    await app.close();
  });

  beforeEach(async () => {
    await app.pg.query("DELETE FROM exchange_offers WHERE user_id IN (SELECT id FROM users WHERE nickname LIKE 'exchtest_%')");
    await app.pg.query("DELETE FROM reputation_scores WHERE user_id IN (SELECT id FROM users WHERE nickname LIKE 'exchtest_%')");
    await app.pg.query("DELETE FROM users WHERE nickname LIKE 'exchtest_%'");
  });

  async function createTestUser(suffix: string) {
    const result = await app.pg.query(
      `INSERT INTO users (google_id, nickname, email_encrypted, password_hash, bio, email_verified)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       RETURNING id, nickname`,
      [`google_exch_${suffix}`, `exchtest_${suffix}`, null, 'hash', ''],
    );
    const user = result.rows[0];
    await app.pg.query('INSERT INTO reputation_scores (user_id) VALUES ($1)', [user.id]);
    return user;
  }

  async function getToken(user: { id: string; nickname: string }) {
    return signAccessToken({ sub: user.id, nickname: user.nickname });
  }

  const validOffer = {
    offer_type: 'sell',
    crypto_currency: 'BTC',
    fiat_currency: 'USD',
    min_amount: 100,
    max_amount: 10000,
    rate_type: 'market',
    payment_methods: ['cash'],
    price_source: 'coingecko',
  };

  describe('POST /exchange/offers — city field', () => {
    it('creates offer with city', async () => {
      const user = await createTestUser('city1');
      const token = await getToken(user);

      const res = await app.inject({
        method: 'POST',
        url: '/exchange/offers',
        headers: { authorization: `Bearer ${token}` },
        payload: { ...validOffer, country_code: 'US', city: 'New York' },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.city).toBe('New York');
      expect(body.country_code).toBe('US');
    });

    it('creates offer without city (null)', async () => {
      const user = await createTestUser('city2');
      const token = await getToken(user);

      const res = await app.inject({
        method: 'POST',
        url: '/exchange/offers',
        headers: { authorization: `Bearer ${token}` },
        payload: validOffer,
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().city).toBeNull();
    });

    it('rejects city with numbers', async () => {
      const user = await createTestUser('city3');
      const token = await getToken(user);

      const res = await app.inject({
        method: 'POST',
        url: '/exchange/offers',
        headers: { authorization: `Bearer ${token}` },
        payload: { ...validOffer, city: 'City123' },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('City must not contain numbers');
    });

    it('rejects city longer than 100 chars', async () => {
      const user = await createTestUser('city4');
      const token = await getToken(user);

      const res = await app.inject({
        method: 'POST',
        url: '/exchange/offers',
        headers: { authorization: `Bearer ${token}` },
        payload: { ...validOffer, city: 'A'.repeat(101) },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('City must be a string (max 100 chars)');
    });
  });

  describe('PUT /exchange/offers/:id — city update', () => {
    it('updates city on existing offer', async () => {
      const user = await createTestUser('city5');
      const token = await getToken(user);

      const createRes = await app.inject({
        method: 'POST',
        url: '/exchange/offers',
        headers: { authorization: `Bearer ${token}` },
        payload: { ...validOffer, city: 'Berlin' },
      });
      const offerId = createRes.json().id;

      const updateRes = await app.inject({
        method: 'PUT',
        url: `/exchange/offers/${offerId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { city: 'Munich' },
      });

      expect(updateRes.statusCode).toBe(200);
      expect(updateRes.json().city).toBe('Munich');
    });

    it('clears city by setting null', async () => {
      const user = await createTestUser('city6');
      const token = await getToken(user);

      const createRes = await app.inject({
        method: 'POST',
        url: '/exchange/offers',
        headers: { authorization: `Bearer ${token}` },
        payload: { ...validOffer, city: 'Paris' },
      });
      const offerId = createRes.json().id;

      const updateRes = await app.inject({
        method: 'PUT',
        url: `/exchange/offers/${offerId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { city: null },
      });

      expect(updateRes.statusCode).toBe(200);
      expect(updateRes.json().city).toBeNull();
    });

    it('rejects city with numbers on update', async () => {
      const user = await createTestUser('city7');
      const token = await getToken(user);

      const createRes = await app.inject({
        method: 'POST',
        url: '/exchange/offers',
        headers: { authorization: `Bearer ${token}` },
        payload: validOffer,
      });
      const offerId = createRes.json().id;

      const updateRes = await app.inject({
        method: 'PUT',
        url: `/exchange/offers/${offerId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { city: 'Test3' },
      });

      expect(updateRes.statusCode).toBe(400);
      expect(updateRes.json().error).toBe('City must not contain numbers');
    });
  });
});
