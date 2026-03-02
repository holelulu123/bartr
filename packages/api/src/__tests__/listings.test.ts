import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';
import { signAccessToken } from '../lib/jwt.js';

describe('Listing routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ skipRateLimit: true });
    await app.ready();

    // Run migration for FTS + categories if not already present
    await app.pg.query(`
      ALTER TABLE listings ADD COLUMN IF NOT EXISTS search_vector tsvector
    `);
    await app.pg.query(`
      CREATE INDEX IF NOT EXISTS idx_listings_fts ON listings USING GIN (search_vector)
    `);
    await app.pg.query(`
      CREATE OR REPLACE FUNCTION listings_search_trigger() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector :=
          setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
          setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B');
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await app.pg.query(`
      DROP TRIGGER IF EXISTS trg_listings_search ON listings
    `);
    await app.pg.query(`
      CREATE TRIGGER trg_listings_search
        BEFORE INSERT OR UPDATE OF title, description ON listings
        FOR EACH ROW EXECUTE FUNCTION listings_search_trigger()
    `);
    await app.pg.query(`
      ALTER TABLE listings ADD COLUMN IF NOT EXISTS country_code TEXT
    `);
    await app.pg.query(`
      CREATE INDEX IF NOT EXISTS idx_listings_country ON listings (country_code)
    `);
    await app.pg.query(`
      INSERT INTO categories (name, slug, parent_id) VALUES
        ('Electronics', 'electronics', NULL),
        ('Computers', 'computers', NULL),
        ('Other', 'other', NULL)
      ON CONFLICT (slug) DO NOTHING
    `);
  });

  afterAll(async () => {
    await app.pg.query("DELETE FROM listing_images WHERE listing_id IN (SELECT id FROM listings WHERE user_id IN (SELECT id FROM users WHERE nickname LIKE 'listtest_%'))");
    await app.pg.query("DELETE FROM listings WHERE user_id IN (SELECT id FROM users WHERE nickname LIKE 'listtest_%')");
    await app.pg.query("DELETE FROM reputation_scores WHERE user_id IN (SELECT id FROM users WHERE nickname LIKE 'listtest_%')");
    await app.pg.query("DELETE FROM users WHERE nickname LIKE 'listtest_%'");
    await app.close();
  });

  beforeEach(async () => {
    await app.pg.query("DELETE FROM listing_images WHERE listing_id IN (SELECT id FROM listings WHERE user_id IN (SELECT id FROM users WHERE nickname LIKE 'listtest_%'))");
    await app.pg.query("DELETE FROM listings WHERE user_id IN (SELECT id FROM users WHERE nickname LIKE 'listtest_%')");
    await app.pg.query("DELETE FROM reputation_scores WHERE user_id IN (SELECT id FROM users WHERE nickname LIKE 'listtest_%')");
    await app.pg.query("DELETE FROM users WHERE nickname LIKE 'listtest_%'");
  });

  async function createTestUser(suffix: string) {
    const result = await app.pg.query(
      `INSERT INTO users (google_id, nickname, email_encrypted, password_hash, bio, email_verified)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       RETURNING id, nickname`,
      [`google_list_${suffix}`, `listtest_${suffix}`, null, 'hash', ''],
    );
    const user = result.rows[0];
    await app.pg.query('INSERT INTO reputation_scores (user_id) VALUES ($1)', [user.id]);
    return user;
  }

  async function getToken(user: { id: string; nickname: string }) {
    return signAccessToken({ sub: user.id, nickname: user.nickname });
  }

  const validListing = {
    title: 'Selling a GPU',
    description: 'NVIDIA RTX 4090, barely used, great condition for mining or gaming',
    payment_methods: ['btc', 'eth'],
    price_indication: '1500',
    currency: 'USD',
    country_code: 'US',
  };

  describe('POST /listings', () => {
    it('creates a listing with valid data', async () => {
      const user = await createTestUser('create1');
      const token = await getToken(user);

      const res = await app.inject({
        method: 'POST',
        url: '/listings',
        headers: { authorization: `Bearer ${token}` },
        payload: validListing,
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.id).toBeDefined();
      expect(body.title).toBe('Selling a GPU');
      expect(body.status).toBe('active');
      expect(body.user_id).toBe(user.id);
    });

    it('creates a listing with a category', async () => {
      const user = await createTestUser('create2');
      const token = await getToken(user);

      const catRes = await app.pg.query("SELECT id FROM categories WHERE slug = 'electronics'");
      const categoryId = catRes.rows[0].id;

      const res = await app.inject({
        method: 'POST',
        url: '/listings',
        headers: { authorization: `Bearer ${token}` },
        payload: { ...validListing, category_id: categoryId },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().category_id).toBe(categoryId);
    });

    it('rejects short title', async () => {
      const user = await createTestUser('create3');
      const token = await getToken(user);

      const res = await app.inject({
        method: 'POST',
        url: '/listings',
        headers: { authorization: `Bearer ${token}` },
        payload: { ...validListing, title: 'ab' },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('Title');
    });

    it('rejects short description', async () => {
      const user = await createTestUser('create4');
      const token = await getToken(user);

      const res = await app.inject({
        method: 'POST',
        url: '/listings',
        headers: { authorization: `Bearer ${token}` },
        payload: { ...validListing, description: 'too short' },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('Description');
    });

    it('rejects invalid payment method', async () => {
      const user = await createTestUser('create5');
      const token = await getToken(user);

      const res = await app.inject({
        method: 'POST',
        url: '/listings',
        headers: { authorization: `Bearer ${token}` },
        payload: { ...validListing, payment_methods: ['dogecoin'] },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('Invalid payment method');
    });

    it('rejects missing price_indication', async () => {
      const user = await createTestUser('create6');
      const token = await getToken(user);

      const { price_indication, ...noPrice } = validListing;
      const res = await app.inject({
        method: 'POST',
        url: '/listings',
        headers: { authorization: `Bearer ${token}` },
        payload: noPrice,
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('price_indication');
    });

    it('rejects non-numeric price_indication', async () => {
      const user = await createTestUser('create7');
      const token = await getToken(user);

      const res = await app.inject({
        method: 'POST',
        url: '/listings',
        headers: { authorization: `Bearer ${token}` },
        payload: { ...validListing, price_indication: 'free' },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('positive number');
    });

    it('rejects invalid currency code', async () => {
      const user = await createTestUser('create8');
      const token = await getToken(user);

      const res = await app.inject({
        method: 'POST',
        url: '/listings',
        headers: { authorization: `Bearer ${token}` },
        payload: { ...validListing, currency: 'FAKE' },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('Invalid currency');
    });

    it('rejects missing currency', async () => {
      const user = await createTestUser('create9');
      const token = await getToken(user);

      const { currency, ...noCurrency } = validListing;
      const res = await app.inject({
        method: 'POST',
        url: '/listings',
        headers: { authorization: `Bearer ${token}` },
        payload: noCurrency,
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('currency');
    });

    it('rejects unauthenticated request', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/listings',
        payload: validListing,
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /listings/:id', () => {
    it('returns a listing by id', async () => {
      const user = await createTestUser('get1');
      const token = await getToken(user);

      const createRes = await app.inject({
        method: 'POST',
        url: '/listings',
        headers: { authorization: `Bearer ${token}` },
        payload: validListing,
      });

      const listingId = createRes.json().id;

      const res = await app.inject({
        method: 'GET',
        url: `/listings/${listingId}`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.title).toBe('Selling a GPU');
      expect(body.seller_nickname).toBe('listtest_get1');
    });

    it('returns 404 for nonexistent listing', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/listings/00000000-0000-0000-0000-000000000000',
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 400 for invalid UUID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/listings/not-a-valid-uuid',
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('Invalid listing id');
    });
  });

  describe('GET /listings', () => {
    it('lists active listings with pagination', async () => {
      const user = await createTestUser('list1');
      const token = await getToken(user);

      // Create 3 listings
      for (let i = 0; i < 3; i++) {
        await app.inject({
          method: 'POST',
          url: '/listings',
          headers: { authorization: `Bearer ${token}` },
          payload: { ...validListing, title: `GPU number ${i + 1} for sale` },
        });
      }

      const res = await app.inject({
        method: 'GET',
        url: `/listings?limit=2&user_id=${user.id}`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.listings).toHaveLength(2);
      expect(body.pagination.total).toBe(3);
      expect(body.pagination.pages).toBe(2);
    });

    it('filters by user_id', async () => {
      const user1 = await createTestUser('list2a');
      const user2 = await createTestUser('list2b');
      const token1 = await getToken(user1);
      const token2 = await getToken(user2);

      await app.inject({
        method: 'POST',
        url: '/listings',
        headers: { authorization: `Bearer ${token1}` },
        payload: validListing,
      });
      await app.inject({
        method: 'POST',
        url: '/listings',
        headers: { authorization: `Bearer ${token2}` },
        payload: { ...validListing, title: 'Different GPU for sale' },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/listings?user_id=${user1.id}`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().listings).toHaveLength(1);
      expect(res.json().listings[0].seller_nickname).toBe('listtest_list2a');
    });

    it('searches by full-text query', async () => {
      const user = await createTestUser('search1');
      const token = await getToken(user);

      await app.inject({
        method: 'POST',
        url: '/listings',
        headers: { authorization: `Bearer ${token}` },
        payload: { ...validListing, title: 'Rare vintage keyboard mechanical' },
      });
      await app.inject({
        method: 'POST',
        url: '/listings',
        headers: { authorization: `Bearer ${token}` },
        payload: { ...validListing, title: 'Brand new laptop for crypto' },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/listings?q=keyboard',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.listings).toHaveLength(1);
      expect(body.listings[0].title).toContain('keyboard');
    });
  });

  describe('PUT /listings/:id', () => {
    it('updates own listing', async () => {
      const user = await createTestUser('upd1');
      const token = await getToken(user);

      const createRes = await app.inject({
        method: 'POST',
        url: '/listings',
        headers: { authorization: `Bearer ${token}` },
        payload: validListing,
      });
      const listingId = createRes.json().id;

      const res = await app.inject({
        method: 'PUT',
        url: `/listings/${listingId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'Updated GPU title here', status: 'paused' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().title).toBe('Updated GPU title here');
      expect(res.json().status).toBe('paused');
    });

    it('rejects update from non-owner', async () => {
      const owner = await createTestUser('upd2a');
      const other = await createTestUser('upd2b');
      const ownerToken = await getToken(owner);
      const otherToken = await getToken(other);

      const createRes = await app.inject({
        method: 'POST',
        url: '/listings',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: validListing,
      });
      const listingId = createRes.json().id;

      const res = await app.inject({
        method: 'PUT',
        url: `/listings/${listingId}`,
        headers: { authorization: `Bearer ${otherToken}` },
        payload: { title: 'Hacked title that is long enough' },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('DELETE /listings/:id', () => {
    it('deletes own listing', async () => {
      const user = await createTestUser('del1');
      const token = await getToken(user);

      const createRes = await app.inject({
        method: 'POST',
        url: '/listings',
        headers: { authorization: `Bearer ${token}` },
        payload: validListing,
      });
      const listingId = createRes.json().id;

      const res = await app.inject({
        method: 'DELETE',
        url: `/listings/${listingId}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().ok).toBe(true);

      // Verify it's gone
      const getRes = await app.inject({
        method: 'GET',
        url: `/listings/${listingId}`,
      });
      expect(getRes.statusCode).toBe(404);
    });

    it('rejects delete from non-owner', async () => {
      const owner = await createTestUser('del2a');
      const other = await createTestUser('del2b');
      const ownerToken = await getToken(owner);
      const otherToken = await getToken(other);

      const createRes = await app.inject({
        method: 'POST',
        url: '/listings',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: validListing,
      });
      const listingId = createRes.json().id;

      const res = await app.inject({
        method: 'DELETE',
        url: `/listings/${listingId}`,
        headers: { authorization: `Bearer ${otherToken}` },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /categories', () => {
    it('returns list of categories', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/categories',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.categories).toBeDefined();
      expect(body.categories.length).toBeGreaterThanOrEqual(3);
      expect(body.categories.find((c: { slug: string }) => c.slug === 'electronics')).toBeTruthy();
    });
  });
});
