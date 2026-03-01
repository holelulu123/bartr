import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import * as argon2 from 'argon2';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';
import { signAccessToken, signRefreshToken, verifyToken } from '../lib/jwt.js';

/**
 * End-to-End API Integration Tests (Phase 13.9)
 *
 * Full user flows against a real database. No mocks.
 * Requires: postgres on localhost:5433, redis on localhost:6379
 * Run with: docker compose -f docker-compose.dev.yml up -d postgres redis
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

const TEST_PREFIX = `e2etest_${Date.now()}`;

function testEmailHmac(email: string): string {
  const raw = process.env.ENCRYPTION_KEY;
  const key = raw
    ? Buffer.from(raw, 'hex')
    : Buffer.from('bartr-dev-encryption-key-32bytes!'.padEnd(32).slice(0, 32));
  return crypto.createHmac('sha256', key).update(email.toLowerCase().trim()).digest('hex');
}

const TEST_KEYS = {
  public_key: 'MCowBQYDK2VuAyEAtest_public_key_base64',
  private_key_blob: Buffer.from('encrypted_private_key').toString('base64'),
  recovery_key_blob: Buffer.from('recovery_wrapped_key').toString('base64'),
};

async function registerUser(
  app: FastifyInstance,
  email: string,
  password = 'TestPass123!',
  { verify = false } = {},
): Promise<{ access_token: string; refresh_token: string; nickname: string; id: string }> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register/email',
    payload: { email, password, ...TEST_KEYS },
  });
  const body = res.json();
  const payload = await verifyToken(body.access_token);
  const result = { ...body, nickname: payload.nickname, id: payload.sub };
  if (verify) {
    await app.pg.query('UPDATE users SET email_verified = TRUE WHERE id = $1', [result.id]);
  }
  return result;
}

function authHeaders(token: string) {
  return { authorization: `Bearer ${token}` };
}

// ── Test Suites ──────────────────────────────────────────────────────────────

describe('E2E Integration — Auth Flows', () => {
  let app: FastifyInstance;
  const TEST_EMAILS = [`auth1_${TEST_PREFIX}@test.com`, `auth2_${TEST_PREFIX}@test.com`];
  const TEST_EMAIL_HASHES = TEST_EMAILS.map(testEmailHmac);

  async function cleanup() {
    await app.pg.query("DELETE FROM reputation_scores WHERE user_id IN (SELECT id FROM users WHERE email_hash = ANY($1))", [TEST_EMAIL_HASHES]);
    await app.pg.query('DELETE FROM users WHERE email_hash = ANY($1)', [TEST_EMAIL_HASHES]);
    await app.pg.query('DELETE FROM refresh_tokens WHERE user_id NOT IN (SELECT id FROM users)');
  }

  beforeAll(async () => {
    app = await buildApp({ skipRateLimit: true, skipMinio: true });
    await app.ready();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  beforeEach(cleanup);

  it('registers two users via POST /auth/register/email', async () => {
    const user1 = await registerUser(app, TEST_EMAILS[0]);
    const user2 = await registerUser(app, TEST_EMAILS[1]);

    expect(user1.access_token).toBeDefined();
    expect(user2.access_token).toBeDefined();
    expect(user1.nickname).not.toBe(user2.nickname);
  });

  it('logs in with correct password', async () => {
    await registerUser(app, TEST_EMAILS[0], 'MyPassword123!');

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login/email',
      payload: { email: TEST_EMAILS[0], password: 'MyPassword123!' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().access_token).toBeDefined();
    expect(res.json().refresh_token).toBeDefined();
  });

  it('rejects login with wrong password', async () => {
    await registerUser(app, TEST_EMAILS[0], 'MyPassword123!');

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login/email',
      payload: { email: TEST_EMAILS[0], password: 'WrongPassword123!' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('refreshes token and returns new token pair', async () => {
    const { refresh_token } = await registerUser(app, TEST_EMAILS[0]);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refresh_token },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.access_token).toBeDefined();
    expect(body.refresh_token).not.toBe(refresh_token);
  });

  it('rejects access to protected endpoint without token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /auth/me returns correct user', async () => {
    const user = await registerUser(app, TEST_EMAILS[0]);

    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: authHeaders(user.access_token),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().nickname).toBe(user.nickname);
    expect(res.json().id).toBe(user.id);
  });

  it('rejects expired/invalid tokens', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: authHeaders('invalid.jwt.token'),
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('E2E Integration — Listings CRUD', () => {
  let app: FastifyInstance;
  let userA: { access_token: string; nickname: string; id: string };
  let userB: { access_token: string; nickname: string; id: string };

  const TEST_EMAILS = [`listA_${TEST_PREFIX}@test.com`, `listB_${TEST_PREFIX}@test.com`];
  const TEST_EMAIL_HASHES = TEST_EMAILS.map(testEmailHmac);

  async function cleanup() {
    const userIds = await app.pg.query('SELECT id FROM users WHERE email_hash = ANY($1)', [TEST_EMAIL_HASHES]);
    const ids = userIds.rows.map((r: { id: string }) => r.id);
    if (ids.length > 0) {
      await app.pg.query('DELETE FROM trade_events WHERE trade_id IN (SELECT id FROM trades WHERE buyer_id = ANY($1) OR seller_id = ANY($1))', [ids]);
      await app.pg.query('DELETE FROM trades WHERE buyer_id = ANY($1) OR seller_id = ANY($1)', [ids]);
      await app.pg.query('DELETE FROM listing_images WHERE listing_id IN (SELECT id FROM listings WHERE user_id = ANY($1))', [ids]);
      await app.pg.query('DELETE FROM listings WHERE user_id = ANY($1)', [ids]);
      await app.pg.query('DELETE FROM reputation_scores WHERE user_id = ANY($1)', [ids]);
    }
    await app.pg.query('DELETE FROM users WHERE email_hash = ANY($1)', [TEST_EMAIL_HASHES]);
    await app.pg.query('DELETE FROM refresh_tokens WHERE user_id NOT IN (SELECT id FROM users)');
  }

  beforeAll(async () => {
    app = await buildApp({ skipRateLimit: true, skipMinio: true });
    await app.ready();
    await cleanup();

    userA = await registerUser(app, TEST_EMAILS[0], 'TestPass123!', { verify: true });
    userB = await registerUser(app, TEST_EMAILS[1], 'TestPass123!', { verify: true });
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  let createdListingId: string;

  it('User A creates a listing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/listings',
      headers: authHeaders(userA.access_token),
      payload: {
        title: 'E2E Test Laptop',
        description: 'A laptop for sale, e2e integration test listing.',
        payment_methods: ['btc', 'cash'],
        price_indication: '500',
        currency: 'USD',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.title).toBe('E2E Test Laptop');
    expect(body.user_id).toBe(userA.id);
    createdListingId = body.id;
  });

  it('gets listing by ID with correct data', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/listings/${createdListingId}`,
    });

    expect(res.statusCode).toBe(200);
    const listing = res.json();
    expect(listing.title).toBe('E2E Test Laptop');
    expect(listing.seller_nickname).toBe(userA.nickname);
  });

  it('lists all listings and contains the created listing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/listings',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.listings).toBeInstanceOf(Array);
    const found = body.listings.find((l: { id: string }) => l.id === createdListingId);
    expect(found).toBeDefined();
  });

  it('User A updates the listing', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/listings/${createdListingId}`,
      headers: authHeaders(userA.access_token),
      payload: {
        title: 'E2E Test Laptop Updated',
        description: 'Updated description for e2e test.',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe('E2E Test Laptop Updated');
  });

  it('rejects update from non-owner User B', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/listings/${createdListingId}`,
      headers: authHeaders(userB.access_token),
      payload: { title: 'Hacked Title' },
    });

    expect(res.statusCode).toBe(403);
  });

  it('User A deletes the listing', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/listings/${createdListingId}`,
      headers: authHeaders(userA.access_token),
    });

    expect(res.statusCode).toBe(200);
  });

  it('deleted listing returns 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/listings/${createdListingId}`,
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('E2E Integration — Messaging (two-user flow)', () => {
  let app: FastifyInstance;
  let userA: { access_token: string; nickname: string; id: string };
  let userB: { access_token: string; nickname: string; id: string };
  let listingId: string;

  const TEST_EMAILS = [`msgA_${TEST_PREFIX}@test.com`, `msgB_${TEST_PREFIX}@test.com`];
  const TEST_EMAIL_HASHES = TEST_EMAILS.map(testEmailHmac);

  async function cleanup() {
    const userIds = await app.pg.query('SELECT id FROM users WHERE email_hash = ANY($1)', [TEST_EMAIL_HASHES]);
    const ids = userIds.rows.map((r: { id: string }) => r.id);
    if (ids.length > 0) {
      await app.pg.query('DELETE FROM messages WHERE sender_id = ANY($1) OR recipient_id = ANY($1)', [ids]);
      await app.pg.query('DELETE FROM message_threads WHERE participant_1 = ANY($1) OR participant_2 = ANY($1)', [ids]);
      await app.pg.query('DELETE FROM listing_images WHERE listing_id IN (SELECT id FROM listings WHERE user_id = ANY($1))', [ids]);
      await app.pg.query('DELETE FROM listings WHERE user_id = ANY($1)', [ids]);
      await app.pg.query('DELETE FROM reputation_scores WHERE user_id = ANY($1)', [ids]);
    }
    await app.pg.query('DELETE FROM users WHERE email_hash = ANY($1)', [TEST_EMAIL_HASHES]);
    await app.pg.query('DELETE FROM refresh_tokens WHERE user_id NOT IN (SELECT id FROM users)');
  }

  beforeAll(async () => {
    app = await buildApp({ skipRateLimit: true, skipMinio: true });
    await app.ready();
    await cleanup();

    userA = await registerUser(app, TEST_EMAILS[0], 'TestPass123!', { verify: true });
    userB = await registerUser(app, TEST_EMAILS[1], 'TestPass123!', { verify: true });

    // User A creates a listing
    const listRes = await app.inject({
      method: 'POST',
      url: '/listings',
      headers: authHeaders(userA.access_token),
      payload: {
        title: 'E2E Messaging Test Listing',
        description: 'Listing for messaging integration test.',
        payment_methods: ['btc'],
      },
    });
    listingId = listRes.json().id;
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  let threadId: string;

  it('User B creates a thread with User A via listing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/threads',
      headers: authHeaders(userB.access_token),
      payload: { recipient_nickname: userA.nickname, listing_id: listingId },
    });

    expect(res.statusCode).toBe(201);
    threadId = res.json().id;
    expect(threadId).toBeDefined();
  });

  it('User B sends an encrypted message in the thread', async () => {
    const ciphertext = Buffer.from('fake-encrypted-message-from-B').toString('base64');

    const res = await app.inject({
      method: 'POST',
      url: `/threads/${threadId}/messages`,
      headers: authHeaders(userB.access_token),
      payload: { body_encrypted: ciphertext },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().sender_id).toBe(userB.id);
  });

  it('User A fetches thread messages and sees the message', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/threads/${threadId}/messages`,
      headers: authHeaders(userA.access_token),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.messages.length).toBe(1);
    expect(body.messages[0].sender_id).toBe(userB.id);
  });

  it('User A replies', async () => {
    const ciphertext = Buffer.from('fake-encrypted-reply-from-A').toString('base64');

    const res = await app.inject({
      method: 'POST',
      url: `/threads/${threadId}/messages`,
      headers: authHeaders(userA.access_token),
      payload: { body_encrypted: ciphertext },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().sender_id).toBe(userA.id);
  });

  it('User B fetches messages and sees both messages', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/threads/${threadId}/messages`,
      headers: authHeaders(userB.access_token),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().messages.length).toBe(2);
  });

  it('both users see the thread in their /threads list', async () => {
    const resA = await app.inject({
      method: 'GET',
      url: '/threads',
      headers: authHeaders(userA.access_token),
    });
    const resB = await app.inject({
      method: 'GET',
      url: '/threads',
      headers: authHeaders(userB.access_token),
    });

    expect(resA.statusCode).toBe(200);
    expect(resB.statusCode).toBe(200);

    const threadsA = resA.json().threads;
    const threadsB = resB.json().threads;

    expect(threadsA.find((t: { id: string }) => t.id === threadId)).toBeDefined();
    expect(threadsB.find((t: { id: string }) => t.id === threadId)).toBeDefined();
  });
});

describe('E2E Integration — Trades', () => {
  let app: FastifyInstance;
  let userA: { access_token: string; nickname: string; id: string }; // seller
  let userB: { access_token: string; nickname: string; id: string }; // buyer
  let listingId: string;

  const TEST_EMAILS = [`trdA_${TEST_PREFIX}@test.com`, `trdB_${TEST_PREFIX}@test.com`];
  const TEST_EMAIL_HASHES = TEST_EMAILS.map(testEmailHmac);

  async function cleanup() {
    const userIds = await app.pg.query('SELECT id FROM users WHERE email_hash = ANY($1)', [TEST_EMAIL_HASHES]);
    const ids = userIds.rows.map((r: { id: string }) => r.id);
    if (ids.length > 0) {
      await app.pg.query('DELETE FROM trade_events WHERE trade_id IN (SELECT id FROM trades WHERE buyer_id = ANY($1) OR seller_id = ANY($1))', [ids]);
      await app.pg.query('DELETE FROM trades WHERE buyer_id = ANY($1) OR seller_id = ANY($1)', [ids]);
      await app.pg.query('DELETE FROM listing_images WHERE listing_id IN (SELECT id FROM listings WHERE user_id = ANY($1))', [ids]);
      await app.pg.query('DELETE FROM listings WHERE user_id = ANY($1)', [ids]);
      await app.pg.query('DELETE FROM reputation_scores WHERE user_id = ANY($1)', [ids]);
    }
    await app.pg.query('DELETE FROM users WHERE email_hash = ANY($1)', [TEST_EMAIL_HASHES]);
    await app.pg.query('DELETE FROM refresh_tokens WHERE user_id NOT IN (SELECT id FROM users)');
  }

  beforeAll(async () => {
    app = await buildApp({ skipRateLimit: true, skipMinio: true });
    await app.ready();
    await cleanup();

    userA = await registerUser(app, TEST_EMAILS[0], 'TestPass123!', { verify: true });
    userB = await registerUser(app, TEST_EMAILS[1], 'TestPass123!', { verify: true });

    // User A creates a listing
    const listRes = await app.inject({
      method: 'POST',
      url: '/listings',
      headers: authHeaders(userA.access_token),
      payload: {
        title: 'E2E Trade Test Listing',
        description: 'Listing for trade integration test flow.',
        payment_methods: ['btc'],
      },
    });
    listingId = listRes.json().id;
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  let tradeId: string;

  it('User B initiates a trade on User A listing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/trades',
      headers: authHeaders(userB.access_token),
      payload: { listing_id: listingId },
    });

    expect(res.statusCode).toBe(201);
    const trade = res.json();
    expect(trade.status).toBe('offered');
    expect(trade.buyer_id).toBe(userB.id);
    expect(trade.seller_id).toBe(userA.id);
    tradeId = trade.id;
  });

  it('User A accepts the trade', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/trades/${tradeId}/accept`,
      headers: authHeaders(userA.access_token),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('accepted');
  });

  it('both users can view trade details', async () => {
    const resA = await app.inject({
      method: 'GET',
      url: `/trades/${tradeId}`,
      headers: authHeaders(userA.access_token),
    });
    const resB = await app.inject({
      method: 'GET',
      url: `/trades/${tradeId}`,
      headers: authHeaders(userB.access_token),
    });

    expect(resA.statusCode).toBe(200);
    expect(resB.statusCode).toBe(200);
    expect(resA.json().status).toBe('accepted');
  });

  it('trade can be completed', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/trades/${tradeId}/complete`,
      headers: authHeaders(userA.access_token),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('completed');
  });
});

describe('E2E Integration — User Profiles', () => {
  let app: FastifyInstance;
  let user: { access_token: string; nickname: string; id: string };

  const TEST_EMAILS = [`prof_${TEST_PREFIX}@test.com`];
  const TEST_EMAIL_HASHES = TEST_EMAILS.map(testEmailHmac);

  async function cleanup() {
    await app.pg.query("DELETE FROM reputation_scores WHERE user_id IN (SELECT id FROM users WHERE email_hash = ANY($1))", [TEST_EMAIL_HASHES]);
    await app.pg.query('DELETE FROM users WHERE email_hash = ANY($1)', [TEST_EMAIL_HASHES]);
    await app.pg.query('DELETE FROM refresh_tokens WHERE user_id NOT IN (SELECT id FROM users)');
  }

  beforeAll(async () => {
    app = await buildApp({ skipRateLimit: true, skipMinio: true });
    await app.ready();
    await cleanup();

    user = await registerUser(app, TEST_EMAILS[0]);
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('fetches user profile by nickname', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/users/${user.nickname}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().nickname).toBe(user.nickname);
    expect(res.json().reputation).toBeDefined();
  });

  it('updates own profile bio', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/users/me',
      headers: authHeaders(user.access_token),
      payload: { bio: 'E2E test bio updated' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().bio).toBe('E2E test bio updated');
  });

  it('fetches public key', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/users/${user.nickname}/public-key`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().public_key).toBe(TEST_KEYS.public_key);
  });
});

describe('E2E Integration — Edge Cases', () => {
  let app: FastifyInstance;
  let user: { access_token: string; nickname: string; id: string };

  const TEST_EMAILS = [`edge_${TEST_PREFIX}@test.com`];
  const TEST_EMAIL_HASHES = TEST_EMAILS.map(testEmailHmac);

  async function cleanup() {
    const userIds = await app.pg.query('SELECT id FROM users WHERE email_hash = ANY($1)', [TEST_EMAIL_HASHES]);
    const ids = userIds.rows.map((r: { id: string }) => r.id);
    if (ids.length > 0) {
      await app.pg.query('DELETE FROM messages WHERE sender_id = ANY($1) OR recipient_id = ANY($1)', [ids]);
      await app.pg.query('DELETE FROM message_threads WHERE participant_1 = ANY($1) OR participant_2 = ANY($1)', [ids]);
      await app.pg.query('DELETE FROM reputation_scores WHERE user_id = ANY($1)', [ids]);
    }
    await app.pg.query('DELETE FROM users WHERE email_hash = ANY($1)', [TEST_EMAIL_HASHES]);
    await app.pg.query('DELETE FROM refresh_tokens WHERE user_id NOT IN (SELECT id FROM users)');
  }

  beforeAll(async () => {
    app = await buildApp({ skipRateLimit: true, skipMinio: true });
    await app.ready();
    await cleanup();

    user = await registerUser(app, TEST_EMAILS[0], 'TestPass123!', { verify: true });
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('cannot message yourself', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/threads',
      headers: authHeaders(user.access_token),
      payload: { recipient_nickname: user.nickname },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/cannot message yourself/i);
  });

  it('cannot create duplicate thread for same listing+users', async () => {
    // Need a second user for this test
    const email2 = `edge2_${TEST_PREFIX}@test.com`;
    const emailHash2 = testEmailHmac(email2);
    const user2 = await registerUser(app, email2, 'TestPass123!', { verify: true });

    // Create a listing
    const listRes = await app.inject({
      method: 'POST',
      url: '/listings',
      headers: authHeaders(user.access_token),
      payload: {
        title: 'Edge Case Listing',
        description: 'Listing for testing duplicate thread prevention.',
        payment_methods: ['cash'],
      },
    });
    const listingId = listRes.json().id;

    // First thread creation
    const res1 = await app.inject({
      method: 'POST',
      url: '/threads',
      headers: authHeaders(user2.access_token),
      payload: { recipient_nickname: user.nickname, listing_id: listingId },
    });
    expect(res1.statusCode).toBe(201);

    // Second thread creation for same pair+listing returns existing
    const res2 = await app.inject({
      method: 'POST',
      url: '/threads',
      headers: authHeaders(user2.access_token),
      payload: { recipient_nickname: user.nickname, listing_id: listingId },
    });
    expect(res2.statusCode).toBe(200);
    expect(res2.json().existing).toBe(true);
    expect(res2.json().id).toBe(res1.json().id);

    // Clean up extra user
    await app.pg.query('DELETE FROM messages WHERE sender_id = $1 OR recipient_id = $1', [user2.id]);
    await app.pg.query('DELETE FROM message_threads WHERE participant_1 = $1 OR participant_2 = $1', [user2.id]);
    await app.pg.query('DELETE FROM listing_images WHERE listing_id = $1', [listingId]);
    await app.pg.query('DELETE FROM listings WHERE id = $1', [listingId]);
    await app.pg.query('DELETE FROM reputation_scores WHERE user_id = $1', [user2.id]);
    await app.pg.query('DELETE FROM users WHERE email_hash = $1', [emailHash2]);
  });

  it('rejects duplicate email registration', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register/email',
      payload: { email: TEST_EMAILS[0], password: 'TestPass123!', ...TEST_KEYS },
    });

    expect(res.statusCode).toBe(409);
  });
});

describe('E2E Integration — Rate Limiting', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Build app WITH rate limiting enabled
    app = await buildApp({ skipMinio: true });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rate limits login after too many attempts', async () => {
    const results: number[] = [];

    // Send 10 rapid login requests — rate limit is 5/min
    for (let i = 0; i < 10; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login/email',
        payload: { email: 'ratelimit@test.com', password: 'wrong' },
        remoteAddress: '10.99.99.99', // unique IP for this test
      });
      results.push(res.statusCode);
    }

    // Some should be 429 (rate limited)
    expect(results).toContain(429);
  });
});
