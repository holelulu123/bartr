import type { HealthResponse, SystemMetrics, MetricSample, ResendQuota } from '@bartr/shared';

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch('/api/health', { cache: 'no-store' });
  return res.json();
}

export async function getSystemMetrics(): Promise<SystemMetrics> {
  const res = await fetch('/api/health/system', { cache: 'no-store' });
  return res.json();
}

export async function getMetricHistory(metric: string, hours: number): Promise<MetricSample[]> {
  const res = await fetch(`/api/health/history?metric=${encodeURIComponent(metric)}&hours=${hours}`, { cache: 'no-store' });
  return res.json();
}

export async function getResendQuota(): Promise<ResendQuota> {
  const res = await fetch('/api/health/resend', { cache: 'no-store' });
  return res.json();
}
