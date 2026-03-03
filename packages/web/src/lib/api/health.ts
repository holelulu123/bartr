import type { HealthResponse, SystemMetrics, MetricSample, ResendQuota, ApiPerformanceMetrics, InfraMetrics, GrowthData } from '@bartr/shared';

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch('/hproxy/health', { cache: 'no-store' });
  return res.json();
}

export async function getSystemMetrics(): Promise<SystemMetrics> {
  const res = await fetch('/hproxy/health/system', { cache: 'no-store' });
  return res.json();
}

export async function getMetricHistory(metric: string, hours: number): Promise<MetricSample[]> {
  const res = await fetch(`/hproxy/health/history?metric=${encodeURIComponent(metric)}&hours=${hours}`, { cache: 'no-store' });
  return res.json();
}

export async function getResendQuota(): Promise<ResendQuota> {
  const res = await fetch('/hproxy/health/resend', { cache: 'no-store' });
  return res.json();
}

export async function getApiPerformance(): Promise<ApiPerformanceMetrics> {
  const res = await fetch('/hproxy/health/api-performance', { cache: 'no-store' });
  return res.json();
}

export async function getInfraMetrics(): Promise<InfraMetrics> {
  const res = await fetch('/hproxy/health/infra', { cache: 'no-store' });
  return res.json();
}

export async function getGrowthData(days: number): Promise<GrowthData> {
  const res = await fetch(`/hproxy/health/growth?days=${days}`, { cache: 'no-store' });
  return res.json();
}
