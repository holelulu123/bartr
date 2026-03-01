import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockReplace = vi.fn();
const mockPush = vi.fn();

let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/auth/verify-email',
}));

const mockRefreshUser = vi.fn();
const mockLogout = vi.fn().mockResolvedValue(undefined);
let mockIsAuthenticated = false;
let mockIsLoading = false;
let mockUser: { email_verified: boolean } | null = null;

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: mockIsAuthenticated,
    isLoading: mockIsLoading,
    refreshUser: mockRefreshUser,
    logout: mockLogout,
  }),
}));

const mockToast = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockVerifyEmail = vi.fn();
const mockResendVerification = vi.fn();

vi.mock('@/lib/api', () => ({
  auth: {
    verifyEmail: (...args: unknown[]) => mockVerifyEmail(...args),
    resendVerification: (...args: unknown[]) => mockResendVerification(...args),
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  mockIsAuthenticated = false;
  mockIsLoading = false;
  mockUser = null;
  mockSearchParams = new URLSearchParams();
});

// ── Helpers ────────────────────────────────────────────────────────────────

/** Type a 6-digit code into the OTP boxes one digit at a time */
async function typeCode(code: string) {
  for (let i = 0; i < code.length; i++) {
    const input = screen.getByLabelText(`Digit ${i + 1}`);
    await userEvent.type(input, code[i]);
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

import VerifyEmailPage from '@/app/auth/verify-email/page';

describe('VerifyEmailPage — rendering', () => {
  beforeEach(() => {
    mockIsAuthenticated = true;
    mockUser = { email_verified: false };
  });

  it('renders the verification form with 6 digit inputs and submit button', () => {
    render(<VerifyEmailPage />);
    // 6 individual digit boxes
    for (let i = 1; i <= 6; i++) {
      expect(screen.getByLabelText(`Digit ${i}`)).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: /^verify$/i })).toBeInTheDocument();
    expect(screen.getByText(/verify your email/i)).toBeInTheDocument();
    expect(screen.getByText(/6-digit code/i)).toBeInTheDocument();
  });

  it('renders the resend button', () => {
    render(<VerifyEmailPage />);
    expect(screen.getByRole('button', { name: /resend/i })).toBeInTheDocument();
  });
});

describe('VerifyEmailPage — redirects', () => {
  it('redirects to /login when not authenticated', () => {
    mockIsAuthenticated = false;
    mockUser = null;
    render(<VerifyEmailPage />);
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('redirects to /market when already verified', () => {
    mockIsAuthenticated = true;
    mockUser = { email_verified: true };
    render(<VerifyEmailPage />);
    expect(mockReplace).toHaveBeenCalledWith('/market');
  });

  it('redirects to ?next= param when already verified', () => {
    mockIsAuthenticated = true;
    mockUser = { email_verified: true };
    mockSearchParams = new URLSearchParams('next=/dashboard');
    render(<VerifyEmailPage />);
    expect(mockReplace).toHaveBeenCalledWith('/dashboard');
  });
});

describe('VerifyEmailPage — form validation', () => {
  beforeEach(() => {
    mockIsAuthenticated = true;
    mockUser = { email_verified: false };
  });

  it('shows error for empty code submission', async () => {
    render(<VerifyEmailPage />);
    await userEvent.click(screen.getByRole('button', { name: /^verify$/i }));
    await waitFor(() =>
      expect(screen.getByText(/verification code is required/i)).toBeInTheDocument(),
    );
  });

  it('shows error for partial code (less than 6 digits)', async () => {
    render(<VerifyEmailPage />);
    // Type only 3 digits
    await userEvent.type(screen.getByLabelText('Digit 1'), '1');
    await userEvent.type(screen.getByLabelText('Digit 2'), '2');
    await userEvent.type(screen.getByLabelText('Digit 3'), '3');
    await userEvent.click(screen.getByRole('button', { name: /^verify$/i }));
    await waitFor(() =>
      expect(screen.getByText(/exactly 6 digits/i)).toBeInTheDocument(),
    );
  });
});

describe('VerifyEmailPage — server error', () => {
  beforeEach(() => {
    mockIsAuthenticated = true;
    mockUser = { email_verified: false };
  });

  it('shows server error on invalid code submission', async () => {
    mockVerifyEmail.mockRejectedValue(new Error('Invalid or expired code'));

    render(<VerifyEmailPage />);
    await typeCode('999999');

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /^verify$/i }));
    });

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/invalid or expired code/i),
    );
  });
});

describe('VerifyEmailPage — successful verification', () => {
  beforeEach(() => {
    mockIsAuthenticated = true;
    mockUser = { email_verified: false };
    mockVerifyEmail.mockResolvedValue({ verified: true });
    mockRefreshUser.mockResolvedValue(undefined);
  });

  it('shows success toast and redirects on successful verification', async () => {
    render(<VerifyEmailPage />);
    await typeCode('123456');

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /^verify$/i }));
    });

    await waitFor(() => expect(mockVerifyEmail).toHaveBeenCalledWith('123456'));
    expect(mockRefreshUser).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Email verified' }),
    );
    expect(mockReplace).toHaveBeenCalledWith('/market');
  });

  it('supports ?next= query param redirect on success', async () => {
    mockSearchParams = new URLSearchParams('next=/settings/profile');

    render(<VerifyEmailPage />);
    await typeCode('123456');

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /^verify$/i }));
    });

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/settings/profile'));
  });
});

describe('VerifyEmailPage — resend', () => {
  beforeEach(() => {
    mockIsAuthenticated = true;
    mockUser = { email_verified: false };
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it('resend button triggers cooldown timer', async () => {
    mockResendVerification.mockResolvedValue({ message: 'sent' });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<VerifyEmailPage />);

    const resendBtn = screen.getByRole('button', { name: /resend/i });
    expect(resendBtn).not.toBeDisabled();

    await act(async () => {
      await user.click(resendBtn);
    });

    await waitFor(() => expect(mockResendVerification).toHaveBeenCalled());
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Verification code sent' }),
    );

    // Cooldown should be active
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /resend in/i })).toBeDisabled(),
    );

    // Advance time past cooldown
    await act(async () => {
      vi.advanceTimersByTime(61_000);
    });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^resend$/i })).not.toBeDisabled(),
    );
  });

  it('shows error when resend fails', async () => {
    mockResendVerification.mockRejectedValue(new Error('Rate limited'));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<VerifyEmailPage />);

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /resend/i }));
    });

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/rate limited/i),
    );
  });
});

describe('VerifyEmailPage — auto-logout on expiry', () => {
  beforeEach(() => {
    mockIsAuthenticated = true;
    mockUser = { email_verified: false };
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it('logs out and redirects to /register when code timer expires', async () => {
    render(<VerifyEmailPage />);

    // Advance past the 5-minute expiry
    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000 + 1000);
    });

    await waitFor(() => expect(mockLogout).toHaveBeenCalled());
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/register'));
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Registration expired' }),
    );
  });
});
