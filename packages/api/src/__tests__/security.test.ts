import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Security & rate limiting', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Build with rate limiting enabled, low limit for testing
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rate limits after exceeding max requests', async () => {
    // The default is 100 req/min. Fire 101 requests quickly.
    const results = [];
    for (let i = 0; i < 105; i++) {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
      });
      results.push(res.statusCode);
    }

    // At least one should be 429
    expect(results).toContain(429);
  });

  it('returns rate limit headers', async () => {
    const limitedApp = await buildApp();
    await limitedApp.ready();

    const res = await limitedApp.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.headers['x-ratelimit-limit']).toBeDefined();
    expect(res.headers['x-ratelimit-remaining']).toBeDefined();

    await limitedApp.close();
  });
});
