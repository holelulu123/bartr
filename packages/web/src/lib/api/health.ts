import { get } from './client';
import type { HealthResponse, SystemMetrics, MetricSample, ResendQuota } from '@bartr/shared';

export function getHealth() {
  return get<HealthResponse>('/health');
}

export function getSystemMetrics() {
  return get<SystemMetrics>('/health/system');
}

export function getMetricHistory(metric: string, hours: number) {
  return get<MetricSample[]>(`/health/history?metric=${encodeURIComponent(metric)}&hours=${hours}`);
}

export function getResendQuota() {
  return get<ResendQuota>('/health/resend');
}
