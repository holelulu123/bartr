import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import type { HealthResponse, SystemMetrics, ResendQuota } from '@bartr/shared';

// ── Mock data ─────────────────────────────────────────────────────────────

const mockHealth: HealthResponse = {
  status: 'ok',
  version: '0.0.1',
  uptime_seconds: 3661,
  timestamp: new Date().toISOString(),
  services: {
    db: { ok: true, latency_ms: 2 },
    redis: { ok: true, latency_ms: 1 },
    minio: { ok: true, latency_ms: 5 },
  },
  price_feed: { last_update: new Date().toISOString(), stale: false },
  stats: { users: 42, active_offers: 7, trades_today: 3 },
};

const mockSystem: SystemMetrics = {
  cpu_cores: 2,
  cpu_percent_per_core: [25.5, 30.2],
  ram_used_bytes: 4_000_000_000,
  ram_total_bytes: 8_000_000_000,
  ram_percent: 50,
  disk_used_bytes: 50_000_000_000,
  disk_total_bytes: 100_000_000_000,
  disk_percent: 50,
  disk_read_bytes_sec: 1024,
  disk_write_bytes_sec: 2048,
  net_rx_bytes_sec: 5000,
  net_tx_bytes_sec: 3000,
  load_avg: [1.5, 1.2, 0.8],
  uptime_seconds: 3661,
};

const mockResend: ResendQuota = {
  sent: 150,
  limit: 3000,
  resets_at: '2026-04-01T00:00:00.000Z',
};

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/health',
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<{ default: unknown }>) => {
    const Component = (props: Record<string, unknown>) => {
      const name = (props as { 'data-testid'?: string })['data-testid'] ?? 'chart';
      return <div data-testid={name} />;
    };
    Component.displayName = 'DynamicComponent';
    try {
      const mod = loader as unknown;
      if (typeof mod === 'function') {
        return Component;
      }
    } catch { /* ignore */ }
    return Component;
  },
}));

vi.mock('recharts', () => ({
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/lib/api', () => ({
  health: {
    getMetricHistory: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/hooks/use-health', () => ({
  healthKeys: {
    status: ['health'],
    system: ['health', 'system'],
    history: (metric: string, hours: number) => ['health', 'history', metric, hours],
    resend: ['health', 'resend'],
  },
  useHealthStatus: () => ({ data: mockHealth, isLoading: false }),
  useSystemMetrics: () => ({ data: mockSystem }),
  useMetricHistory: () => ({ data: [] }),
  useResendQuota: () => ({ data: mockResend }),
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ isAuthenticated: false, isLoading: false }),
}));

// Mock global fetch to simulate authed session (auth check returns 200)
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockResolvedValue({ status: 200, ok: true, json: () => Promise.resolve(mockHealth) });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Health page', () => {
  it('renders the page heading', async () => {
    const { default: HealthPage } = await import('@/app/health/page');
    render(<HealthPage />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /system health/i })).toBeInTheDocument();
    });
  });

  it('renders service cards', async () => {
    const { default: HealthPage } = await import('@/app/health/page');
    render(<HealthPage />);
    await waitFor(() => {
      expect(screen.getByText('Database')).toBeInTheDocument();
    });
    expect(screen.getByText('Redis')).toBeInTheDocument();
    expect(screen.getByText('MinIO')).toBeInTheDocument();
    expect(screen.getByText('Price Feed')).toBeInTheDocument();
  });

  it('renders stat cards with correct values', async () => {
    const { default: HealthPage } = await import('@/app/health/page');
    render(<HealthPage />);
    await waitFor(() => {
      expect(screen.getByText('Total Users')).toBeInTheDocument();
    });
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Active Offers')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('Trades Today')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders live system metrics', async () => {
    const { default: HealthPage } = await import('@/app/health/page');
    render(<HealthPage />);
    await waitFor(() => {
      expect(screen.getByText('CPU (avg)')).toBeInTheDocument();
    });
    expect(screen.getByText('RAM')).toBeInTheDocument();
    expect(screen.getByText('Disk')).toBeInTheDocument();
    expect(screen.getByText('Disk I/O')).toBeInTheDocument();
    expect(screen.getByText('Network')).toBeInTheDocument();
  });

  it('renders time range buttons', async () => {
    const { default: HealthPage } = await import('@/app/health/page');
    render(<HealthPage />);
    await waitFor(() => {
      expect(screen.getByText('1h')).toBeInTheDocument();
    });
    expect(screen.getByText('6h')).toBeInTheDocument();
    expect(screen.getByText('24h')).toBeInTheDocument();
    expect(screen.getByText('7d')).toBeInTheDocument();
    expect(screen.getByText('14d')).toBeInTheDocument();
  });

  it('renders resend quota bar', async () => {
    const { default: HealthPage } = await import('@/app/health/page');
    render(<HealthPage />);
    await waitFor(() => {
      expect(screen.getByText('Resend Email Quota')).toBeInTheDocument();
    });
    expect(screen.getByText(/150/)).toBeInTheDocument();
  });

  it('shows version and uptime in header', async () => {
    const { default: HealthPage } = await import('@/app/health/page');
    render(<HealthPage />);
    await waitFor(() => {
      expect(screen.getByText(/v0\.0\.1/)).toBeInTheDocument();
    });
    expect(screen.getByText(/uptime/i)).toBeInTheDocument();
  });
});

