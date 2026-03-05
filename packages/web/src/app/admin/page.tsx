'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useHealthStatus, useSystemMetrics, useMetricHistory, useResendQuota, useApiPerformance, useInfraMetrics, useGrowthData, healthKeys } from '@/hooks/use-health';
import { admin as adminApi } from '@/lib/api';
import { ServiceCard } from '@/components/health/service-card';
import { StatCard } from '@/components/health/stat-card';
import { QuotaBar } from '@/components/health/quota-bar';
import { MetricChart, MultiLineChart } from '@/components/health/metric-chart';
import { DailyBarChart } from '@/components/health/daily-bar-chart';
import type { MetricSample } from '@bartr/shared';

const TIME_RANGES = [
  { label: '1h', hours: 1 },
  { label: '6h', hours: 6 },
  { label: '24h', hours: 24 },
  { label: '7d', hours: 168 },
  { label: '14d', hours: 336 },
] as const;

const GROWTH_RANGES = [
  { label: '7d', days: 7 },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const;

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatBytesPerSec(bytes: number): string {
  return `${formatBytes(bytes)}/s`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hrs = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hrs}h`;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

const CPU_COLORS = [
  '#f97316', '#3b82f6', '#10b981', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
  '#ef4444', '#14b8a6', '#a855f7', '#f43f5e',
  '#22d3ee', '#eab308', '#6366f1', '#d946ef',
];

function CpuChart({ cores, hours }: { cores: number; hours: number }) {
  const { data } = useQuery({
    queryKey: healthKeys.history('cpu:all', hours),
    queryFn: async () => {
      const results = await Promise.all(
        Array.from({ length: cores }, (_, i) => adminApi.getMetricHistory(`cpu:${i}`, hours)),
      );
      return results;
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
    enabled: cores > 0,
  });

  const series = Array.from({ length: cores }, (_, i) => ({
    name: `Core ${i}`,
    data: (data?.[i] ?? []) as MetricSample[],
    color: CPU_COLORS[i % CPU_COLORS.length],
  }));

  return <MultiLineChart title="CPU Usage (per core)" series={series} unit="percent" />;
}

function HealthLoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [privateKey, setPrivateKey] = useState('');
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldown > 0 || submitting) return;

    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/hproxy/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ privateKey }),
      });

      if (res.ok) {
        onSuccess();
        return;
      }

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '30', 10);
        setCooldown(retryAfter);
        setError('Too many attempts');
        return;
      }

      setError('Invalid key');
    } catch {
      setError('Connection error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-lg space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-6">
        <h1 className="text-xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-sm text-neutral-400">Paste your private key to unlock.</p>

        <div>
          <label htmlFor="health-key" className="mb-1 block text-sm text-neutral-400">Private Key</label>
          <textarea
            id="health-key"
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            rows={8}
            spellCheck={false}
            className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 font-mono text-xs focus:border-orange-500 focus:outline-none resize-none"
            placeholder={"-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----"}
            required
          />
        </div>

        {error && (
          <p className="text-sm text-red-400">
            {error}
            {cooldown > 0 && ` — retry in ${cooldown}s`}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || cooldown > 0}
          className="w-full rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {cooldown > 0 ? `Wait ${cooldown}s` : submitting ? 'Verifying...' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {subtitle && <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function TimeRangeSelector({ value, onChange, ranges }: {
  value: number;
  onChange: (v: number) => void;
  ranges: ReadonlyArray<{ label: string; hours?: number; days?: number }>;
}) {
  return (
    <div className="flex gap-2 mb-4">
      {ranges.map((r) => {
        const val = r.hours ?? r.days ?? 0;
        return (
          <button
            key={r.label}
            onClick={() => onChange(val)}
            className={`px-3 py-1 text-xs rounded-md border transition-colors ${
              value === val
                ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                : 'border-neutral-700 text-neutral-400 hover:border-neutral-600'
            }`}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

function HealthDashboard() {
  const [hours, setHours] = useState(6);
  const [growthDays, setGrowthDays] = useState(30);
  const { data: health, isLoading: healthLoading } = useHealthStatus();
  const { data: system } = useSystemMetrics();
  const { data: resend } = useResendQuota();
  const { data: apiPerf } = useApiPerformance();
  const { data: infra } = useInfraMetrics();
  const { data: growth } = useGrowthData(growthDays);

  // Machine resource histories
  const { data: ramHistory } = useMetricHistory('ram', hours);
  const { data: diskHistory } = useMetricHistory('disk', hours);
  const { data: diskReadHistory } = useMetricHistory('disk_read', hours);
  const { data: diskWriteHistory } = useMetricHistory('disk_write', hours);
  const { data: netRxHistory } = useMetricHistory('net_rx', hours);
  const { data: netTxHistory } = useMetricHistory('net_tx', hours);

  // API perf histories
  const { data: respP50History } = useMetricHistory('resp_time_p50', hours);
  const { data: respP95History } = useMetricHistory('resp_time_p95', hours);
  const { data: reqRateHistory } = useMetricHistory('req_rate', hours);
  const { data: errorRateHistory } = useMetricHistory('error_rate', hours);

  // Infra histories
  const { data: redisMemHistory } = useMetricHistory('redis_mem', hours);
  const { data: pgConnsHistory } = useMetricHistory('pg_conns', hours);

  const handleLogout = async () => {
    await fetch('/hproxy/admin/logout', { method: 'POST' });
    window.location.reload();
  };

  if (healthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  const statusColor =
    health?.status === 'ok' ? 'bg-green-500' : health?.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="px-4 py-8 max-w-6xl mx-auto space-y-10">
      {/* ── 1. Overview ────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
          <span className={`inline-block h-3 w-3 rounded-full ${statusColor}`} />
          <span className="text-sm text-neutral-400 capitalize">{health?.status ?? 'unknown'}</span>
          <span className="ml-auto text-xs text-neutral-500">
            v{health?.version} &middot; uptime {formatUptime(health?.uptime_seconds ?? 0)}
          </span>
          <button
            onClick={handleLogout}
            className="ml-4 rounded-md border border-neutral-700 px-3 py-1 text-xs text-neutral-400 transition-colors hover:border-red-500 hover:text-red-400"
          >
            Logout
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <ServiceCard name="Database" ok={health?.services.db.ok ?? false} latency_ms={health?.services.db.latency_ms ?? 0} />
          <ServiceCard name="Redis" ok={health?.services.redis.ok ?? false} latency_ms={health?.services.redis.latency_ms ?? 0} />
          <ServiceCard name="MinIO" ok={health?.services.minio.ok ?? false} latency_ms={health?.services.minio.latency_ms ?? 0} />
          <ServiceCard name="Price Feed" ok={!health?.price_feed.stale} latency_ms={0} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Total Users" value={health?.stats.users ?? 0} />
          <StatCard label="Active Offers" value={health?.stats.active_offers ?? 0} />
          <StatCard label="Trades Today" value={health?.stats.trades_today ?? 0} />
        </div>
      </section>

      {/* ── 2. Machine Resources ───────────────────────────────────────────── */}
      <section>
        <SectionHeading title="Machine Resources" subtitle="CPU, RAM, disk, and network utilization" />

        {system && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <StatCard
              label="CPU (avg)"
              value={`${(system.cpu_percent_per_core.reduce((a, b) => a + b, 0) / (system.cpu_cores || 1)).toFixed(1)}%`}
              sub={`${system.cpu_cores} cores`}
            />
            <StatCard
              label="RAM"
              value={`${system.ram_percent}%`}
              sub={`${formatBytes(system.ram_used_bytes)} / ${formatBytes(system.ram_total_bytes)}`}
            />
            <StatCard
              label="Disk"
              value={`${system.disk_percent}%`}
              sub={`${formatBytes(system.disk_used_bytes)} / ${formatBytes(system.disk_total_bytes)}`}
            />
            <StatCard
              label="Disk I/O"
              value={formatBytesPerSec(system.disk_read_bytes_sec + system.disk_write_bytes_sec)}
              sub={`R: ${formatBytesPerSec(system.disk_read_bytes_sec)} W: ${formatBytesPerSec(system.disk_write_bytes_sec)}`}
            />
            <StatCard
              label="Network"
              value={formatBytesPerSec(system.net_rx_bytes_sec + system.net_tx_bytes_sec)}
              sub={`RX: ${formatBytesPerSec(system.net_rx_bytes_sec)} TX: ${formatBytesPerSec(system.net_tx_bytes_sec)}`}
            />
          </div>
        )}

        <TimeRangeSelector value={hours} onChange={setHours} ranges={TIME_RANGES} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CpuChart cores={system?.cpu_cores ?? 0} hours={hours} />
          <MetricChart title="RAM Usage" data={ramHistory ?? []} unit="percent" color="#3b82f6" />
          <MetricChart title="Disk Usage" data={diskHistory ?? []} unit="bytes" color="#10b981" yMax={system?.disk_total_bytes} />
          <MultiLineChart
            title="Disk I/O Speed"
            series={[
              { name: 'Read', data: diskReadHistory ?? [], color: '#06b6d4' },
              { name: 'Write', data: diskWriteHistory ?? [], color: '#f59e0b' },
            ]}
            unit="bytes_per_sec"
          />
          <MultiLineChart
            title="Network Bandwidth"
            series={[
              { name: 'RX', data: netRxHistory ?? [], color: '#8b5cf6' },
              { name: 'TX', data: netTxHistory ?? [], color: '#ec4899' },
            ]}
            unit="bytes_per_sec"
          />
        </div>
      </section>

      {/* ── 3. API Performance ─────────────────────────────────────────────── */}
      <section>
        <SectionHeading title="API Performance" subtitle="Response times, throughput, and error rates" />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatCard label="p50 Response" value={`${apiPerf?.resp_time_p50.toFixed(1) ?? '0'}ms`} />
          <StatCard label="p95 Response" value={`${apiPerf?.resp_time_p95.toFixed(1) ?? '0'}ms`} />
          <StatCard label="Request Rate" value={`${apiPerf?.req_rate.toFixed(1) ?? '0'}/s`} />
          <StatCard label="Errors (5s)" value={apiPerf?.error_rate ?? 0} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MultiLineChart
            title="Response Time"
            series={[
              { name: 'p50', data: respP50History ?? [], color: '#3b82f6' },
              { name: 'p95', data: respP95History ?? [], color: '#f97316' },
            ]}
            unit="ms"
          />
          <MetricChart title="Request Rate" data={reqRateHistory ?? []} unit="count_per_sec" color="#10b981" />
          <MetricChart title="Error Count" data={errorRateHistory ?? []} unit="count" color="#ef4444" />
        </div>
      </section>

      {/* ── 4. Infrastructure ──────────────────────────────────────────────── */}
      <section>
        <SectionHeading title="Infrastructure" subtitle="Redis memory and PostgreSQL connections" />

        <div className="grid grid-cols-2 gap-3 mb-4">
          <StatCard label="Redis Memory" value={formatBytes(infra?.redis_mem_bytes ?? 0)} />
          <StatCard label="PG Connections" value={infra?.pg_connections ?? 0} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricChart title="Redis Memory" data={redisMemHistory ?? []} unit="bytes" color="#ef4444" />
          <MetricChart title="PostgreSQL Connections" data={pgConnsHistory ?? []} unit="count" color="#8b5cf6" />
        </div>
      </section>

      {/* ── 5. Growth ──────────────────────────────────────────────────────── */}
      <section>
        <SectionHeading title="Growth" subtitle="Daily registrations, listings, and messages" />

        <TimeRangeSelector value={growthDays} onChange={setGrowthDays} ranges={GROWTH_RANGES} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DailyBarChart title="User Registrations" data={growth?.users ?? []} color="#3b82f6" />
          <DailyBarChart title="Listings Created" data={growth?.listings ?? []} color="#10b981" />
          <DailyBarChart title="Messages Sent" data={growth?.messages ?? []} color="#f97316" />
        </div>
      </section>

      {/* ── 6. Email ───────────────────────────────────────────────────────── */}
      {resend && (
        <section>
          <SectionHeading title="Email" subtitle="Resend API usage and quota" />
          <QuotaBar sent={resend.sent} limit={resend.limit} resets_at={resend.resets_at} />
        </section>
      )}
    </div>
  );
}

export default function HealthPage() {
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/hproxy/admin', { cache: 'no-store' });
      setIsAuthed(res.status !== 401);
    } catch {
      setIsAuthed(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isAuthed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthed) {
    return <HealthLoginForm onSuccess={() => setIsAuthed(true)} />;
  }

  return <HealthDashboard />;
}
