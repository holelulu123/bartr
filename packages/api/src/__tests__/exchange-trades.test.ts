import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';
import { signAccessToken } from '../lib/jwt.js';

describe('Exchange trade proposal routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ skipRateLimit: true });
    await app.ready();

    // Ensure new columns exist
    await app.pg.query('ALTER TABLE trades ADD COLUMN IF NOT EXISTS fiat_amount NUMERIC(20, 2)');
    await app.pg.query('ALTER TABLE trades ADD COLUMN IF NOT EXISTS payment_method TEXT');
  });

  afterAll(async () => {
    await app.pg.query("DELETE FROM trade_events WHERE trade_id IN (SELECT id FROM trades WHERE buyer_id IN (SELECT id FROM users WHERE nickname LIKE 'extrtest_%') OR seller_id IN (SELECT id FROM users WHERE nickname LIKE 'extrtest_%'))");
    await app.pg.query("DELETE FROM trades WHERE buyer_id IN (SELECT id FROM users WHERE nickname LIKE 'extrtest_%') OR seller_id IN (SELECT id FROM users WHERE nickname LIKE 'extrtest_%')");
    await app.pg.query("DELETE FROM exchange_offers WHERE user_id IN (SELECT id FROM users WHERE nickname LIKE 'extrtest_%')");
    await app.pg.query("DELETE FROM reputation_scores WHERE user_id IN (SELECT id FROM users WHERE nickname LIKE 'extrtest_%')");
    await app.pg.query("DELETE FROM users WHERE nickname LIKE 'extrtest_%'");
    await app.close();
  });

  beforeEach(async () => {
    await app.pg.query("DELETE FROM trade_events WHERE trade_id IN (SELECT id FROM trades WHERE buyer_id IN (SELECT id FROM users WHERE nickname LIKE 'extrtest_%') OR seller_id IN (SELECT id FROM users WHERE nickname LIKE 'extrtest_%'))");
    await app.pg.query("DELETE FROM trades WHERE buyer_id IN (SELECT id FROM users WHERE nickname LIKE 'extrtest_%') OR seller_id IN (SELECT id FROM users WHERE nickname LIKE 'extrtest_%')");
    await app.pg.query("DELETE FROM exchange_offers WHERE user_id IN (SELECT id FROM users WHERE nickname LIKE 'extrtest_%')");
    await app.pg.query("DELETE FROM reputation_scores WHERE user_id IN (SELECT id FROM users WHERE nickname LIKE 'extrtest_%')");
    await app.pg.query("DELETE FROM users WHERE nickname LIKE 'extrtest_%'");
  });

  async function createTestUser(suffix: string) {
    const result = await app.pg.query(
      `INSERT INTO users (google_id, nickname, email_encrypted, password_hash, bio, email_verified)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       RETURNING id, nickname`,
      [`google_extr_${suffix}`, `extrtest_${suffix}`, null, 'hash', ''],
    );
    const user = result.rows[0];
    await app.pg.query('INSERT INTO reputation_scores (user_id) VALUES ($1)', [user.id]);
    return user;
  }

  async function getToken(user: { id: string; nickname: string }) {
    return signAccessToken({ sub: user.id, nickname: user.nickname });
  }

  async function createOffer(userId: string, overrides: Record<string, unknown> = {}) {
    const defaults = {
      offer_type: 'sell',
      crypto_currency: 'BTC',
      fiat_currency: 'USD',
      min_amount: 100,
      max_amount: 5000,
      rate_type: 'market',
      margin_percent: 2,
      payment_methods: JSON.stringify(['bank_transfer', 'cash_in_person']),
      status: 'active',
    };
    const vals = { ...defaults, ...overrides };

    const result = await app.pg.query(
      `INSERT INTO exchange_offers (user_id, offer_type, crypto_currency, fiat_currency, min_amount, max_amount, rate_type, margin_percent, payment_methods, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [userId, vals.offer_type, vals.crypto_currency, vals.fiat_currency, vals.min_amount, vals.max_amount, vals.rate_type, vals.margin_percent, vals.payment_methods, vals.status],
    );
    return result.rows[0];
  }

  describe('POST /trades — exchange offer with proposal fields', () => {
    it('creates a trade with fiat_amount and payment_method', async () => {
      const seller = await createTestUser('seller1');
      const buyer = await createTestUser('buyer1');
      const buyerToken = await getToken(buyer);
      const offer = await createOffer(seller.id);

      const res = await app.inject({
        method: 'POST',
        url: '/trades',
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { offer_id: offer.id, fiat_amount: 500, payment_method: 'bank_transfer' },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.status).toBe('offered');
      expect(Number(body.fiat_amount)).toBe(500);
      expect(body.payment_method).toBe('bank_transfer');
      expect(body.buyer_id).toBe(buyer.id);
      expect(body.seller_id).toBe(seller.id);
    });

    it('rejects missing fiat_amount', async () => {
      const seller = await createTestUser('noamt_s');
      const buyer = await createTestUser('noamt_b');
      const buyerToken = await getToken(buyer);
      const offer = await createOffer(seller.id);

      const res = await app.inject({
        method: 'POST',
        url: '/trades',
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { offer_id: offer.id, payment_method: 'bank_transfer' },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('fiat_amount');
    });

    it('rejects missing payment_method', async () => {
      const seller = await createTestUser('nopm_s');
      const buyer = await createTestUser('nopm_b');
      const buyerToken = await getToken(buyer);
      const offer = await createOffer(seller.id);

      const res = await app.inject({
        method: 'POST',
        url: '/trades',
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { offer_id: offer.id, fiat_amount: 500 },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('payment_method');
    });

    it('rejects fiat_amount below min', async () => {
      const seller = await createTestUser('below_s');
      const buyer = await createTestUser('below_b');
      const buyerToken = await getToken(buyer);
      const offer = await createOffer(seller.id, { min_amount: 100, max_amount: 5000 });

      const res = await app.inject({
        method: 'POST',
        url: '/trades',
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { offer_id: offer.id, fiat_amount: 50, payment_method: 'bank_transfer' },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('between');
    });

    it('rejects fiat_amount above max', async () => {
      const seller = await createTestUser('above_s');
      const buyer = await createTestUser('above_b');
      const buyerToken = await getToken(buyer);
      const offer = await createOffer(seller.id, { min_amount: 100, max_amount: 5000 });

      const res = await app.inject({
        method: 'POST',
        url: '/trades',
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { offer_id: offer.id, fiat_amount: 10000, payment_method: 'bank_transfer' },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('between');
    });

    it('rejects invalid payment_method', async () => {
      const seller = await createTestUser('badpm_s');
      const buyer = await createTestUser('badpm_b');
      const buyerToken = await getToken(buyer);
      const offer = await createOffer(seller.id);

      const res = await app.inject({
        method: 'POST',
        url: '/trades',
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { offer_id: offer.id, fiat_amount: 500, payment_method: 'paypal' },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('payment_method');
    });

    it('rejects negative fiat_amount', async () => {
      const seller = await createTestUser('neg_s');
      const buyer = await createTestUser('neg_b');
      const buyerToken = await getToken(buyer);
      const offer = await createOffer(seller.id);

      const res = await app.inject({
        method: 'POST',
        url: '/trades',
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { offer_id: offer.id, fiat_amount: -100, payment_method: 'bank_transfer' },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('positive');
    });
  });

  describe('GET /trades?offer_id=X', () => {
    it('filters trades by offer_id', async () => {
      const seller = await createTestUser('filter_s');
      const buyer = await createTestUser('filter_b');
      const sellerToken = await getToken(seller);
      const buyerToken = await getToken(buyer);

      const offer1 = await createOffer(seller.id);
      const offer2 = await createOffer(seller.id);

      // Create trade on offer1
      await app.inject({
        method: 'POST',
        url: '/trades',
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { offer_id: offer1.id, fiat_amount: 500, payment_method: 'bank_transfer' },
      });

      // Query trades for offer1 — should see 1
      const res1 = await app.inject({
        method: 'GET',
        url: `/trades?offer_id=${offer1.id}`,
        headers: { authorization: `Bearer ${sellerToken}` },
      });
      expect(res1.statusCode).toBe(200);
      expect(res1.json().trades).toHaveLength(1);
      expect(Number(res1.json().trades[0].fiat_amount)).toBe(500);

      // Query trades for offer2 — should see 0
      const res2 = await app.inject({
        method: 'GET',
        url: `/trades?offer_id=${offer2.id}`,
        headers: { authorization: `Bearer ${sellerToken}` },
      });
      expect(res2.statusCode).toBe(200);
      expect(res2.json().trades).toHaveLength(0);
    });
  });

  describe('GET /trades/:id — proposal fields', () => {
    it('returns fiat_amount and payment_method in trade detail', async () => {
      const seller = await createTestUser('det_s');
      const buyer = await createTestUser('det_b');
      const buyerToken = await getToken(buyer);
      const offer = await createOffer(seller.id);

      const createRes = await app.inject({
        method: 'POST',
        url: '/trades',
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: { offer_id: offer.id, fiat_amount: 1234.56, payment_method: 'cash_in_person' },
      });
      const tradeId = createRes.json().id;

      const res = await app.inject({
        method: 'GET',
        url: `/trades/${tradeId}`,
        headers: { authorization: `Bearer ${buyerToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Number(body.fiat_amount)).toBe(1234.56);
      expect(body.payment_method).toBe('cash_in_person');
      expect(body.offer_summary).toContain('BTC/USD');
    });
  });
});
