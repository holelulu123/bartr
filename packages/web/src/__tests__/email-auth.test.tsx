import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockReplace = vi.fn();
const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/login',
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const mockSetTokens = vi.fn();
const mockRefreshUser = vi.fn();
let mockIsAuthenticated = false;
let mockIsLoading = false;

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    isLoading: mockIsLoading,
    setTokens: mockSetTokens,
    refreshUser: mockRefreshUser,
  }),
}));

const mockCryptoRegister = vi.fn();
vi.mock('@/contexts/crypto-context', () => ({
  useCrypto: () => ({ register: mockCryptoRegister }),
}));

const mockLogin = vi.fn();
const mockRegister = vi.fn();

vi.mock('@/lib/api', () => ({
  auth: {
    login: (...args: unknown[]) => mockLogin(...args),
    register: (...args: unknown[]) => mockRegister(...args),
  },
}));


afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockIsAuthenticated = false;
  mockIsLoading = false;
});

// ── Login page ─────────────────────────────────────────────────────────────

import LoginPage from '@/app/login/page';

describe('LoginPage — email tab (default)', () => {
  it('renders email and password inputs by default', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
  });

  it('renders Sign in button', () => {
    render(<LoginPage />);
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('renders Create one link pointing to /register/email', () => {
    render(<LoginPage />);
    const link = screen.getByRole('link', { name: /create one/i });
    expect(link).toHaveAttribute('href', '/register/email');
  });

  it('shows validation error for invalid email', async () => {
    render(<LoginPage />);
    await userEvent.type(screen.getByLabelText(/^email$/i), 'notanemail');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(screen.getByText(/valid email/i)).toBeInTheDocument());
  });

  it('calls login with credentials and redirects on success', async () => {
    mockLogin.mockResolvedValue({ access_token: 'at', refresh_token: 'rt' });
    mockRefreshUser.mockResolvedValue(undefined);

    render(<LoginPage />);
    await userEvent.type(screen.getByLabelText(/^email$/i), 'alice@example.com');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'Pass123!x');

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    });

    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('alice@example.com', 'Pass123!x'));
    await waitFor(() => expect(mockSetTokens).toHaveBeenCalledWith('at', 'rt'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/market'));
  });

  it('shows error on invalid credentials', async () => {
    mockLogin.mockRejectedValue(new Error('401'));

    render(<LoginPage />);
    await userEvent.type(screen.getByLabelText(/^email$/i), 'alice@example.com');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'wrongpass');

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    });

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/invalid email or password/i));
  });
});

describe('LoginPage — form rendering', () => {
  it('shows email and password fields', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
  });

  it('shows sign in button', () => {
    render(<LoginPage />);
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows create account link', () => {
    render(<LoginPage />);
    expect(screen.getByRole('link', { name: /create one/i })).toBeInTheDocument();
  });
});

describe('LoginPage — auth redirect', () => {
  it('redirects to /market when already authenticated', async () => {
    mockIsAuthenticated = true;
    render(<LoginPage />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/market'));
  });
});

// ── Email register page ────────────────────────────────────────────────────

import EmailRegisterPage from '@/app/register/email/page';

describe('EmailRegisterPage — form rendering', () => {
  it('renders email and password fields (no nickname field)', () => {
    render(<EmailRegisterPage />);
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^nickname$/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it('renders Create account button', () => {
    render(<EmailRegisterPage />);
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('renders Sign in link', () => {
    render(<EmailRegisterPage />);
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
  });
});

describe('EmailRegisterPage — validation', () => {
  it('shows error for invalid email', async () => {
    render(<EmailRegisterPage />);
    await userEvent.type(screen.getByLabelText(/^email$/i), 'notanemail');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => expect(screen.getByText(/valid email/i)).toBeInTheDocument());
  });

  it('shows error for short password', async () => {
    render(<EmailRegisterPage />);
    await userEvent.type(screen.getByLabelText(/^email$/i), 'a@b.com');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'short');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'short');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => expect(screen.getByText(/at least 8/i)).toBeInTheDocument());
  });

  it('shows unmet passwords match indicator when passwords differ', async () => {
    render(<EmailRegisterPage />);
    await userEvent.type(screen.getByLabelText(/^password$/i), 'Pass123!x');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'Diff123!x');
    await waitFor(() => expect(screen.getByText(/✗ Passwords match/)).toBeInTheDocument());
  });
});

describe('EmailRegisterPage — successful registration', () => {
  beforeEach(() => {
    mockCryptoRegister.mockResolvedValue({
      publicKeyBase64: 'pubkey',
      privateKeyBlob: 'privblob',
      recoveryKeyHex: 'aabbccdd1122',
      recoveryKeyBlob: 'recblob',
    });
    mockRegister.mockResolvedValue({ access_token: 'at', refresh_token: 'rt' });
    mockRefreshUser.mockResolvedValue(undefined);
  });

  it('redirects to verify-email after registration', async () => {
    render(<EmailRegisterPage />);
    await userEvent.type(screen.getByLabelText(/^email$/i), 'new@example.com');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'Pass123!x');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'Pass123!x');

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    });

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/market'));
    expect(screen.queryByText(/save your recovery key/i)).not.toBeInTheDocument();
  });

  it('calls register with email (no nickname in payload)', async () => {
    render(<EmailRegisterPage />);
    await userEvent.type(screen.getByLabelText(/^email$/i), 'new@example.com');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'Pass123!x');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'Pass123!x');

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    });

    await waitFor(() =>
      expect(mockRegister).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@example.com' }),
      ),
    );
    // Nickname must NOT be in the payload
    expect(mockRegister).toHaveBeenCalledWith(
      expect.not.objectContaining({ nickname: expect.anything() }),
    );
  });

  it('sets tokens and refreshes user on successful registration', async () => {
    render(<EmailRegisterPage />);
    await userEvent.type(screen.getByLabelText(/^email$/i), 'new@example.com');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'Pass123!x');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'Pass123!x');

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    });

    await waitFor(() => expect(mockSetTokens).toHaveBeenCalledWith('at', 'rt'));
    expect(mockRefreshUser).toHaveBeenCalled();
  });
});

describe('EmailRegisterPage — server errors', () => {
  it('shows error for duplicate email', async () => {
    mockCryptoRegister.mockResolvedValue({ publicKeyBase64: 'pk', privateKeyBlob: 'priv', recoveryKeyHex: 'hex', recoveryKeyBlob: 'rec' });
    mockRegister.mockRejectedValue(new Error('409: email already registered'));

    render(<EmailRegisterPage />);
    await userEvent.type(screen.getByLabelText(/^email$/i), 'dupe@example.com');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'Pass123!x');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'Pass123!x');

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    });

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/email already registered/i));
  });
});

// ── GlobalAuthGuard — /register/email is public ───────────────────────────

import { GlobalAuthGuard } from '@/components/global-auth-guard';

describe('GlobalAuthGuard — /register/email is public', () => {
  it('renders children without redirect on /register/email', () => {
    // patch pathname
    vi.doMock('next/navigation', () => ({
      useRouter: () => ({ replace: mockReplace }),
      usePathname: () => '/register/email',
    }));

    render(
      <GlobalAuthGuard>
        <div data-testid="content">Register form</div>
      </GlobalAuthGuard>,
    );
    // Since mockIsAuthenticated is false and path is public, children render
    expect(screen.getByTestId('content')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
