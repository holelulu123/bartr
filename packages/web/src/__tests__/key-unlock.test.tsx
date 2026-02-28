import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockReplace = vi.fn();
const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams();
let mockPathname = '/auth/unlock';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => mockPathname,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

let mockIsAuthenticated = true; // unlock/recover pages assume already logged in
let mockIsLoading = false;
let mockIsUnlocked = false;

const mockLogout = vi.fn();

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    isLoading: mockIsLoading,
    logout: mockLogout,
  }),
}));

const mockUnlock = vi.fn();
const mockUnlockWithRecovery = vi.fn();

vi.mock('@/contexts/crypto-context', () => ({
  useCrypto: () => ({
    unlock: mockUnlock,
    unlockWithRecovery: mockUnlockWithRecovery,
    isUnlocked: mockIsUnlocked,
  }),
}));

const mockGetKeyBlobs = vi.fn();

vi.mock('@/lib/api', () => ({
  auth: {
    getKeyBlobs: (...args: unknown[]) => mockGetKeyBlobs(...args),
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockIsAuthenticated = true;
  mockIsLoading = false;
  mockIsUnlocked = false;
  mockSearchParams = new URLSearchParams();
  mockPathname = '/auth/unlock';
});

// ── UnlockPage ─────────────────────────────────────────────────────────────

import UnlockPage from '@/app/auth/unlock/page';

describe('UnlockPage — rendering', () => {
  it('renders password field and Unlock button', () => {
    render(<UnlockPage />);
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^unlock$/i })).toBeInTheDocument();
  });

  it('renders link to recovery page', () => {
    render(<UnlockPage />);
    expect(screen.getByRole('link', { name: /use recovery key/i })).toHaveAttribute('href', '/auth/recover');
  });

  it('renders skip link', () => {
    render(<UnlockPage />);
    expect(screen.getByRole('link', { name: /skip for now/i })).toHaveAttribute('href', '/listings');
  });

  it('redirects to /login when not authenticated', () => {
    mockIsAuthenticated = false;
    render(<UnlockPage />);
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });
});

describe('UnlockPage — successful unlock', () => {
  beforeEach(() => {
    mockGetKeyBlobs.mockResolvedValue({
      private_key_blob: 'blob123',
      recovery_key_blob: 'recblob',
      public_key: 'pubkey',
    });
    mockUnlock.mockResolvedValue(undefined);
  });

  it('calls getKeyBlobs and unlock with password, then redirects', async () => {
    render(<UnlockPage />);
    await userEvent.type(screen.getByLabelText(/^password$/i), 'mypassword');

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /^unlock$/i }));
    });

    await waitFor(() => expect(mockGetKeyBlobs).toHaveBeenCalled());
    await waitFor(() => expect(mockUnlock).toHaveBeenCalledWith('blob123', 'mypassword'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/listings'));
  });

  it('redirects to /listings directly when no key blobs exist', async () => {
    mockGetKeyBlobs.mockResolvedValue({
      private_key_blob: null,
      recovery_key_blob: null,
      public_key: null,
    });
    render(<UnlockPage />);
    await userEvent.type(screen.getByLabelText(/^password$/i), 'anypass');

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /^unlock$/i }));
    });

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/listings'));
    expect(mockUnlock).not.toHaveBeenCalled();
  });
});

describe('UnlockPage — error handling', () => {
  it('shows error on wrong password', async () => {
    mockGetKeyBlobs.mockResolvedValue({ private_key_blob: 'blob', recovery_key_blob: 'r', public_key: 'p' });
    mockUnlock.mockRejectedValue(new Error('DOMException: bad decrypt'));

    render(<UnlockPage />);
    await userEvent.type(screen.getByLabelText(/^password$/i), 'wrongpass');

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /^unlock$/i }));
    });

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/incorrect password/i),
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows validation error for empty password', async () => {
    render(<UnlockPage />);
    await userEvent.click(screen.getByRole('button', { name: /^unlock$/i }));
    await waitFor(() => expect(screen.getByText(/password is required/i)).toBeInTheDocument());
    expect(mockGetKeyBlobs).not.toHaveBeenCalled();
  });
});

// ── RecoverPage ────────────────────────────────────────────────────────────

import RecoverPage from '@/app/auth/recover/page';

