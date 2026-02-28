import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';
import { signAccessToken } from '../lib/jwt.js';

describe('Trade routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ skipRateLimit: true });
    await app.ready();

    // Ensure country_code column exists
    await app.pg.query(`
      ALTER TABLE listings ADD COLUMN IF NOT EXISTS country_code TEXT
    `);
  });

  afterAll(async () => {
    await app.pg.query("DELETE FROM trade_events WHERE trade_id IN (SELECT id FROM trades WHERE buyer_id IN (SELECT id FROM users WHERE nickname LIKE 'tradetest_%') OR seller_id IN (SELECT id FROM users WHERE nickname LIKE 'tradetest_%'))");
    await app.pg.query("DELETE FROM trades WHERE buyer_id IN (SELECT id FROM users WHERE nickname LIKE 'tradetest_%') OR seller_id IN (SELECT id FROM users WHERE nickname LIKE 'tradetest_%')");
    await app.pg.query("DELETE FROM listings WHERE user_id IN (SELECT id FROM users WHERE nickname LIKE 'tradetest_%')");
    await app.pg.query("DELETE FROM reputation_scores WHERE user_id IN (SELECT id FROM users WHERE nickname LIKE 'tradetest_%')");
    await app.pg.query("DELETE FROM users WHERE nickname LIKE 'tradetest_%'");
    await app.close();
  });

  beforeEach(async () => {
    await app.pg.query("DELETE FROM trade_events WHERE trade_id IN (SELECT id FROM trades WHERE buyer_id IN (SELECT id FROM users WHERE nickname LIKE 'tradetest_%') OR seller_id IN (SELECT id FROM users WHERE nickname LIKE 'tradetest_%'))");
    await app.pg.query("DELETE FROM trades WHERE buyer_id IN (SELECT id FROM users WHERE nickname LIKE 'tradetest_%') OR seller_id IN (SELECT id FROM users WHERE nickname LIKE 'tradetest_%')");
    await app.pg.query("DELETE FROM listings WHERE user_id IN (SELECT id FROM users WHERE nickname LIKE 'tradetest_%')");
    await app.pg.query("DELETE FROM reputation_scores WHERE user_id IN (SELECT id FROM users WHERE nickname LIKE 'tradetest_%')");
    await app.pg.query("DELETE FROM users WHERE nickname LIKE 'tradetest_%'");
  });

  async function createTestUser(suffix: string) {
    const result = await app.pg.query(
      `INSERT INTO users (google_id, nickname, email_encrypted, password_hash, bio)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nickname`,
      [`google_trade_${suffix}`, `tradetest_${suffix}`, null, 'hash', ''],
    );
    const user = result.rows[0];
    await app.pg.query('INSERT INTO reputation_scores (user_id) VALUES ($1)', [user.id]);
    return user;
  }

  async function getToken(user: { id: string; nickname: string }) {
    return signAccessToken({ sub: user.id, nickname: user.nickname });
  }

  async function createListing(token: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/listings',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: 'Test item for trading',
        description: 'A test listing created for trade flow testing purposes',
        payment_methods: ['btc'],
      },
    });
    return res.json();
  }

  describe('POST /trades', () => {
    it('creates a trade offer', async () => {
      const seller = await createTestUser('seller1');
      const buyer = await createTestUser('buyer1');
      const sellerToken = await getToken(seller);
      const buyerToken = await getToken(buyer);

      const listing = await createListing(sellerToken);

      const res = await app.inject({
        method: 'POST',
        url: '/trades',
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { listing_id: listing.id },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.status).toBe('offered');
      expect(body.buyer_id).toBe(buyer.id);
      expect(body.seller_id).toBe(seller.id);
    });

    it('rejects trading on own listing', async () => {
      const seller = await createTestUser('self1');
      const sellerToken = await getToken(seller);
      const listing = await createListing(sellerToken);

      const res = await app.inject({
        method: 'POST',
        url: '/trades',
        headers: { authorization: `Bearer ${sellerToken}` },
        payload: { listing_id: listing.id },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('own listing');
    });

    it('rejects duplicate active trade', async () => {
      const seller = await createTestUser('dup_s');
      const buyer = await createTestUser('dup_b');
      const sellerToken = await getToken(seller);
      const buyerToken = await getToken(buyer);
      const listing = await createListing(sellerToken);

      await app.inject({
        method: 'POST',
        url: '/trades',
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { listing_id: listing.id },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/trades',
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { listing_id: listing.id },
      });

      expect(res.statusCode).toBe(409);
    });
  });

  describe('Trade state machine', () => {
    it('seller accepts → both complete', async () => {
      const seller = await createTestUser('flow_s');
      const buyer = await createTestUser('flow_b');
      const sellerToken = await getToken(seller);
      const buyerToken = await getToken(buyer);
      const listing = await createListing(sellerToken);

      // Buyer offers
      const offerRes = await app.inject({
        method: 'POST',
        url: '/trades',
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { listing_id: listing.id },
      });
      const tradeId = offerRes.json().id;

      // Seller accepts
      const acceptRes = await app.inject({
        method: 'POST',
        url: `/trades/${tradeId}/accept`,
        headers: { authorization: `Bearer ${sellerToken}` },
      });
      expect(acceptRes.statusCode).toBe(200);
      expect(acceptRes.json().status).toBe('accepted');

      // Buyer confirms completion
      const buyerCompleteRes = await app.inject({
        method: 'POST',
        url: `/trades/${tradeId}/complete`,
        headers: { authorization: `Bearer ${buyerToken}` },
      });
      expect(buyerCompleteRes.statusCode).toBe(200);
      expect(buyerCompleteRes.json().message).toContain('Waiting');

      // Seller confirms completion
      const sellerCompleteRes = await app.inject({
        method: 'POST',
        url: `/trades/${tradeId}/complete`,
        headers: { authorization: `Bearer ${sellerToken}` },
      });
      expect(sellerCompleteRes.statusCode).toBe(200);
      expect(sellerCompleteRes.json().status).toBe('completed');
      expect(sellerCompleteRes.json().message).toContain('Both parties');
    });

    it('seller declines trade', async () => {
      const seller = await createTestUser('dec_s');
      const buyer = await createTestUser('dec_b');
      const sellerToken = await getToken(seller);
      const buyerToken = await getToken(buyer);
      const listing = await createListing(sellerToken);

      const offerRes = await app.inject({
        method: 'POST',
        url: '/trades',
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { listing_id: listing.id },
      });
      const tradeId = offerRes.json().id;

      const res = await app.inject({
        method: 'POST',
        url: `/trades/${tradeId}/decline`,
        headers: { authorization: `Bearer ${sellerToken}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('declined');
    });

    it('buyer cancels trade', async () => {
      const seller = await createTestUser('can_s');
      const buyer = await createTestUser('can_b');
      const sellerToken = await getToken(seller);
      const buyerToken = await getToken(buyer);
      const listing = await createListing(sellerToken);

      const offerRes = await app.inject({
        method: 'POST',
        url: '/trades',
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { listing_id: listing.id },
      });
      const tradeId = offerRes.json().id;

      const res = await app.inject({
        method: 'POST',
        url: `/trades/${tradeId}/cancel`,
        headers: { authorization: `Bearer ${buyerToken}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('cancelled');
    });

    it('buyer cannot accept (seller only)', async () => {
      const seller = await createTestUser('perm_s');
      const buyer = await createTestUser('perm_b');
      const sellerToken = await getToken(seller);
      const buyerToken = await getToken(buyer);
      const listing = await createListing(sellerToken);

      const offerRes = await app.inject({
        method: 'POST',
        url: '/trades',
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { listing_id: listing.id },
      });
      const tradeId = offerRes.json().id;

      const res = await app.inject({
        method: 'POST',
        url: `/trades/${tradeId}/accept`,
        headers: { authorization: `Bearer ${buyerToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('cannot complete from offered status', async () => {
      const seller = await createTestUser('stat_s');
      const buyer = await createTestUser('stat_b');
      const sellerToken = await getToken(seller);
      const buyerToken = await getToken(buyer);
      const listing = await createListing(sellerToken);

      const offerRes = await app.inject({
        method: 'POST',
        url: '/trades',
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { listing_id: listing.id },
      });
      const tradeId = offerRes.json().id;

      const res = await app.inject({
        method: 'POST',
        url: `/trades/${tradeId}/complete`,
        headers: { authorization: `Bearer ${buyerToken}` },
      });
      expect(res.statusCode).toBe(400);
    });

    it('prevents duplicate completion confirmation', async () => {
      const seller = await createTestUser('dupcomp_s');
      const buyer = await createTestUser('dupcomp_b');
      const sellerToken = await getToken(seller);
      const buyerToken = await getToken(buyer);
      const listing = await createListing(sellerToken);

      const offerRes = await app.inject({
        method: 'POST',
        url: '/trades',
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { listing_id: listing.id },
      });
      const tradeId = offerRes.json().id;

      // Accept
      await app.inject({
        method: 'POST',
        url: `/trades/${tradeId}/accept`,
        headers: { authorization: `Bearer ${sellerToken}` },
      });

      // Buyer confirms once
      await app.inject({
        method: 'POST',
        url: `/trades/${tradeId}/complete`,
        headers: { authorization: `Bearer ${buyerToken}` },
      });

      // Buyer tries to confirm again
      const res = await app.inject({
        method: 'POST',
        url: `/trades/${tradeId}/complete`,
        headers: { authorization: `Bearer ${buyerToken}` },
      });
      expect(res.statusCode).toBe(409);
    });
  });

  describe('GET /trades', () => {
    it('lists my trades', async () => {
      const seller = await createTestUser('mylist_s');
      const buyer = await createTestUser('mylist_b');
      const sellerToken = await getToken(seller);
      const buyerToken = await getToken(buyer);
      const listing = await createListing(sellerToken);

      await app.inject({
        method: 'POST',
        url: '/trades',
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { listing_id: listing.id },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/trades',
        headers: { authorization: `Bearer ${buyerToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.trades).toHaveLength(1);
      expect(body.trades[0].buyer_nickname).toBe('tradetest_mylist_b');
    });

    it('filters by role', async () => {
      const seller = await createTestUser('role_s');
      const buyer = await createTestUser('role_b');
      const sellerToken = await getToken(seller);
      const buyerToken = await getToken(buyer);
      const listing = await createListing(sellerToken);

      await app.inject({
        method: 'POST',
        url: '/trades',
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { listing_id: listing.id },
      });

      // Seller sees it with role=seller
      const sellerRes = await app.inject({
        method: 'GET',
        url: '/trades?role=seller',
        headers: { authorization: `Bearer ${sellerToken}` },
      });
      expect(sellerRes.json().trades).toHaveLength(1);

      // Seller sees nothing with role=buyer
      const noneRes = await app.inject({
        method: 'GET',
        url: '/trades?role=buyer',
        headers: { authorization: `Bearer ${sellerToken}` },
      });
      expect(noneRes.json().trades).toHaveLength(0);
    });
  });

  describe('GET /trades/:id', () => {
    it('returns trade details with events', async () => {
      const seller = await createTestUser('detail_s');
      const buyer = await createTestUser('detail_b');
      const sellerToken = await getToken(seller);
      const buyerToken = await getToken(buyer);
      const listing = await createListing(sellerToken);

      const offerRes = await app.inject({
        method: 'POST',
        url: '/trades',
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { listing_id: listing.id },
      });
      const tradeId = offerRes.json().id;

      const res = await app.inject({
        method: 'GET',
        url: `/trades/${tradeId}`,
        headers: { authorization: `Bearer ${buyerToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.listing_title).toBe('Test item for trading');
      expect(body.events).toHaveLength(1);
      expect(body.events[0].event_type).toBe('offered');
    });

    it('rejects non-participant', async () => {
      const seller = await createTestUser('nonpart_s');
      const buyer = await createTestUser('nonpart_b');
      const outsider = await createTestUser('nonpart_o');
      const sellerToken = await getToken(seller);
      const buyerToken = await getToken(buyer);
      const outsiderToken = await getToken(outsider);
      const listing = await createListing(sellerToken);

      const offerRes = await app.inject({
        method: 'POST',
        url: '/trades',
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { listing_id: listing.id },
      });
      const tradeId = offerRes.json().id;

      const res = await app.inject({
        method: 'GET',
        url: `/trades/${tradeId}`,
        headers: { authorization: `Bearer ${outsiderToken}` },
      });
      expect(res.statusCode).toBe(403);
    });
  });
});
