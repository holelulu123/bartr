import os from 'node:os';
import fs from 'node:fs';
import type Redis from 'ioredis';

const FAST_INTERVAL_MS = 5_000;       // CPU, RAM, disk I/O, network
const SLOW_INTERVAL_MS = 5 * 60_000;  // disk usage (every 5 min)
const RETENTION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

// ── Previous-tick state for delta calculations ────────────────────────────

let prevCpuTimes: Array<{ idle: number; total: number }> | null = null;
let prevDiskStats: { reads: number; writes: number; ts: number } | null = null;
let prevNetStats: { rx: number; tx: number; ts: number } | null = null;

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

function parseDiskStats(): { reads: number; writes: number } | null {
  try {
    const content = fs.readFileSync('/proc/diskstats', 'utf-8');
    let totalReads = 0;
    let totalWrites = 0;
    for (const line of content.trim().split('\n')) {
      const parts = line.trim().split(/\s+/);
      // fields: major minor name rd_ios rd_merges rd_sectors rd_ticks wr_ios wr_merges wr_sectors ...
      const name = parts[2];
      // Only count whole-disk devices (sda, vda, nvme0n1) not partitions
      if (!name || /\d+$/.test(name)) continue;
      if (!/^(sd|vd|nvme|xvd)/.test(name)) continue;
      totalReads += parseInt(parts[5], 10) * 512; // rd_sectors * 512
      totalWrites += parseInt(parts[9], 10) * 512; // wr_sectors * 512
    }
    return { reads: totalReads, writes: totalWrites };
  } catch {
    return null;
  }
}

function parseNetDev(): { rx: number; tx: number } | null {
  try {
    const content = fs.readFileSync('/proc/net/dev', 'utf-8');
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

// ── Fast metrics (every 5s): CPU, RAM, disk I/O, network ──────────────────

async function collectFast(redis: Redis) {
  const now = Date.now();
  const cutoff = now - RETENTION_MS;
  const pipeline = redis.pipeline();

  // CPU per core
  const cpuPerCore = getCpuUsagePerCore();
  for (let i = 0; i < cpuPerCore.length; i++) {
    const key = `metrics:cpu:${i}`;
    pipeline.zadd(key, now.toString(), `${now}|${cpuPerCore[i]}`);
    pipeline.zremrangebyscore(key, '-inf', cutoff.toString());
  }

  // RAM
  const ram = getRamPercent();
  pipeline.zadd('metrics:ram', now.toString(), `${now}|${ram}`);
  pipeline.zremrangebyscore('metrics:ram', '-inf', cutoff.toString());

  // Disk I/O
  const diskStats = parseDiskStats();
  if (diskStats && prevDiskStats) {
    const dt = (now - prevDiskStats.ts) / 1000;
    if (dt > 0) {
      const readSpeed = Math.max(0, Math.round((diskStats.reads - prevDiskStats.reads) / dt));
      const writeSpeed = Math.max(0, Math.round((diskStats.writes - prevDiskStats.writes) / dt));
      pipeline.zadd('metrics:disk_read', now.toString(), `${now}|${readSpeed}`);
      pipeline.zremrangebyscore('metrics:disk_read', '-inf', cutoff.toString());
      pipeline.zadd('metrics:disk_write', now.toString(), `${now}|${writeSpeed}`);
      pipeline.zremrangebyscore('metrics:disk_write', '-inf', cutoff.toString());
    }
  }
  if (diskStats) {
    prevDiskStats = { reads: diskStats.reads, writes: diskStats.writes, ts: now };
  }

  // Network
  const netStats = parseNetDev();
  if (netStats && prevNetStats) {
    const dt = (now - prevNetStats.ts) / 1000;
    if (dt > 0) {
      const rxRate = Math.max(0, Math.round((netStats.rx - prevNetStats.rx) / dt));
      const txRate = Math.max(0, Math.round((netStats.tx - prevNetStats.tx) / dt));
      pipeline.zadd('metrics:net_rx', now.toString(), `${now}|${rxRate}`);
      pipeline.zremrangebyscore('metrics:net_rx', '-inf', cutoff.toString());
      pipeline.zadd('metrics:net_tx', now.toString(), `${now}|${txRate}`);
      pipeline.zremrangebyscore('metrics:net_tx', '-inf', cutoff.toString());
    }
  }
  if (netStats) {
    prevNetStats = { rx: netStats.rx, tx: netStats.tx, ts: now };
  }

  await pipeline.exec();
}

// ── Slow metrics (every 5 min): disk usage ────────────────────────────────

async function collectSlow(redis: Redis) {
  const now = Date.now();
  const cutoff = now - RETENTION_MS;
  const pipeline = redis.pipeline();

  const diskUsed = getDiskUsageBytes();
  pipeline.zadd('metrics:disk', now.toString(), `${now}|${diskUsed}`);
  pipeline.zremrangebyscore('metrics:disk', '-inf', cutoff.toString());

  await pipeline.exec();
}

// ── Public API ────────────────────────────────────────────────────────────

let fastTimer: ReturnType<typeof setInterval> | null = null;
let slowTimer: ReturnType<typeof setInterval> | null = null;

export function startMetricsCollector(redis: Redis) {
  // Seed deltas on first tick
  collectFast(redis).catch(() => {});
  collectSlow(redis).catch(() => {});

  fastTimer = setInterval(() => {
    collectFast(redis).catch(() => {});
  }, FAST_INTERVAL_MS);

  slowTimer = setInterval(() => {
    collectSlow(redis).catch(() => {});
  }, SLOW_INTERVAL_MS);

  if (fastTimer.unref) fastTimer.unref();
  if (slowTimer.unref) slowTimer.unref();
}

export function stopMetricsCollector() {
  if (fastTimer) {
    clearInterval(fastTimer);
    fastTimer = null;
  }
  if (slowTimer) {
    clearInterval(slowTimer);
    slowTimer = null;
  }
}
