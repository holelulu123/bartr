import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/listings/new',
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

let mockIsAuthenticated = true;
let mockIsLoading = false;

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    user: mockIsAuthenticated ? { id: '1', nickname: 'alice' } : null,
    isAuthenticated: mockIsAuthenticated,
    isLoading: mockIsLoading,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockCreateListingMutation = { mutateAsync: vi.fn(), isPending: false };
const mockUseCategories = vi.fn();

vi.mock('@/hooks/use-listings', () => ({
  useCreateListing: () => mockCreateListingMutation,
  useUploadListingImage: () => ({ mutateAsync: vi.fn() }),
  useCategories: () => mockUseCategories(),
}));

const mockCheckText = vi.fn();
vi.mock('@/lib/api', async () => {
  const actual = await import('@/lib/api');
  return {
    ...actual,
    moderation: {
      checkText: (...args: unknown[]) => mockCheckText(...args),
    },
    listings: {
      uploadListingImage: vi.fn().mockResolvedValue({ id: 'img-1', storage_key: 'key' }),
    },
  };
});

// ── Helpers ────────────────────────────────────────────────────────────────

import CreateListingPage from '@/app/listings/new/page';

function setupCategories() {
  mockUseCategories.mockReturnValue({
    data: {
      categories: [
        { id: 1, name: 'Electronics', slug: 'electronics', parent_id: null },
        { id: 2, name: 'Clothing', slug: 'clothing', parent_id: null },
      ],
    },
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockIsAuthenticated = true;
  mockIsLoading = false;
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('CreateListingPage — auth guard', () => {
  it('redirects to /login when not authenticated', async () => {
    mockIsAuthenticated = false;
    setupCategories();
    render(<CreateListingPage />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));
  });

  it('shows spinner while auth is loading', () => {
    mockIsAuthenticated = false;
    mockIsLoading = true;
    setupCategories();
    render(<CreateListingPage />);
    // ProtectedRoute shows a spinner — no form rendered
    expect(screen.queryByRole('button', { name: /post listing/i })).not.toBeInTheDocument();
  });
});

describe('CreateListingPage — form rendering', () => {
  beforeEach(() => {
    setupCategories();
    mockCheckText.mockResolvedValue({ allowed: true, blocked_keyword: null });
  });

  it('renders page heading', () => {
    render(<CreateListingPage />);
    expect(screen.getByRole('heading', { name: /post a listing/i })).toBeInTheDocument();
  });

  it('renders title input', () => {
    render(<CreateListingPage />);
    expect(screen.getByLabelText(/^title$/i)).toBeInTheDocument();
  });

  it('renders description textarea', () => {
    render(<CreateListingPage />);
    expect(screen.getByLabelText(/^description$/i)).toBeInTheDocument();
  });

  it('renders category dropdown', () => {
    render(<CreateListingPage />);
    expect(screen.getByRole('combobox', { name: /category/i })).toBeInTheDocument();
  });

  it('renders price and currency inputs', () => {
    render(<CreateListingPage />);
    expect(screen.getByLabelText(/price/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/currency/i)).toBeInTheDocument();
  });

  it('renders all payment method toggle buttons', () => {
    render(<CreateListingPage />);
    expect(screen.getByRole('button', { name: 'BTC' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ETH' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'USDT' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'USDC' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cash' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bank transfer' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'XMR' })).not.toBeInTheDocument();
  });

  it('renders image upload zone', () => {
    render(<CreateListingPage />);
    expect(screen.getByLabelText(/upload images/i)).toBeInTheDocument();
  });

  it('renders Post listing submit button', () => {
    render(<CreateListingPage />);
    expect(screen.getByRole('button', { name: /post listing/i })).toBeInTheDocument();
  });

  it('renders Cancel link pointing to /listings', () => {
    render(<CreateListingPage />);
    const cancel = screen.getByRole('link', { name: /cancel/i });
    expect(cancel).toHaveAttribute('href', '/listings');
  });

  it('renders back to listings link', () => {
    render(<CreateListingPage />);
    const back = screen.getByRole('link', { name: /back to listings/i });
    expect(back).toHaveAttribute('href', '/listings');
  });
});

describe('CreateListingPage — validation', () => {
  beforeEach(() => {
    setupCategories();
    mockCheckText.mockResolvedValue({ allowed: true, blocked_keyword: null });
  });

  it('shows error for short title', async () => {
    render(<CreateListingPage />);
    await userEvent.type(screen.getByLabelText(/^title$/i), 'ab');
    await userEvent.click(screen.getByRole('button', { name: /post listing/i }));
    await waitFor(() =>
      expect(screen.getByText(/at least 3 characters/i)).toBeInTheDocument(),
    );
  });

  it('shows error for short description', async () => {
    render(<CreateListingPage />);
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Valid Title');
    await userEvent.type(screen.getByLabelText(/^description$/i), 'Short');
    await userEvent.click(screen.getByRole('button', { name: /post listing/i }));
    await waitFor(() =>
      expect(screen.getByText(/at least 10 characters/i)).toBeInTheDocument(),
    );
  });

  it('shows error when no payment method selected', async () => {
    render(<CreateListingPage />);
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Valid Title Here');
    await userEvent.type(
      screen.getByLabelText(/^description$/i),
      'This is a valid description with enough content.',
    );
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /post listing/i }));
    });
    await waitFor(() =>
      expect(screen.getByText(/at least one payment method/i)).toBeInTheDocument(),
    );
  });
});