describe('RecoverPage — rendering', () => {
  it('renders recovery key field and Recover access button', () => {
    render(<RecoverPage />);
    expect(screen.getByLabelText(/recovery key/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /recover access/i })).toBeInTheDocument();
  });

  it('renders link back to unlock page', () => {
    render(<RecoverPage />);
    expect(screen.getByRole('link', { name: /back to password unlock/i })).toHaveAttribute('href', '/auth/unlock');
  });

  it('redirects to /login when not authenticated', () => {
    mockIsAuthenticated = false;
    render(<RecoverPage />);
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });
});

describe('RecoverPage — validation', () => {
  it('shows error for empty recovery key', async () => {
    render(<RecoverPage />);
    await userEvent.click(screen.getByRole('button', { name: /recover access/i }));
    await waitFor(() => expect(screen.getByText(/recovery key is required/i)).toBeInTheDocument());
  });

  it('shows error for non-hex recovery key', async () => {
    render(<RecoverPage />);
    await userEvent.type(screen.getByLabelText(/recovery key/i), 'not-valid-hex!!');
    await userEvent.click(screen.getByRole('button', { name: /recover access/i }));
    await waitFor(() => expect(screen.getByText(/hexadecimal/i)).toBeInTheDocument());
  });
});

describe('RecoverPage — successful recovery', () => {
  beforeEach(() => {
    mockGetKeyBlobs.mockResolvedValue({
      private_key_blob: 'blob',
      recovery_key_blob: 'recblob',
      public_key: 'pk',
    });
    mockUnlockWithRecovery.mockResolvedValue(undefined);
  });

  it('calls unlockWithRecovery and redirects to /listings', async () => {
    render(<RecoverPage />);
    await userEvent.type(screen.getByLabelText(/recovery key/i), 'aabbccdd1122');

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /recover access/i }));
    });

    await waitFor(() => expect(mockUnlockWithRecovery).toHaveBeenCalledWith('recblob', 'aabbccdd1122'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/listings'));
  });
});

describe('RecoverPage — error handling', () => {
  it('shows error when unlockWithRecovery throws', async () => {
    mockGetKeyBlobs.mockResolvedValue({ private_key_blob: 'b', recovery_key_blob: 'r', public_key: 'p' });
    mockUnlockWithRecovery.mockRejectedValue(new Error('bad key'));

    render(<RecoverPage />);
    await userEvent.type(screen.getByLabelText(/recovery key/i), 'aabb1122');

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /recover access/i }));
    });

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/invalid recovery key/i),
    );
  });

  it('shows error when no recovery blob found on server', async () => {
    mockGetKeyBlobs.mockResolvedValue({ private_key_blob: null, recovery_key_blob: null, public_key: null });

    render(<RecoverPage />);
    await userEvent.type(screen.getByLabelText(/recovery key/i), 'aabb1122');

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /recover access/i }));
    });

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/no recovery key found/i),
    );
  });
});

// ── ?next= param support ───────────────────────────────────────────────────

describe('UnlockPage — ?next= redirect', () => {
  beforeEach(() => {
    mockGetKeyBlobs.mockResolvedValue({ private_key_blob: 'blob', recovery_key_blob: 'r', public_key: 'p' });
    mockUnlock.mockResolvedValue(undefined);
  });

  it('redirects to ?next= path after successful unlock', async () => {
    mockSearchParams = new URLSearchParams('next=%2Fmessages%2Fthread-1');
    render(<UnlockPage />);
    await userEvent.type(screen.getByLabelText(/^password$/i), 'mypassword');
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /^unlock$/i }));
    });
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/messages/thread-1'));
  });

  it('skip link points to ?next= path', () => {
    mockSearchParams = new URLSearchParams('next=%2Fmessages');
    render(<UnlockPage />);
    expect(screen.getByRole('link', { name: /skip for now/i })).toHaveAttribute('href', '/messages');
  });
});

// ── CryptoGuard ────────────────────────────────────────────────────────────

import { CryptoGuard } from '@/components/crypto-guard';

describe('CryptoGuard', () => {
  it('always renders children (pass-through)', () => {
    mockIsUnlocked = false;
    mockIsAuthenticated = true;
    mockIsLoading = false;
    render(
      <CryptoGuard>
        <div data-testid="content">Messages</div>
      </CryptoGuard>,
    );
    expect(screen.getByTestId('content')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('renders children when keys are unlocked', () => {
    mockIsUnlocked = true;
    render(
      <CryptoGuard>
        <div data-testid="content">Messages</div>
      </CryptoGuard>,
    );
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });
});
