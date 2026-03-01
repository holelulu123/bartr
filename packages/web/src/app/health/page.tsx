'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useHealthStatus, useSystemMetrics, useMetricHistory, useResendQuota, healthKeys } from '@/hooks/use-health';
import { health as healthApi } from '@/lib/api';
import { ServiceCard } from '@/components/health/service-card';
import { StatCard } from '@/components/health/stat-card';
import { QuotaBar } from '@/components/health/quota-bar';
import { MetricChart, MultiLineChart } from '@/components/health/metric-chart';
import type { MetricSample } from '@bartr/shared';

const TIME_RANGES = [
  { label: '1h', hours: 1 },
  { label: '6h', hours: 6 },
  { label: '24h', hours: 24 },
  { label: '7d', hours: 168 },
  { label: '14d', hours: 336 },
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

// Separate component so core count is stable across renders (no variable hook count)
function CpuChart({ cores, hours }: { cores: number; hours: number }) {
  const { data } = useQuery({
    queryKey: healthKeys.history('cpu:all', hours),
    queryFn: async () => {
      const results = await Promise.all(
        Array.from({ length: cores }, (_, i) => healthApi.getMetricHistory(`cpu:${i}`, hours)),
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

export default function HealthPage() {
  const [hours, setHours] = useState(6);
  const { data: health, isLoading: healthLoading } = useHealthStatus();
  const { data: system } = useSystemMetrics();
  const { data: resend } = useResendQuota();

  const { data: ramHistory } = useMetricHistory('ram', hours);
  const { data: diskHistory } = useMetricHistory('disk', hours);
  const { data: diskReadHistory } = useMetricHistory('disk_read', hours);
  const { data: diskWriteHistory } = useMetricHistory('disk_write', hours);
  const { data: netRxHistory } = useMetricHistory('net_rx', hours);
  const { data: netTxHistory } = useMetricHistory('net_tx', hours);

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
    <div className="px-4 py-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-2xl font-bold tracking-tight">System Health</h1>
        <span className={`inline-block h-3 w-3 rounded-full ${statusColor}`} />
        <span className="text-sm text-neutral-400 capitalize">{health?.status ?? 'unknown'}</span>
        <span className="ml-auto text-xs text-neutral-500">
          v{health?.version} &middot; uptime {formatUptime(health?.uptime_seconds ?? 0)}
        </span>
      </div>

      {/* Services */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-neutral-400 mb-3 uppercase tracking-wider">Services</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ServiceCard name="Database" ok={health?.services.db.ok ?? false} latency_ms={health?.services.db.latency_ms ?? 0} />
          <ServiceCard name="Redis" ok={health?.services.redis.ok ?? false} latency_ms={health?.services.redis.latency_ms ?? 0} />
          <ServiceCard name="MinIO" ok={health?.services.minio.ok ?? false} latency_ms={health?.services.minio.latency_ms ?? 0} />
          <ServiceCard
            name="Price Feed"
            ok={!health?.price_feed.stale}
            latency_ms={0}
          />
        </div>
      </section>

      {/* Stats */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-neutral-400 mb-3 uppercase tracking-wider">Stats</h2>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Total Users" value={health?.stats.users ?? 0} />
          <StatCard label="Active Offers" value={health?.stats.active_offers ?? 0} />
          <StatCard label="Trades Today" value={health?.stats.trades_today ?? 0} />
        </div>
      </section>

      {/* Live System */}
      {system && (
        <section className="mb-8">
          <h2 className="text-sm font-medium text-neutral-400 mb-3 uppercase tracking-wider">Live System</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
        </section>
      )}

      {/* Time Range */}
      <div className="flex gap-2 mb-6">
        {TIME_RANGES.map((r) => (
          <button
            key={r.label}
            onClick={() => setHours(r.hours)}
            className={`px-3 py-1 text-xs rounded-md border transition-colors ${
              hours === r.hours
                ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                : 'border-neutral-700 text-neutral-400 hover:border-neutral-600'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Charts */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {/* Per-CPU — rendered in a child component to keep hook count stable */}
        <CpuChart cores={system?.cpu_cores ?? 0} hours={hours} />

        {/* RAM */}
        <MetricChart
          title="RAM Usage"
          data={ramHistory ?? []}
          unit="percent"
          color="#3b82f6"
        />

        {/* Disk */}
        <MetricChart
          title="Disk Usage"
          data={diskHistory ?? []}
          unit="bytes"
          color="#10b981"
        />

        {/* Disk I/O */}
        <MultiLineChart
          title="Disk I/O Speed"
          series={[
            { name: 'Read', data: diskReadHistory ?? [], color: '#06b6d4' },
            { name: 'Write', data: diskWriteHistory ?? [], color: '#f59e0b' },
          ]}
          unit="bytes_per_sec"
        />

        {/* Bandwidth */}
        <MultiLineChart
          title="Network Bandwidth"
          series={[
            { name: 'RX', data: netRxHistory ?? [], color: '#8b5cf6' },
            { name: 'TX', data: netTxHistory ?? [], color: '#ec4899' },
          ]}
          unit="bytes_per_sec"
        />
      </section>

      {/* Resend Quota */}
      {resend && (
        <section className="mb-8">
          <QuotaBar sent={resend.sent} limit={resend.limit} resets_at={resend.resets_at} />
        </section>
      )}
    </div>
  );
}
