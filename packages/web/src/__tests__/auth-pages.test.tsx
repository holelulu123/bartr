import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
const mockReplace = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/',
}));

const mockSetTokens = vi.fn();
const mockRefreshUser = vi.fn();
const mockLogout = vi.fn();

let mockIsAuthenticated = false;
let mockIsLoading = false;

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    user: mockIsAuthenticated ? { id: '1', nickname: 'alice' } : null,
    isAuthenticated: mockIsAuthenticated,
    isLoading: mockIsLoading,
    setTokens: mockSetTokens,
    refreshUser: mockRefreshUser,
    logout: mockLogout,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockCryptoRegister = vi.fn();
const mockUnlock = vi.fn();

vi.mock('@/contexts/crypto-context', () => ({
  useCrypto: () => ({
    register: mockCryptoRegister,
    unlock: mockUnlock,
    isUnlocked: false,
  }),
  CryptoProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/api', () => ({
  auth: {
    register: vi.fn(),
    getKeyBlobs: vi.fn(),
    getGoogleAuthUrl: () => 'https://accounts.google.com/oauth',
  },
}));

import * as apiModule from '@/lib/api';
import LoginPage from '@/app/login/page';
import RegisterPage from '@/app/register/page';
import AuthCallbackPage from '@/app/auth/callback/page';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockIsAuthenticated = false;
  mockIsLoading = false;
  mockSearchParams = new URLSearchParams();
});

// ── /login ─────────────────────────────────────────────────────────────────

describe('/login page', () => {
  it('renders sign-in button', () => {
    render(<LoginPage />);
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows app tagline', () => {
    render(<LoginPage />);
    expect(screen.getByText(/no kyc/i)).toBeInTheDocument();
  });

  it('redirects authenticated users to listings', async () => {
    mockIsAuthenticated = true;
    render(<LoginPage />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/listings'));
  });

  it('does not redirect while auth is loading', () => {
    mockIsLoading = true;
    render(<LoginPage />);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

// ── /register ──────────────────────────────────────────────────────────────

describe('/register page', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams('google_id=gid123');
  });

  it('renders password fields (no nickname field)', () => {
    render(<RegisterPage />);
    expect(screen.queryByLabelText(/nickname/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it('shows error when passwords do not match', async () => {
    render(<RegisterPage />);
    await userEvent.type(screen.getByLabelText(/^password$/i), 'password123');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'different123');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => expect(screen.getByText(/do not match/i)).toBeInTheDocument());
  });

  it('generates keys, registers, and redirects to listings on success', async () => {
    mockCryptoRegister.mockResolvedValue({
      publicKeyBase64: 'pub-key',
      privateKeyBlob: 'priv-blob',
      recoveryKeyHex: 'deadbeef'.repeat(8),
      recoveryKeyBlob: 'rec-blob',
    });
    vi.mocked(apiModule.auth.register).mockResolvedValue({
      access_token: 'at',
      refresh_token: 'rt',
    });
    mockRefreshUser.mockResolvedValue(undefined);

    render(<RegisterPage />);
    await userEvent.type(screen.getByLabelText(/^password$/i), 'password123');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'password123');

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    });

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/listings'));
    expect(mockSetTokens).toHaveBeenCalledWith('at', 'rt');
    expect(apiModule.auth.register).toHaveBeenCalledWith(
      expect.objectContaining({
        google_id: 'gid123',
        public_key: 'pub-key',
        private_key_blob: 'priv-blob',
        recovery_key_blob: 'rec-blob',
      })
    );
  });

  it('redirects to /login if no google_id in query', async () => {
    mockSearchParams = new URLSearchParams();
    render(<RegisterPage />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));
  });
});

// ── /auth/callback ─────────────────────────────────────────────────────────

describe('/auth/callback page', () => {
  it('shows spinner while processing', () => {
    mockSearchParams = new URLSearchParams('access_token=at&refresh_token=rt');
    vi.mocked(apiModule.auth.getKeyBlobs).mockResolvedValue({
      public_key: null,
      private_key_blob: null,
      recovery_key_blob: null,
    });
    mockRefreshUser.mockResolvedValue(undefined);
    render(<AuthCallbackPage />);
    expect(screen.getByText(/signing you in/i)).toBeInTheDocument();
  });

  it('shows error on auth_error param', async () => {
    mockSearchParams = new URLSearchParams('auth_error=google_denied');
    render(<AuthCallbackPage />);
    await waitFor(() =>
      expect(screen.getByText(/cancelled/i)).toBeInTheDocument()
    );
  });

  it('shows error when tokens are missing', async () => {
    mockSearchParams = new URLSearchParams();
    render(<AuthCallbackPage />);
    await waitFor(() =>
      expect(screen.getByText(/authentication failed/i)).toBeInTheDocument()
    );
  });

  it('stores tokens and redirects to listings for new user (no key blobs)', async () => {
    mockSearchParams = new URLSearchParams('access_token=at&refresh_token=rt');
    vi.mocked(apiModule.auth.getKeyBlobs).mockResolvedValue({
      public_key: null,
      private_key_blob: null,
      recovery_key_blob: null,
    });
    mockRefreshUser.mockResolvedValue(undefined);

    render(<AuthCallbackPage />);

    await waitFor(() => expect(mockSetTokens).toHaveBeenCalledWith('at', 'rt'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/listings'));
  });

  it('redirects to /auth/unlock for existing user with key blobs', async () => {
    mockSearchParams = new URLSearchParams('access_token=at&refresh_token=rt');
    vi.mocked(apiModule.auth.getKeyBlobs).mockResolvedValue({
      public_key: 'pk',
      private_key_blob: 'blob',
      recovery_key_blob: 'rblob',
    });
    mockRefreshUser.mockResolvedValue(undefined);

    render(<AuthCallbackPage />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/auth/unlock'));
  });
});
