import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor, cleanup } from '@testing-library/react';
import { AuthProvider, useAuth, resetBootState } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api/client';

// ── Mock the API auth module ──────────────────────────────────────────────────
vi.mock('@/lib/api/auth', () => ({
  getMe: vi.fn(),
  refreshTokens: vi.fn(),
  logout: vi.fn(),
}));

// Mock setTokenStore so we can inspect what's passed
vi.mock('@/lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/client')>();
  return {
    ...actual,
    setTokenStore: vi.fn(),
  };
});

import * as authApi from '@/lib/api/auth';
import { setTokenStore } from '@/lib/api/client';

// ── Cookie helpers ────────────────────────────────────────────────────────────
function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/`;
}

function clearCookie(name: string) {
  document.cookie = `${name}=; max-age=0; path=/`;
}

// ── Test component that surfaces auth state ───────────────────────────────────
function AuthDisplay() {
  const { user, isLoading, isAuthenticated } = useAuth();
  if (isLoading) return <div>loading</div>;
  if (!isAuthenticated) return <div>not authenticated</div>;
  return <div>authenticated as {user!.nickname}</div>;
}

// ── Test component that surfaces auth actions ─────────────────────────────────
function AuthActions() {
  const { setTokens, logout, refreshUser } = useAuth();
  return (
    <>
      <button onClick={() => setTokens('at', 'rt')}>set tokens</button>
      <button onClick={() => logout()}>logout</button>
      <button onClick={() => refreshUser()}>refresh user</button>
    </>
  );
}

// ── Cleanup ───────────────────────────────────────────────────────────────────
beforeEach(() => {
  resetBootState();
});

afterEach(() => {
  cleanup();
  clearCookie('bartr_refresh');
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('AuthProvider — initial load with no cookie', () => {
  it('shows not authenticated when no refresh cookie exists', async () => {
    vi.mocked(authApi.refreshTokens).mockResolvedValue({ access_token: '', refresh_token: '' });
    vi.mocked(authApi.getMe).mockResolvedValue({ id: '1', nickname: 'alice', created_at: '', last_active: '' });

    await act(async () => {
      render(<AuthProvider><AuthDisplay /></AuthProvider>);
    });

    expect(screen.getByText('not authenticated')).toBeInTheDocument();
    expect(authApi.refreshTokens).not.toHaveBeenCalled();
  });
});

describe('AuthProvider — initial load with valid cookie', () => {
  it('restores session from refresh cookie', async () => {
    setCookie('bartr_refresh', 'valid-refresh-token');
    vi.mocked(authApi.refreshTokens).mockResolvedValue({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
    });
    vi.mocked(authApi.getMe).mockResolvedValue({
      id: '1',
      nickname: 'alice',
      created_at: '2024-01-01',
      last_active: '2024-01-01',
    });

    await act(async () => {
      render(<AuthProvider><AuthDisplay /></AuthProvider>);
    });

    expect(screen.getByText('authenticated as alice')).toBeInTheDocument();
    expect(authApi.refreshTokens).toHaveBeenCalledWith('valid-refresh-token');
    expect(authApi.getMe).toHaveBeenCalled();
  });

  it('clears state when refresh token is invalid', async () => {
    setCookie('bartr_refresh', 'bad-token');
    vi.mocked(authApi.refreshTokens).mockRejectedValue(new ApiError(401, 'Unauthorized', {}));

    await act(async () => {
      render(<AuthProvider><AuthDisplay /></AuthProvider>);
    });

    expect(screen.getByText('not authenticated')).toBeInTheDocument();
  });
});

describe('AuthProvider — setTokens', () => {
  it('stores tokens when setTokens is called', async () => {
    vi.mocked(authApi.refreshTokens).mockRejectedValue(new Error('no cookie'));

    await act(async () => {
      render(<AuthProvider><AuthActions /></AuthProvider>);
    });

    await act(async () => {
      screen.getByText('set tokens').click();
    });

    // Cookie should now be set
    expect(document.cookie).toContain('bartr_refresh');
  });
});

describe('AuthProvider — logout', () => {
  it('calls API logout and clears user state', async () => {
    setCookie('bartr_refresh', 'rt-123');
    vi.mocked(authApi.refreshTokens).mockResolvedValue({
      access_token: 'at',
      refresh_token: 'new-rt',
    });
    vi.mocked(authApi.getMe).mockResolvedValue({
      id: '1',
      nickname: 'alice',
      created_at: '',
      last_active: '',
    });
    vi.mocked(authApi.logout).mockResolvedValue(undefined);

    await act(async () => {
      render(
        <AuthProvider>
          <AuthDisplay />
          <AuthActions />
        </AuthProvider>
      );
    });

    expect(screen.getByText('authenticated as alice')).toBeInTheDocument();

    await act(async () => {
      screen.getByText('logout').click();
    });

    expect(authApi.logout).toHaveBeenCalled();
    expect(screen.getByText('not authenticated')).toBeInTheDocument();
  });

  it('clears state even when API logout call fails', async () => {
    setCookie('bartr_refresh', 'rt-123');
    vi.mocked(authApi.refreshTokens).mockResolvedValue({ access_token: 'at', refresh_token: 'rt' });
    vi.mocked(authApi.getMe).mockResolvedValue({ id: '1', nickname: 'bob', created_at: '', last_active: '' });
    vi.mocked(authApi.logout).mockRejectedValue(new Error('network error'));

    await act(async () => {
      render(<AuthProvider><AuthDisplay /><AuthActions /></AuthProvider>);
    });

    await act(async () => {
      screen.getByText('logout').click();
    });

    expect(screen.getByText('not authenticated')).toBeInTheDocument();
  });
});

describe('AuthProvider — refreshUser', () => {
  it('updates user state from /auth/me', async () => {
    vi.mocked(authApi.refreshTokens).mockRejectedValue(new Error('no cookie'));
    vi.mocked(authApi.getMe).mockResolvedValue({ id: '2', nickname: 'charlie', created_at: '', last_active: '' });

    await act(async () => {
      render(<AuthProvider><AuthDisplay /><AuthActions /></AuthProvider>);
    });

    await act(async () => {
      screen.getByText('refresh user').click();
    });

    await waitFor(() => {
      expect(screen.getByText('authenticated as charlie')).toBeInTheDocument();
    });
  });

  it('clears state on 401 from refreshUser', async () => {
    setCookie('bartr_refresh', 'rt');
    vi.mocked(authApi.refreshTokens).mockResolvedValue({ access_token: 'at', refresh_token: 'rt2' });
    vi.mocked(authApi.getMe)
      .mockResolvedValueOnce({ id: '1', nickname: 'dave', created_at: '', last_active: '' })
      .mockRejectedValueOnce(new ApiError(401, 'Unauthorized', {}));

    await act(async () => {
      render(<AuthProvider><AuthDisplay /><AuthActions /></AuthProvider>);
    });

    expect(screen.getByText('authenticated as dave')).toBeInTheDocument();

    await act(async () => {
      screen.getByText('refresh user').click();
    });

    await waitFor(() => {
      expect(screen.getByText('not authenticated')).toBeInTheDocument();
    });
  });
});

describe('useAuth outside provider', () => {
  it('throws when used outside AuthProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Bare() {
      useAuth();
      return null;
    }
    expect(() => render(<Bare />)).toThrow('useAuth must be used within an AuthProvider');
    consoleError.mockRestore();
  });
});

describe('setTokenStore is called on mount', () => {
  it('registers a token store with the API client', async () => {
    vi.mocked(authApi.refreshTokens).mockRejectedValue(new Error('no cookie'));

    await act(async () => {
      render(<AuthProvider><div /></AuthProvider>);
    });

    expect(setTokenStore).toHaveBeenCalledWith(
      expect.objectContaining({
        getAccessToken: expect.any(Function),
        getRefreshToken: expect.any(Function),
        setTokens: expect.any(Function),
        clearTokens: expect.any(Function),
      })
    );
  });
});
