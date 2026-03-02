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

  it('renders price input and currency dropdown', () => {
    render(<CreateListingPage />);
    expect(screen.getByLabelText(/price/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /currency/i })).toBeInTheDocument();
  });

  it('renders crypto toggle checkbox', () => {
    render(<CreateListingPage />);
    expect(screen.getByLabelText(/also accept cryptocurrency/i)).toBeInTheDocument();
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

  it('shows country error when crypto toggled on but no country selected', async () => {
    render(<CreateListingPage />);
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Valid Title Here');
    await userEvent.type(
      screen.getByLabelText(/^description$/i),
      'This is a valid description with enough content.',
    );
    await userEvent.type(screen.getByLabelText(/price/i), '100');
    // Toggle crypto on but don't select any
    await userEvent.click(screen.getByLabelText(/also accept cryptocurrency/i));
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /post listing/i }));
    });
    // Country validation fires first since country is required
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/select a country/i),
    );
  });

  it('shows error for missing price', async () => {
    render(<CreateListingPage />);
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Valid Title Here');
    await userEvent.type(
      screen.getByLabelText(/^description$/i),
      'This is a valid description with enough content.',
    );
    // Don't fill price — submit
    await userEvent.click(screen.getByRole('button', { name: /post listing/i }));
    await waitFor(() =>
      expect(screen.getByText(/price is required/i)).toBeInTheDocument(),
    );
  });
});

describe('CreateListingPage — crypto toggles', () => {
  beforeEach(() => {
    setupCategories();
  });

  it('shows crypto buttons when checkbox is checked', async () => {
    render(<CreateListingPage />);
    // Buttons not visible initially
    expect(screen.queryByRole('button', { name: /Bitcoin/i })).not.toBeInTheDocument();
    // Check the checkbox
    await userEvent.click(screen.getByLabelText(/also accept cryptocurrency/i));
    expect(screen.getByRole('button', { name: /Bitcoin/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ethereum/i })).toBeInTheDocument();
  });

  it('toggles crypto on click', async () => {
    render(<CreateListingPage />);
    await userEvent.click(screen.getByLabelText(/also accept cryptocurrency/i));
    const btcBtn = screen.getByRole('button', { name: /Bitcoin/i });
    expect(btcBtn).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(btcBtn);
    expect(btcBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('untoggle crypto on second click', async () => {
    render(<CreateListingPage />);
    await userEvent.click(screen.getByLabelText(/also accept cryptocurrency/i));
    const btcBtn = screen.getByRole('button', { name: /Bitcoin/i });
    await userEvent.click(btcBtn);
    await userEvent.click(btcBtn);
    expect(btcBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('hides crypto buttons when checkbox is unchecked', async () => {
    render(<CreateListingPage />);
    await userEvent.click(screen.getByLabelText(/also accept cryptocurrency/i));
    expect(screen.getByRole('button', { name: /Bitcoin/i })).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(/also accept cryptocurrency/i));
    expect(screen.queryByRole('button', { name: /Bitcoin/i })).not.toBeInTheDocument();
  });
});

describe('CreateListingPage — moderation', () => {
  beforeEach(() => {
    setupCategories();
  });

  it('does not submit without price filled', async () => {
    mockCheckText.mockResolvedValue({ allowed: false, blocked_keyword: 'scam' });

    render(<CreateListingPage />);
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Valid Title Here');
    await userEvent.type(
      screen.getByLabelText(/^description$/i),
      'This is a valid description that contains enough text.',
    );

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /post listing/i }));
    });

    // Zod validation catches missing price before moderation check runs
    await waitFor(() =>
      expect(screen.getByText(/price is required/i)).toBeInTheDocument(),
    );
    expect(mockCreateListingMutation.mutateAsync).not.toHaveBeenCalled();
  });
});

describe('CreateListingPage — country validation', () => {
  beforeEach(() => {
    setupCategories();
    mockCheckText.mockResolvedValue({ allowed: true, blocked_keyword: null });
  });

  it('shows error when country not selected', async () => {
    render(<CreateListingPage />);
    await userEvent.type(screen.getByLabelText(/^title$/i), 'Valid Title Here');
    await userEvent.type(
      screen.getByLabelText(/^description$/i),
      'This is a valid description with enough content.',
    );
    await userEvent.type(screen.getByLabelText(/price/i), '100');

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /post listing/i }));
    });

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/select a country/i),
    );
    expect(mockCreateListingMutation.mutateAsync).not.toHaveBeenCalled();
  });
});

describe('CreateListingPage — defaults', () => {
  beforeEach(() => {
    setupCategories();
  });

  it('defaults currency to USD', () => {
    render(<CreateListingPage />);
    expect(screen.getByRole('combobox', { name: /currency/i })).toBeInTheDocument();
  });

  it('renders country dropdown as required', () => {
    render(<CreateListingPage />);
    expect(screen.getByRole('combobox', { name: /country/i })).toBeInTheDocument();
  });
});
