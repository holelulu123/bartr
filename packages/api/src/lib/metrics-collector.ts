import os from 'node:os';
import fs from 'node:fs';
import type Redis from 'ioredis';

const SAMPLE_INTERVAL_MS = 5_000;      // sample every 5s in memory
const FLUSH_INTERVAL_MS = 5 * 60_000;  // flush max to Redis every 5 min
const DISK_INTERVAL_MS = 5 * 60_000;   // disk usage every 5 min
const RETENTION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

// ── Previous-tick state for delta calculations ────────────────────────────

let prevCpuTimes: Array<{ idle: number; total: number }> | null = null;
let prevDiskStats: { reads: number; writes: number; ts: number } | null = null;
let prevNetStats: { rx: number; tx: number; ts: number } | null = null;

// ── In-memory buffers ─────────────────────────────────────────────────────

// Tracks max value per metric in the current 5-min window (for Redis flush)
const maxBuffer = new Map<string, number>();

// Tracks the most recent sampled value per metric (for live /health/system)
const latestBuffer = new Map<string, number>();

function bufferMax(key: string, value: number) {
  latestBuffer.set(key, value);
  const prev = maxBuffer.get(key);
  if (prev === undefined || value > prev) {
    maxBuffer.set(key, value);
  }
}

/** Get the most recent sampled value for a metric (updated every 5s). */
export function getLatestSample(metric: string): number {
  return latestBuffer.get(metric) ?? 0;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function getCpuUsagePerCore(): number[] {
  const cpus = os.cpus();
  const results: number[] = [];

  for (let i = 0; i < cpus.length; i++) {
    const times = cpus[i].times;
    const idle = times.idle;
    const total = times.user + times.nice + times.sys + times.idle + times.irq;

    if (prevCpuTimes && prevCpuTimes[i]) {
      const dIdle = idle - prevCpuTimes[i].idle;
      const dTotal = total - prevCpuTimes[i].total;
      results.push(dTotal > 0 ? Math.round((1 - dIdle / dTotal) * 10000) / 100 : 0);
    } else {
      results.push(0);
    }
  }

  prevCpuTimes = cpus.map((c) => {
    const t = c.times;
    return { idle: t.idle, total: t.user + t.nice + t.sys + t.idle + t.irq };
  });

  return results;
}

function getRamPercent(): number {
  const total = os.totalmem();
  const free = os.freemem();
  return Math.round(((total - free) / total) * 10000) / 100;
}

function getDiskUsageBytes(): number {
  try {
    const stat = fs.statfsSync('/');
    const used = (stat.blocks - stat.bfree) * stat.bsize;
    return used;
  } catch {
    return 0;
  }
}

// Use host /proc if mounted, otherwise fall back to container's /proc
const HOST_PROC = fs.existsSync('/host/proc') ? '/host/proc' : '/proc';

function parseDiskStats(): { reads: number; writes: number } | null {
  try {
    const content = fs.readFileSync(`${HOST_PROC}/diskstats`, 'utf-8');
    let totalReads = 0;
    let totalWrites = 0;
    for (const line of content.trim().split('\n')) {
      const parts = line.trim().split(/\s+/);
      const name = parts[2];
      if (!name || /\d+$/.test(name)) continue;
      if (!/^(sd|vd|nvme|xvd)/.test(name)) continue;
      totalReads += parseInt(parts[5], 10) * 512;
      totalWrites += parseInt(parts[9], 10) * 512;
    }
    return { reads: totalReads, writes: totalWrites };
  } catch {
    return null;
  }
}

function parseNetDev(): { rx: number; tx: number } | null {
  try {
    const content = fs.readFileSync(`${HOST_PROC}/net/dev`, 'utf-8');
    let totalRx = 0;
    let totalTx = 0;
    for (const line of content.trim().split('\n')) {
      const match = line.match(/^\s*(\w+):\s*(.*)/);
      if (!match) continue;
      const iface = match[1];
      if (iface === 'lo') continue;
      const fields = match[2].trim().split(/\s+/);
      totalRx += parseInt(fields[0], 10);
      totalTx += parseInt(fields[8], 10);
    }
    return { rx: totalRx, tx: totalTx };
  } catch {
    return null;
  }
}

// ── Sample (every 5s): collect values into in-memory max buffer ───────────

function sample() {
  // CPU per core
  const cpuPerCore = getCpuUsagePerCore();
  for (let i = 0; i < cpuPerCore.length; i++) {
    bufferMax(`cpu:${i}`, cpuPerCore[i]);
  }

  // RAM
  bufferMax('ram', getRamPercent());

  // Disk I/O
  const diskStats = parseDiskStats();
  if (diskStats && prevDiskStats) {
    const dt = (Date.now() - prevDiskStats.ts) / 1000;
    if (dt > 0) {
      bufferMax('disk_read', Math.max(0, Math.round((diskStats.reads - prevDiskStats.reads) / dt)));
      bufferMax('disk_write', Math.max(0, Math.round((diskStats.writes - prevDiskStats.writes) / dt)));
    }
  }
  if (diskStats) {
    prevDiskStats = { reads: diskStats.reads, writes: diskStats.writes, ts: Date.now() };
  }

  // Network
  const netStats = parseNetDev();
  if (netStats && prevNetStats) {
    const dt = (Date.now() - prevNetStats.ts) / 1000;
    if (dt > 0) {
      bufferMax('net_rx', Math.max(0, Math.round((netStats.rx - prevNetStats.rx) / dt)));
      bufferMax('net_tx', Math.max(0, Math.round((netStats.tx - prevNetStats.tx) / dt)));
    }
  }
  if (netStats) {
    prevNetStats = { rx: netStats.rx, tx: netStats.tx, ts: Date.now() };
  }
}

// ── Flush (every 5 min): write max values to Redis, clear buffer ──────────

async function flush(redis: Redis) {
  if (maxBuffer.size === 0) return;

  const now = Date.now();
  const cutoff = now - RETENTION_MS;
  const pipeline = redis.pipeline();

  for (const [metric, value] of maxBuffer) {
    const key = `metrics:${metric}`;
    pipeline.zadd(key, now.toString(), `${now}|${value}`);
    pipeline.zremrangebyscore(key, '-inf', cutoff.toString());
  }

  maxBuffer.clear();
  await pipeline.exec();
}

// ── Disk usage (every 5 min): written directly, no max aggregation needed ─

async function collectDisk(redis: Redis) {
  const now = Date.now();
  const cutoff = now - RETENTION_MS;
  const pipeline = redis.pipeline();

  const diskUsed = getDiskUsageBytes();
  pipeline.zadd('metrics:disk', now.toString(), `${now}|${diskUsed}`);
  pipeline.zremrangebyscore('metrics:disk', '-inf', cutoff.toString());

  await pipeline.exec();
}

// ── Public API ────────────────────────────────────────────────────────────

let sampleTimer: ReturnType<typeof setInterval> | null = null;
let flushTimer: ReturnType<typeof setInterval> | null = null;
let diskTimer: ReturnType<typeof setInterval> | null = null;

export function startMetricsCollector(redis: Redis) {
  // Initial sample to seed deltas (first real values on second tick)
  sample();

  sampleTimer = setInterval(() => {
    sample();
  }, SAMPLE_INTERVAL_MS);

  // First flush after one window
  flushTimer = setInterval(() => {
    flush(redis).catch(() => {});
  }, FLUSH_INTERVAL_MS);

  // Disk usage on its own schedule
  collectDisk(redis).catch(() => {});
  diskTimer = setInterval(() => {
    collectDisk(redis).catch(() => {});
  }, DISK_INTERVAL_MS);

  if (sampleTimer.unref) sampleTimer.unref();
  if (flushTimer.unref) flushTimer.unref();
  if (diskTimer.unref) diskTimer.unref();
}

export function stopMetricsCollector() {
  if (sampleTimer) { clearInterval(sampleTimer); sampleTimer = null; }
  if (flushTimer) { clearInterval(flushTimer); flushTimer = null; }
  if (diskTimer) { clearInterval(diskTimer); diskTimer = null; }
}
