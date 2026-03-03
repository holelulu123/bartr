import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';
import type { HealthResponse, SystemMetrics, MetricSample, ResendQuota, ApiPerformanceMetrics, InfraMetrics, GrowthData } from '@bartr/shared';

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

describe('GET /health/system', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ skipRateLimit: true });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns system metrics snapshot', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/system' });

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

  beforeAll(async () => {
    app = await buildApp({ skipRateLimit: true });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns an array of metric samples for valid metric', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/history?metric=ram&hours=1' });

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
    const res = await app.inject({ method: 'GET', url: '/health/history?metric=invalid' });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when metric is missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/history' });
    expect(res.statusCode).toBe(400);
  });

  it('accepts cpu:N metric', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/history?metric=cpu:0&hours=1' });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it.each([
    'resp_time_p50', 'resp_time_p95', 'req_rate', 'error_rate',
    'redis_mem', 'pg_conns',
  ])('accepts new metric %s', async (metric) => {
    const res = await app.inject({ method: 'GET', url: `/health/history?metric=${metric}&hours=1` });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });
});

describe('GET /health/resend', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ skipRateLimit: true });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns resend quota shape', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/resend' });

    expect(res.statusCode).toBe(200);

    const body: ResendQuota = res.json();
    expect(typeof body.sent).toBe('number');
    expect(body.limit).toBe(3000);
    expect(body.resets_at).toBeTruthy();
    // resets_at should be a valid ISO date
    expect(new Date(body.resets_at).getTime()).toBeGreaterThan(0);
  });
});

describe('GET /health/api-performance', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ skipRateLimit: true });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns API performance metrics shape', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/api-performance' });

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

  beforeAll(async () => {
    app = await buildApp({ skipRateLimit: true });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns infrastructure metrics shape', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/infra' });

    expect(res.statusCode).toBe(200);

    const body: InfraMetrics = res.json();
    expect(typeof body.redis_mem_bytes).toBe('number');
    expect(typeof body.pg_connections).toBe('number');
  });
});

describe('GET /health/growth', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ skipRateLimit: true });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns growth data shape', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/growth?days=7' });

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
    const res = await app.inject({ method: 'GET', url: '/health/growth' });
    expect(res.statusCode).toBe(200);
    const body: GrowthData = res.json();
    expect(Array.isArray(body.users)).toBe(true);
  });
});
