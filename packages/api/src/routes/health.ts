import os from 'node:os';
import fs from 'node:fs';
import type { FastifyInstance } from 'fastify';
import type { HealthResponse, SystemMetrics, MetricSample, ResendQuota } from '@bartr/shared';
import { getLatestSample } from '../lib/metrics-collector.js';

const startedAt = Date.now();
const PRICE_STALE_MS = 10 * 60_000; // 10 minutes

const VALID_METRICS = new Set([
  'ram', 'disk', 'disk_read', 'disk_write', 'net_rx', 'net_tx',
]);

function isValidMetric(m: string): boolean {
  if (VALID_METRICS.has(m)) return true;
  // cpu:N where N is a non-negative integer
  return /^cpu:\d+$/.test(m);
}

export default async function healthRoutes(fastify: FastifyInstance) {
  // ── GET /health — existing rich health check ────────────────────────────
  fastify.get('/health', async (_request, reply) => {
    const now = new Date();

    const [dbResult, redisResult, minioResult] = await Promise.all([
      pingService(() => fastify.pg.query('SELECT 1')),
      pingService(() => fastify.redis.ping()),
      pingService(() =>
        fastify.minio
          ? fastify.minio.bucketExists(fastify.minioBucket)
          : Promise.reject(new Error('not registered')),
      ),
    ]);

    let lastUpdate: string | null = null;
    let stale = true;
    try {
      const ts = await fastify.redis.get('prices:last_update');
      if (ts) {
        lastUpdate = ts;
        stale = now.getTime() - new Date(ts).getTime() > PRICE_STALE_MS;
      }
    } catch { /* ignore */ }

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

  // ── GET /health/system — live snapshot ──────────────────────────────────
  fastify.get('/health/system', async (_request, reply) => {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    let diskUsed = 0;
    let diskTotal = 0;
    try {
      const stat = fs.statfsSync('/');
      diskTotal = stat.blocks * stat.bsize;
      diskUsed = (stat.blocks - stat.bfree) * stat.bsize;
    } catch { /* ignore */ }

    // Read latest values from in-memory buffer (updated every 5s)
    const diskReadRate = getLatestSample('disk_read');
    const diskWriteRate = getLatestSample('disk_write');
    const netRxRate = getLatestSample('net_rx');
    const netTxRate = getLatestSample('net_tx');

    const cpuPerCore: number[] = [];
    for (let i = 0; i < cpus.length; i++) {
      cpuPerCore.push(getLatestSample(`cpu:${i}`));
    }

    const response: SystemMetrics = {
      cpu_cores: cpus.length,
      cpu_percent_per_core: cpuPerCore,
      ram_used_bytes: usedMem,
      ram_total_bytes: totalMem,
      ram_percent: Math.round((usedMem / totalMem) * 10000) / 100,
      disk_used_bytes: diskUsed,
      disk_total_bytes: diskTotal,
      disk_percent: diskTotal > 0 ? Math.round((diskUsed / diskTotal) * 10000) / 100 : 0,
      disk_read_bytes_sec: diskReadRate,
      disk_write_bytes_sec: diskWriteRate,
      net_rx_bytes_sec: netRxRate,
      net_tx_bytes_sec: netTxRate,
      load_avg: os.loadavg() as [number, number, number],
      uptime_seconds: Math.floor((Date.now() - startedAt) / 1000),
    };

    return reply.send(response);
  });

  // ── GET /health/history — time-series from Redis ZSETs ──────────────────
  fastify.get('/health/history', async (request, reply) => {
    const { metric, hours } = request.query as { metric?: string; hours?: string };

    if (!metric || !isValidMetric(metric)) {
      return reply.status(400).send({ error: 'Invalid metric. Use cpu:N, ram, disk, disk_read, disk_write, net_rx, net_tx' });
    }

    const h = Math.min(Math.max(parseFloat(hours || '6'), 0.1), 336); // max 14 days
    const since = Date.now() - h * 60 * 60 * 1000;
    const key = `metrics:${metric}`;

    const raw = await fastify.redis.zrangebyscore(key, since.toString(), '+inf');

    const samples: MetricSample[] = raw.map((entry) => {
      const [ts, val] = entry.split('|');
      return { timestamp: parseInt(ts, 10), value: parseFloat(val) };
    });

    // Downsample if too many points (keep max ~500 for chart rendering)
    const maxPoints = 500;
    const result = samples.length > maxPoints ? downsample(samples, maxPoints) : samples;

    return reply.send(result);
  });

  // ── GET /health/resend — Resend email quota ─────────────────────────────
  fastify.get('/health/resend', async (_request, reply) => {
    const limit = 3000;
    let sent = 0;

    try {
      const val = await fastify.redis.get('resend:monthly_count');
      if (val) sent = parseInt(val, 10);
    } catch { /* ignore */ }

    // Resets on the 1st of next month, UTC
    const now = new Date();
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    const response: ResendQuota = {
      sent,
      limit,
      resets_at: nextMonth.toISOString(),
    };

    return reply.send(response);
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

function downsample(samples: MetricSample[], maxPoints: number): MetricSample[] {
  const step = Math.ceil(samples.length / maxPoints);
  const result: MetricSample[] = [];
  for (let i = 0; i < samples.length; i += step) {
    const chunk = samples.slice(i, i + step);
    const avg = chunk.reduce((sum, s) => sum + s.value, 0) / chunk.length;
    result.push({ timestamp: chunk[0].timestamp, value: Math.round(avg * 100) / 100 });
  }
  return result;
}
