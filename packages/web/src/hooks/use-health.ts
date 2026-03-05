import { useQuery } from '@tanstack/react-query';
import { admin as adminApi } from '@/lib/api';

export const healthKeys = {
  status: ['health'] as const,
  system: ['health', 'system'] as const,
  history: (metric: string, hours: number) => ['health', 'history', metric, hours] as const,
  apiPerformance: ['health', 'api-performance'] as const,
  infra: ['health', 'infra'] as const,
  growth: (days: number) => ['health', 'growth', days] as const,
};

export function useHealthStatus() {
  return useQuery({
    queryKey: healthKeys.status,
    queryFn: () => adminApi.getHealth(),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}

export function useSystemMetrics() {
  return useQuery({
    queryKey: healthKeys.system,
    queryFn: () => adminApi.getSystemMetrics(),
    refetchInterval: 5_000,
    staleTime: 3_000,
  });
}

export function useMetricHistory(metric: string, hours: number) {
  return useQuery({
    queryKey: healthKeys.history(metric, hours),
    queryFn: () => adminApi.getMetricHistory(metric, hours),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

export function useApiPerformance() {
  return useQuery({
    queryKey: healthKeys.apiPerformance,
    queryFn: () => adminApi.getApiPerformance(),
    refetchInterval: 5_000,
    staleTime: 3_000,
  });
}

export function useInfraMetrics() {
  return useQuery({
    queryKey: healthKeys.infra,
    queryFn: () => adminApi.getInfraMetrics(),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

export function useGrowthData(days: number) {
  return useQuery({
    queryKey: healthKeys.growth(days),
    queryFn: () => adminApi.getGrowthData(days),
    refetchInterval: 5 * 60_000,
    staleTime: 2 * 60_000,
  });
}
