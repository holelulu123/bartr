import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';
import { signAccessToken } from '../lib/jwt.js';

describe('Rating & Reputation routes', () => {
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
    await app.pg.query("DELETE FROM ratings WHERE from_user_id IN (SELECT id FROM users WHERE nickname LIKE 'reptest_%') OR to_user_id IN (SELECT id FROM users WHERE nickname LIKE 'reptest_%')");
    await app.pg.query("DELETE FROM trade_events WHERE trade_id IN (SELECT id FROM trades WHERE buyer_id IN (SELECT id FROM users WHERE nickname LIKE 'reptest_%') OR seller_id IN (SELECT id FROM users WHERE nickname LIKE 'reptest_%'))");
    await app.pg.query("DELETE FROM trades WHERE buyer_id IN (SELECT id FROM users WHERE nickname LIKE 'reptest_%') OR seller_id IN (SELECT id FROM users WHERE nickname LIKE 'reptest_%')");
    await app.pg.query("DELETE FROM listings WHERE user_id IN (SELECT id FROM users WHERE nickname LIKE 'reptest_%')");
    await app.pg.query("DELETE FROM reputation_scores WHERE user_id IN (SELECT id FROM users WHERE nickname LIKE 'reptest_%')");
    await app.pg.query("DELETE FROM users WHERE nickname LIKE 'reptest_%'");
  }

  async function createTestUser(suffix: string) {
    const result = await app.pg.query(
      `INSERT INTO users (google_id, nickname, email_encrypted, password_hash, bio, email_verified)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       RETURNING id, nickname`,
      [`google_rep_${suffix}`, `reptest_${suffix}`, null, 'hash', ''],
    );
    const user = result.rows[0];
    await app.pg.query('INSERT INTO reputation_scores (user_id) VALUES ($1)', [user.id]);
    return user;
  }

  async function getToken(user: { id: string; nickname: string }) {
    return signAccessToken({ sub: user.id, nickname: user.nickname });
  }

  /** Helper: create a listing, offer, accept, and complete a trade between seller and buyer */
  async function createCompletedTrade(seller: { id: string; nickname: string }, buyer: { id: string; nickname: string }) {
    const sellerToken = await getToken(seller);
    const buyerToken = await getToken(buyer);

    // Create listing
    const listRes = await app.inject({
      method: 'POST',
      url: '/listings',
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: {
        title: 'Item for reputation test',
        description: 'A test listing for reputation calculation testing',
        payment_methods: ['btc'],
        price_indication: '100',
        currency: 'USD',
        country_code: 'US',
      },
    });
    const listingId = listRes.json().id;

    // Buyer offers
    const offerRes = await app.inject({
      method: 'POST',
      url: '/trades',
      headers: { authorization: `Bearer ${buyerToken}` },
      payload: { listing_id: listingId },
    });
    const tradeId = offerRes.json().id;

    // Seller accepts
    await app.inject({
      method: 'POST',
      url: `/trades/${tradeId}/accept`,
      headers: { authorization: `Bearer ${sellerToken}` },
    });

    // Both complete
    await app.inject({
      method: 'POST',
      url: `/trades/${tradeId}/complete`,
      headers: { authorization: `Bearer ${buyerToken}` },
    });
    await app.inject({
      method: 'POST',
      url: `/trades/${tradeId}/complete`,
      headers: { authorization: `Bearer ${sellerToken}` },
    });

    return tradeId;
  }

  describe('POST /trades/:tradeId/rate', () => {
    it('submits a rating for a completed trade', async () => {
      const seller = await createTestUser('rate_s');
      const buyer = await createTestUser('rate_b');
      const tradeId = await createCompletedTrade(seller, buyer);
      const buyerToken = await getToken(buyer);

      const res = await app.inject({
        method: 'POST',
        url: `/trades/${tradeId}/rate`,
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { score: 5, comment: 'Great seller!' },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.score).toBe(5);
      expect(body.comment).toBe('Great seller!');
      expect(body.from_user_id).toBe(buyer.id);
      expect(body.to_user_id).toBe(seller.id);
    });

    it('rejects rating on non-completed trade', async () => {
      const seller = await createTestUser('noncomp_s');
      const buyer = await createTestUser('noncomp_b');
      const sellerToken = await getToken(seller);
      const buyerToken = await getToken(buyer);

      // Create listing and offer only (don't complete)
      const listRes = await app.inject({
        method: 'POST',
        url: '/listings',
        headers: { authorization: `Bearer ${sellerToken}` },
        payload: {
          title: 'Incomplete trade item test',
          description: 'A test listing for testing rating on incomplete trades',
          payment_methods: ['btc'],
          price_indication: '100',
          currency: 'USD',
          country_code: 'US',
        },
      });
      const offerRes = await app.inject({
        method: 'POST',
        url: '/trades',
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { listing_id: listRes.json().id },
      });

      const res = await app.inject({
        method: 'POST',
        url: `/trades/${offerRes.json().id}/rate`,
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { score: 5 },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('completed');
    });

    it('rejects duplicate rating', async () => {
      const seller = await createTestUser('duprate_s');
      const buyer = await createTestUser('duprate_b');
      const tradeId = await createCompletedTrade(seller, buyer);
      const buyerToken = await getToken(buyer);

      await app.inject({
        method: 'POST',
        url: `/trades/${tradeId}/rate`,
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { score: 4 },
      });

      const res = await app.inject({
        method: 'POST',
        url: `/trades/${tradeId}/rate`,
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { score: 5 },
      });

      expect(res.statusCode).toBe(409);
    });

    it('rejects invalid score', async () => {
      const seller = await createTestUser('badscore_s');
      const buyer = await createTestUser('badscore_b');
      const tradeId = await createCompletedTrade(seller, buyer);
      const buyerToken = await getToken(buyer);

      const res = await app.inject({
        method: 'POST',
        url: `/trades/${tradeId}/rate`,
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { score: 6 },
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejects non-participant', async () => {
      const seller = await createTestUser('nonpart_s');
      const buyer = await createTestUser('nonpart_b');
      const outsider = await createTestUser('nonpart_o');
      const tradeId = await createCompletedTrade(seller, buyer);
      const outsiderToken = await getToken(outsider);

      const res = await app.inject({
        method: 'POST',
        url: `/trades/${tradeId}/rate`,
        headers: { authorization: `Bearer ${outsiderToken}` },
        payload: { score: 3 },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('Reputation calculation', () => {
    it('updates reputation after rating', async () => {
      const seller = await createTestUser('rep_s');
      const buyer = await createTestUser('rep_b');
      const tradeId = await createCompletedTrade(seller, buyer);
      const buyerToken = await getToken(buyer);

      await app.inject({
        method: 'POST',
        url: `/trades/${tradeId}/rate`,
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { score: 5 },
      });

      // Check seller's reputation
      const repRes = await app.pg.query(
        'SELECT * FROM reputation_scores WHERE user_id = $1',
        [seller.id],
      );
      const rep = repRes.rows[0];
      expect(parseFloat(rep.rating_avg)).toBe(5);
      expect(parseFloat(rep.composite_score)).toBeGreaterThan(0);
      expect(parseFloat(rep.completion_rate)).toBe(1); // 1 completed, 0 failed
    });

    it('assigns verified tier after 3 completed trades with good scores', async () => {
      const seller = await createTestUser('tier_s');

      // Do 3 completed trades with 5-star ratings
      for (let i = 0; i < 3; i++) {
        const buyer = await createTestUser(`tier_b${i}`);
        const tradeId = await createCompletedTrade(seller, buyer);
        const buyerToken = await getToken(buyer);

        await app.inject({
          method: 'POST',
          url: `/trades/${tradeId}/rate`,
          headers: { authorization: `Bearer ${buyerToken}` },
          payload: { score: 5 },
        });
      }

      const repRes = await app.pg.query(
        'SELECT tier, composite_score FROM reputation_scores WHERE user_id = $1',
        [seller.id],
      );
      expect(repRes.rows[0].tier).toBe('verified');
      expect(parseFloat(repRes.rows[0].composite_score)).toBeGreaterThanOrEqual(30);
    });
  });

  describe('GET /users/:nickname/ratings', () => {
    it('returns ratings for a user', async () => {
      const seller = await createTestUser('getrat_s');
      const buyer = await createTestUser('getrat_b');
      const tradeId = await createCompletedTrade(seller, buyer);
      const buyerToken = await getToken(buyer);

      await app.inject({
        method: 'POST',
        url: `/trades/${tradeId}/rate`,
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { score: 4, comment: 'Good experience' },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/users/${seller.nickname}/ratings`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.ratings).toHaveLength(1);
      expect(body.ratings[0].score).toBe(4);
      expect(body.ratings[0].from_nickname).toBe('reptest_getrat_b');
      expect(body.pagination.total).toBe(1);
    });

    it('returns 404 for nonexistent user', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/users/nonexistent_xyz/ratings',
      });
      expect(res.statusCode).toBe(404);
    });
  });
});