describe('CreateListingPage — payment method toggles', () => {
  beforeEach(() => {
    setupCategories();
  });

  it('toggles payment method on click', async () => {
    render(<CreateListingPage />);
    const btcBtn = screen.getByRole('button', { name: 'BTC' });
    expect(btcBtn).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(btcBtn);
    expect(btcBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('untoggle payment method on second click', async () => {
    render(<CreateListingPage />);
    const btcBtn = screen.getByRole('button', { name: 'BTC' });
    await userEvent.click(btcBtn);
    await userEvent.click(btcBtn);
    expect(btcBtn).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('CreateListingPage — moderation', () => {
  beforeEach(() => {
    setupCategories();
  });

  it('shows blocked keyword error when moderation check fails', async () => {
    mockCheckText.mockResolvedValue({ allowed: false, blocked_keyword: 'scam' });

    render(<CreateListingPage />);
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Valid Title Here');
    await userEvent.type(
      screen.getByLabelText(/^description$/i),
      'This is a valid description that contains enough text.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'BTC' }));

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /post listing/i }));
    });

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/blocked keyword.*scam/i),
    );
    expect(mockCreateListingMutation.mutateAsync).not.toHaveBeenCalled();
  });
});

describe('CreateListingPage — successful submit', () => {
  beforeEach(() => {
    setupCategories();
    mockCheckText.mockResolvedValue({ allowed: true, blocked_keyword: null });
    mockCreateListingMutation.mutateAsync.mockResolvedValue({
      id: 'new-listing-1',
      title: 'Valid Title Here',
      description: 'Description content',
      user_id: 'user-1',
      category_id: null,
      payment_methods: ['btc'],
      price_indication: null,
      currency: null,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      seller_nickname: 'alice',
      category_name: null,
      category_slug: null,
      images: [],
    });
  });

  it('calls createListing with correct payload', async () => {
    render(<CreateListingPage />);
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Valid Title Here');
    await userEvent.type(
      screen.getByLabelText(/^description$/i),
      'This is a valid description with enough content.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'BTC' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cash' }));

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /post listing/i }));
    });

    await waitFor(() =>
      expect(mockCreateListingMutation.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Valid Title Here',
          description: 'This is a valid description with enough content.',
          payment_methods: ['btc', 'cash'],
        }),
      ),
    );
  });

  it('navigates to new listing on success', async () => {
    render(<CreateListingPage />);
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Valid Title Here');
    await userEvent.type(
      screen.getByLabelText(/^description$/i),
      'This is a valid description with enough content.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'BTC' }));

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /post listing/i }));
    });

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/listings/new-listing-1'));
  });

  it('includes price and currency when provided', async () => {
    render(<CreateListingPage />);
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Valid Title Here');
    await userEvent.type(
      screen.getByLabelText(/^description$/i),
      'This is a valid description with enough content.',
    );
    await userEvent.type(screen.getByLabelText(/price/i), '0.005');
    await userEvent.type(screen.getByLabelText(/currency/i), 'BTC');
    await userEvent.click(screen.getByRole('button', { name: 'BTC' }));

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /post listing/i }));
    });

    await waitFor(() =>
      expect(mockCreateListingMutation.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          price_indication: '0.005',
          currency: 'BTC',
        }),
      ),
    );
  });
});
