import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { signAccessToken } from '../lib/jwt.js';
import type { FastifyInstance } from 'fastify';
import type { HealthResponse, SystemMetrics, MetricSample, ApiPerformanceMetrics, InfraMetrics, GrowthData } from '@bartr/shared';

async function createAdminAndToken(app: FastifyInstance, suffix: string): Promise<string> {
  const result = await app.pg.query(
    `INSERT INTO users (google_id, nickname, email_encrypted, password_hash, bio, role, email_verified)
     VALUES ($1, $2, $3, $4, $5, 'admin', TRUE)
     RETURNING id, nickname`,
    [`google_health_${suffix}`, `health_${suffix}`, null, 'hash', ''],
  );
  const user = result.rows[0];
  await app.pg.query('INSERT INTO reputation_scores (user_id) VALUES ($1)', [user.id]);
  return signAccessToken({ sub: user.id, nickname: user.nickname, role: 'admin' });
}

describe('GET /health/ping', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ skipRateLimit: true });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns ok without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/ping' });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
  });
});

describe('GET /health', () => {
  let app: FastifyInstance;
  let adminToken: string;

  beforeAll(async () => {
    app = await buildApp({ skipRateLimit: true });
    await app.ready();
    adminToken = await createAdminAndToken(app, 'main');
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated requests', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(401);
  });

  it('returns ok with service details when db and redis are connected', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);

    const body: HealthResponse = res.json();
    expect(body.status).toMatch(/^(ok|degraded)$/);
    expect(typeof body.version).toBe('string');
    expect(body.version.length).toBeGreaterThan(0);
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

describe('GET /health/system', () => {
  let app: FastifyInstance;
  let adminToken: string;

  beforeAll(async () => {
    app = await buildApp({ skipRateLimit: true });
    await app.ready();
    adminToken = await createAdminAndToken(app, 'system');
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated requests', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/system' });
    expect(res.statusCode).toBe(401);
  });

  it('returns system metrics snapshot', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health/system',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);

    const body: SystemMetrics = res.json();
    expect(body.cpu_cores).toBeGreaterThan(0);
    expect(Array.isArray(body.cpu_percent_per_core)).toBe(true);
    expect(body.cpu_percent_per_core.length).toBe(body.cpu_cores);
    expect(body.ram_total_bytes).toBeGreaterThan(0);
    expect(body.ram_used_bytes).toBeGreaterThanOrEqual(0);
    expect(body.ram_percent).toBeGreaterThanOrEqual(0);
    expect(body.ram_percent).toBeLessThanOrEqual(100);
    expect(body.disk_total_bytes).toBeGreaterThanOrEqual(0);
    expect(body.disk_used_bytes).toBeGreaterThanOrEqual(0);
    expect(body.disk_percent).toBeGreaterThanOrEqual(0);
    expect(typeof body.disk_read_bytes_sec).toBe('number');
    expect(typeof body.disk_write_bytes_sec).toBe('number');
    expect(typeof body.net_rx_bytes_sec).toBe('number');
    expect(typeof body.net_tx_bytes_sec).toBe('number');
    expect(Array.isArray(body.load_avg)).toBe(true);
    expect(body.load_avg.length).toBe(3);
    expect(body.uptime_seconds).toBeGreaterThanOrEqual(0);
  });
});

describe('GET /health/history', () => {
  let app: FastifyInstance;
  let adminToken: string;

  beforeAll(async () => {
    app = await buildApp({ skipRateLimit: true });
    await app.ready();
    adminToken = await createAdminAndToken(app, 'history');
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated requests', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/history?metric=ram&hours=1' });
    expect(res.statusCode).toBe(401);
  });

  it('returns an array of metric samples for valid metric', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health/history?metric=ram&hours=1',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);

    const body: MetricSample[] = res.json();
    expect(Array.isArray(body)).toBe(true);
    // May be empty if no data collected yet — that's fine
    for (const sample of body) {
      expect(typeof sample.timestamp).toBe('number');
      expect(typeof sample.value).toBe('number');
    }
  });

  it('returns 400 for invalid metric', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health/history?metric=invalid',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when metric is missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health/history',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it('accepts cpu:N metric', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health/history?metric=cpu:0&hours=1',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it.each([
    'resp_time_p50', 'resp_time_p95', 'req_rate', 'error_rate',
    'redis_mem', 'pg_conns',
  ])('accepts new metric %s', async (metric) => {
    const res = await app.inject({
      method: 'GET',
      url: `/health/history?metric=${metric}&hours=1`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });
});

describe('GET /health/api-performance', () => {
  let app: FastifyInstance;
  let adminToken: string;

  beforeAll(async () => {
    app = await buildApp({ skipRateLimit: true });
    await app.ready();
    adminToken = await createAdminAndToken(app, 'apiperf');
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated requests', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/api-performance' });
    expect(res.statusCode).toBe(401);
  });

  it('returns API performance metrics shape', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health/api-performance',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);

    const body: ApiPerformanceMetrics = res.json();
    expect(typeof body.resp_time_p50).toBe('number');
    expect(typeof body.resp_time_p95).toBe('number');
    expect(typeof body.req_rate).toBe('number');
    expect(typeof body.error_rate).toBe('number');
  });
});

describe('GET /health/infra', () => {
  let app: FastifyInstance;
  let adminToken: string;

  beforeAll(async () => {
    app = await buildApp({ skipRateLimit: true });
    await app.ready();
    adminToken = await createAdminAndToken(app, 'infra');
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated requests', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/infra' });
    expect(res.statusCode).toBe(401);
  });

  it('returns infrastructure metrics shape', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health/infra',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);

    const body: InfraMetrics = res.json();
    expect(typeof body.redis_mem_bytes).toBe('number');
    expect(typeof body.pg_connections).toBe('number');
  });
});

describe('GET /health/growth', () => {
  let app: FastifyInstance;
  let adminToken: string;

  beforeAll(async () => {
    app = await buildApp({ skipRateLimit: true });
    await app.ready();
    adminToken = await createAdminAndToken(app, 'growth');
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated requests', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/growth?days=7' });
    expect(res.statusCode).toBe(401);
  });

  it('returns growth data shape', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health/growth?days=7',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);

    const body: GrowthData = res.json();
    expect(Array.isArray(body.users)).toBe(true);
    expect(Array.isArray(body.listings)).toBe(true);
    expect(Array.isArray(body.messages)).toBe(true);

    for (const entry of body.users) {
      expect(typeof entry.date).toBe('string');
      expect(typeof entry.count).toBe('number');
    }
  });

  it('defaults to 30 days when no param given', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health/growth',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body: GrowthData = res.json();
    expect(Array.isArray(body.users)).toBe(true);
  });
});
