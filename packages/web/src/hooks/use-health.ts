import { useQuery } from '@tanstack/react-query';
import { health as healthApi } from '@/lib/api';

export const healthKeys = {
  status: ['health'] as const,
  system: ['health', 'system'] as const,
  history: (metric: string, hours: number) => ['health', 'history', metric, hours] as const,
  resend: ['health', 'resend'] as const,
};

export function useHealthStatus() {
  return useQuery({
    queryKey: healthKeys.status,
    queryFn: () => healthApi.getHealth(),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}

export function useSystemMetrics() {
  return useQuery({
    queryKey: healthKeys.system,
    queryFn: () => healthApi.getSystemMetrics(),
    refetchInterval: 5_000,
    staleTime: 3_000,
  });
}

export function useMetricHistory(metric: string, hours: number) {
  return useQuery({
    queryKey: healthKeys.history(metric, hours),
    queryFn: () => healthApi.getMetricHistory(metric, hours),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

export function useResendQuota() {
  return useQuery({
    queryKey: healthKeys.resend,
    queryFn: () => healthApi.getResendQuota(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
