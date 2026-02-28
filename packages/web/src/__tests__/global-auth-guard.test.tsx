import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockReplace = vi.fn();
let mockPathname = '/listings';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => mockPathname,
}));

let mockIsAuthenticated = false;
let mockIsLoading = false;

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    isLoading: mockIsLoading,
  }),
}));

// ── Import under test ──────────────────────────────────────────────────────

import { GlobalAuthGuard } from '@/components/global-auth-guard';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockIsAuthenticated = false;
  mockIsLoading = false;
  mockPathname = '/messages';
});

// ── Helper ─────────────────────────────────────────────────────────────────

function renderGuard(path: string) {
  mockPathname = path;
  return render(
    <GlobalAuthGuard>
      <div data-testid="protected-content">Secret page</div>
    </GlobalAuthGuard>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('GlobalAuthGuard — public routes (unauthenticated)', () => {
  const publicPaths = ['/', '/login', '/register', '/donate', '/auth/callback', '/auth/unlock', '/auth/recover'];

  publicPaths.forEach((path) => {
    it(`renders children on public path: ${path}`, () => {
      renderGuard(path);
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it(`does not redirect on public path: ${path}`, () => {
      renderGuard(path);
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });
});

describe('GlobalAuthGuard — protected routes, unauthenticated', () => {
  const protectedPaths = ['/listings', '/listings/abc', '/listings/new', '/messages', '/trades/1', '/dashboard', '/user/alice', '/about', '/privacy'];

  protectedPaths.forEach((path) => {
    it(`redirects to /login for protected path: ${path}`, async () => {
      renderGuard(path);
      await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));
    });

    it(`renders nothing (not content) for protected path: ${path}`, () => {
      renderGuard(path);
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });
  });
});

describe('GlobalAuthGuard — loading state', () => {
  beforeEach(() => {
    mockIsLoading = true;
  });

  it('shows spinner on protected route while loading', () => {
    renderGuard('/listings');
    expect(document.querySelector('.animate-spin')).toBeTruthy();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('renders children on public route even while loading', () => {
    renderGuard('/login');
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(document.querySelector('.animate-spin')).not.toBeTruthy();
  });

  it('does not redirect while loading', () => {
    renderGuard('/listings');
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe('GlobalAuthGuard — authenticated', () => {
  beforeEach(() => {
    mockIsAuthenticated = true;
  });

  it('renders children on protected route', () => {
    renderGuard('/listings');
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('does not redirect authenticated user', () => {
    renderGuard('/listings');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('renders children on public route too', () => {
    renderGuard('/donate');
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });
});
