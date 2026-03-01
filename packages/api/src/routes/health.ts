import type { FastifyInstance } from 'fastify';
import type { HealthResponse } from '@bartr/shared';

const startedAt = Date.now();
const PRICE_STALE_MS = 10 * 60_000; // 10 minutes

export default async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (_request, reply) => {
    const now = new Date();

    // ── Service checks (parallel) ──────────────────────────────────────────
    const [dbResult, redisResult, minioResult] = await Promise.all([
      pingService(() => fastify.pg.query('SELECT 1')),
      pingService(() => fastify.redis.ping()),
      pingService(() =>
        fastify.minio
          ? fastify.minio.bucketExists(fastify.minioBucket)
          : Promise.reject(new Error('not registered')),
      ),
    ]);

    // ── Price feed freshness ───────────────────────────────────────────────
    let lastUpdate: string | null = null;
    let stale = true;
    try {
      const ts = await fastify.redis.get('prices:last_update');
      if (ts) {
        lastUpdate = ts;
        stale = now.getTime() - new Date(ts).getTime() > PRICE_STALE_MS;
      }
    } catch { /* ignore */ }

    // ── Stats ──────────────────────────────────────────────────────────────
    let users = 0;
    let activeOffers = 0;
    let tradesToday = 0;
    try {
      const [uRes, oRes, tRes] = await Promise.all([
        fastify.pg.query('SELECT COUNT(*)::int AS c FROM users'),
        fastify.pg.query("SELECT COUNT(*)::int AS c FROM exchange_offers WHERE status = 'active'"),
        fastify.pg.query("SELECT COUNT(*)::int AS c FROM trades WHERE created_at >= CURRENT_DATE"),
      ]);
      users = uRes.rows[0].c;
      activeOffers = oRes.rows[0].c;
      tradesToday = tRes.rows[0].c;
    } catch { /* ignore */ }

    // ── Response ───────────────────────────────────────────────────────────
    const allOk = dbResult.ok && redisResult.ok;
    const minioOk = minioResult.ok;

    const response: HealthResponse = {
      status: allOk ? (minioOk ? 'ok' : 'degraded') : 'error',
      version: '0.0.1',
      uptime_seconds: Math.floor((Date.now() - startedAt) / 1000),
      timestamp: now.toISOString(),
      services: {
        db: dbResult,
        redis: redisResult,
        minio: minioResult,
      },
      price_feed: { last_update: lastUpdate, stale },
      stats: { users, active_offers: activeOffers, trades_today: tradesToday },
    };

    const statusCode = response.status === 'ok' ? 200 : response.status === 'degraded' ? 200 : 503;
    return reply.status(statusCode).send(response);
  });
}

async function pingService(fn: () => Promise<unknown>): Promise<{ ok: boolean; latency_ms: number }> {
  const start = performance.now();
  try {
    await fn();
    return { ok: true, latency_ms: Math.round(performance.now() - start) };
  } catch {
    return { ok: false, latency_ms: Math.round(performance.now() - start) };
  }
}