describe('Health page – login gate', () => {
  it('shows login form when not authenticated', async () => {
    fetchMock.mockResolvedValue({ status: 401, ok: false, json: () => Promise.resolve({ error: 'Authentication required' }) });

    vi.resetModules();
    vi.doMock('next/navigation', () => ({
      useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
      usePathname: () => '/health',
      useSearchParams: () => ({ get: () => null }),
    }));
    vi.doMock('next/dynamic', () => ({
      default: () => {
        const C = () => <div />;
        C.displayName = 'Dynamic';
        return C;
      },
    }));
    vi.doMock('recharts', () => ({
      AreaChart: () => <div />,
      Area: () => null,
      XAxis: () => null,
      YAxis: () => null,
      Tooltip: () => null,
      ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      LineChart: () => <div />,
      Line: () => null,
    }));
    vi.doMock('@tanstack/react-query', () => ({
      useQuery: () => ({ data: [], isLoading: false }),
    }));
    vi.doMock('@/lib/api', () => ({
      health: {
        getMetricHistory: vi.fn().mockResolvedValue([]),
      },
    }));
    vi.doMock('@/hooks/use-health', () => ({
      healthKeys: {
        status: ['health'],
        system: ['health', 'system'],
        history: (metric: string, hours: number) => ['health', 'history', metric, hours],
        resend: ['health', 'resend'],
      },
      useHealthStatus: () => ({ data: undefined, isLoading: false }),
      useSystemMetrics: () => ({ data: undefined }),
      useMetricHistory: () => ({ data: [] }),
      useResendQuota: () => ({ data: undefined }),
    }));
    vi.doMock('@/contexts/auth-context', () => ({
      useAuth: () => ({ isAuthenticated: false, isLoading: false }),
    }));

    const { default: HealthPage } = await import('@/app/health/page');
    render(<HealthPage />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /health dashboard/i })).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/private key/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /unlock/i })).toBeInTheDocument();
  });
});

describe('Health page – loading state', () => {
  it('shows spinner when loading', async () => {
    // Stall the auth check so isAuthed stays null (spinner)
    fetchMock.mockReturnValue(new Promise(() => {}));

    vi.resetModules();
    vi.doMock('next/navigation', () => ({
      useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
      usePathname: () => '/health',
      useSearchParams: () => ({ get: () => null }),
    }));
    vi.doMock('next/dynamic', () => ({
      default: () => {
        const C = () => <div />;
        C.displayName = 'Dynamic';
        return C;
      },
    }));
    vi.doMock('recharts', () => ({
      AreaChart: () => <div />,
      Area: () => null,
      XAxis: () => null,
      YAxis: () => null,
      Tooltip: () => null,
      ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      LineChart: () => <div />,
      Line: () => null,
    }));
    vi.doMock('@tanstack/react-query', () => ({
      useQuery: () => ({ data: [], isLoading: false }),
    }));
    vi.doMock('@/lib/api', () => ({
      health: {
        getMetricHistory: vi.fn().mockResolvedValue([]),
      },
    }));
    vi.doMock('@/hooks/use-health', () => ({
      healthKeys: {
        status: ['health'],
        system: ['health', 'system'],
        history: (metric: string, hours: number) => ['health', 'history', metric, hours],
        resend: ['health', 'resend'],
      },
      useHealthStatus: () => ({ data: undefined, isLoading: true }),
      useSystemMetrics: () => ({ data: undefined }),
      useMetricHistory: () => ({ data: [] }),
      useResendQuota: () => ({ data: undefined }),
    }));
    vi.doMock('@/contexts/auth-context', () => ({
      useAuth: () => ({ isAuthenticated: false, isLoading: false }),
    }));

    const { default: HealthPage } = await import('@/app/health/page');
    const { container } = render(<HealthPage />);
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });
});
