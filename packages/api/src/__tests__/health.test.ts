import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';
import type { HealthResponse } from '@bartr/shared';

describe('GET /health', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ skipRateLimit: true });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns ok with service details when db and redis are connected', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);

    const body: HealthResponse = res.json();
    expect(body.status).toMatch(/^(ok|degraded)$/);
    expect(body.version).toBe('0.0.1');
    expect(body.uptime_seconds).toBeGreaterThanOrEqual(0);
    expect(body.timestamp).toBeTruthy();

    // Services
    expect(body.services.db.ok).toBe(true);
    expect(body.services.db.latency_ms).toBeGreaterThanOrEqual(0);
    expect(body.services.redis.ok).toBe(true);
    expect(body.services.redis.latency_ms).toBeGreaterThanOrEqual(0);
    // MinIO may not be connected in test env (skipMinio is not set but may still work)
    expect(typeof body.services.minio.ok).toBe('boolean');

    // Price feed
    expect(typeof body.price_feed.stale).toBe('boolean');

    // Stats
    expect(body.stats.users).toBeGreaterThanOrEqual(0);
    expect(body.stats.active_offers).toBeGreaterThanOrEqual(0);
    expect(body.stats.trades_today).toBeGreaterThanOrEqual(0);
  });
});
