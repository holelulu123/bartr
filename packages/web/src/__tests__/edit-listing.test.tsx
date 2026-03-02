import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
const mockReplace = vi.fn();
let mockParams: Record<string, string> = { id: 'listing-1' };

vi.mock('next/navigation', () => ({
  useParams: () => mockParams,
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => '/listings/listing-1/edit',
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

let mockUser: { id: string; nickname: string } | null = { id: 'u1', nickname: 'alice' };

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: mockUser }),
}));

const mockUseListing = vi.fn();
const mockUpdateMutation = { mutateAsync: vi.fn(), isPending: false };
const mockDeleteImageMutation = { mutateAsync: vi.fn(), isPending: false };
const mockUseCategories = vi.fn();

vi.mock('@/hooks/use-listings', () => ({
  useListing: (...args: unknown[]) => mockUseListing(...args),
  useUpdateListing: () => mockUpdateMutation,
  useDeleteListingImage: () => mockDeleteImageMutation,
  useCategories: () => mockUseCategories(),
}));

vi.mock('@/lib/api', () => ({
  listings: {
    uploadListingImage: vi.fn().mockResolvedValue({ id: 'img-new', storage_key: 'new/key' }),
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────────

import type { ListingDetail } from '@/lib/api';
import EditListingPage from '@/app/listings/[id]/edit/page';

function makeListing(overrides: Partial<ListingDetail> = {}): ListingDetail {
  return {
    id: 'listing-1',
    user_id: 'u1',
    title: 'Original Title',
    description: 'Original description that is long enough.',
    category_id: 1,
    payment_methods: ['btc', 'eth'],
    price_indication: '50',
    currency: 'USD',
    country_code: 'US',
    condition: null,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    seller_nickname: 'alice',
    category_name: 'Electronics',
    category_slug: 'electronics',
    images: [],
    ...overrides,
  };
}

function setupListing(listing: ListingDetail | null, options: { isLoading?: boolean; isError?: boolean } = {}) {
  mockUseListing.mockReturnValue({
    data: listing,
    isLoading: options.isLoading ?? false,
    isError: options.isError ?? false,
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockUser = { id: 'u1', nickname: 'alice' };
  mockParams = { id: 'listing-1' };
});

beforeEach(() => {
  mockUseCategories.mockReturnValue({
    data: { categories: [{ id: 1, name: 'Electronics', slug: 'electronics', parent_id: null }] },
  });
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('EditListingPage — loading / error states', () => {
  it('shows loading skeleton', () => {
    setupListing(null, { isLoading: true });
    render(<EditListingPage />);
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  it('shows not found on error', () => {
    setupListing(null, { isError: true });
    render(<EditListingPage />);
    expect(screen.getByText(/listing not found/i)).toBeInTheDocument();
  });
});

describe('EditListingPage — pre-fill', () => {
  beforeEach(() => setupListing(makeListing()));

  it('renders page heading', () => {
    render(<EditListingPage />);
    expect(screen.getByRole('heading', { name: /edit listing/i })).toBeInTheDocument();
  });

  it('pre-fills title input', async () => {
    render(<EditListingPage />);
    await waitFor(() =>
      expect(screen.getByLabelText(/^title$/i)).toHaveValue('Original Title'),
    );
  });

  it('pre-fills description textarea', async () => {
    render(<EditListingPage />);
    await waitFor(() =>
      expect(screen.getByLabelText(/^description$/i)).toHaveValue(
        'Original description that is long enough.',
      ),
    );
  });

  it('pre-fills price', async () => {
    render(<EditListingPage />);
    await waitFor(() =>
      expect(screen.getByLabelText(/price/i)).toHaveValue(50),
    );
  });

  it('renders currency dropdown', () => {
    render(<EditListingPage />);
    expect(screen.getByRole('combobox', { name: /currency/i })).toBeInTheDocument();
  });

  it('pre-selects crypto methods and enables checkbox', async () => {
    render(<EditListingPage />);
    await waitFor(() => {
      expect(screen.getByLabelText(/also accept cryptocurrency/i)).toBeChecked();
      expect(screen.getByRole('button', { name: /Bitcoin/i })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: /Ethereum/i })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: /USDT/i })).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('renders back to listing link', () => {
    render(<EditListingPage />);
    const link = screen.getByRole('link', { name: /back to listing/i });
    expect(link).toHaveAttribute('href', '/listings/listing-1');
  });

  it('renders Save changes button', () => {
    render(<EditListingPage />);
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });

  it('renders Cancel link to listing detail', () => {
    render(<EditListingPage />);
    const cancel = screen.getByRole('link', { name: /cancel/i });
    expect(cancel).toHaveAttribute('href', '/listings/listing-1');
  });
});

describe('EditListingPage — owner guard', () => {
  it('redirects non-owner to listing detail', async () => {
    mockUser = { id: 'u2', nickname: 'bob' };
    setupListing(makeListing({ seller_nickname: 'alice' }));
    render(<EditListingPage />);
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('/listings/listing-1'),
    );
  });

  it('does not redirect owner', () => {
    mockUser = { id: 'u1', nickname: 'alice' };
    setupListing(makeListing({ seller_nickname: 'alice' }));
    render(<EditListingPage />);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe('EditListingPage — status dropdown', () => {
  it('renders status dropdown', () => {
    setupListing(makeListing());
    render(<EditListingPage />);
    expect(screen.getByRole('combobox', { name: /status/i })).toBeInTheDocument();
  });
});

describe('EditListingPage — image management', () => {
  it('shows existing images', () => {
    setupListing(
      makeListing({
        images: [{ id: 'img-1', storage_key: 'key/img1.jpg', order_index: 0 }],
      }),
    );
    render(<EditListingPage />);
    const img = screen.getByRole('img', { name: 'Listing image' });
    expect(img).toHaveAttribute('src', '/api/images/key/img1.jpg');
  });

  it('shows remove button for each existing image', () => {
    setupListing(
      makeListing({
        images: [
          { id: 'img-1', storage_key: 'k1', order_index: 0 },
          { id: 'img-2', storage_key: 'k2', order_index: 1 },
        ],
      }),
    );
    render(<EditListingPage />);
    expect(screen.getAllByRole('button', { name: /remove existing image/i })).toHaveLength(2);
  });

  it('calls deleteImage mutation when remove clicked', async () => {
    mockDeleteImageMutation.mutateAsync.mockResolvedValue(undefined);
    setupListing(
      makeListing({
        images: [{ id: 'img-1', storage_key: 'k1', order_index: 0 }],
      }),
    );
    render(<EditListingPage />);
    await userEvent.click(screen.getByRole('button', { name: /remove existing image/i }));
    await waitFor(() =>
      expect(mockDeleteImageMutation.mutateAsync).toHaveBeenCalledWith('img-1'),
    );
  });

  it('shows upload zone when under image limit', () => {
    setupListing(makeListing({ images: [] }));
    render(<EditListingPage />);
    expect(screen.getByLabelText(/upload images/i)).toBeInTheDocument();
  });

  it('hides upload zone when at image limit', () => {
    setupListing(
      makeListing({
        images: Array.from({ length: 5 }, (_, i) => ({
          id: `img-${i}`,
          storage_key: `k${i}`,
          order_index: i,
        })),
      }),
    );
    render(<EditListingPage />);
    expect(screen.queryByLabelText(/upload images/i)).not.toBeInTheDocument();
  });
});

describe('EditListingPage — validation', () => {
  beforeEach(() => setupListing(makeListing()));

  it('shows error for short title', async () => {
    render(<EditListingPage />);
    const titleInput = await screen.findByLabelText(/^title$/i);
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'ab');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() =>
      expect(screen.getByText(/at least 3 characters/i)).toBeInTheDocument(),
    );
  });

  it('shows error when crypto toggled on but none selected', async () => {
    render(<EditListingPage />);
    // Wait for pre-fill, then deselect all crypto
    await waitFor(() => screen.getByRole('button', { name: /Bitcoin/i }));
    await userEvent.click(screen.getByRole('button', { name: /Bitcoin/i }));
    await userEvent.click(screen.getByRole('button', { name: /Ethereum/i }));
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    });
    await waitFor(() =>
      expect(screen.getByText(/at least one cryptocurrency/i)).toBeInTheDocument(),
    );
  });
});

describe('EditListingPage — successful submit', () => {
  beforeEach(() => {
    setupListing(makeListing());
    mockUpdateMutation.mutateAsync.mockResolvedValue(makeListing({ title: 'Updated Title' }));
  });

  it('calls updateListing with correct payload including price, currency, and country', async () => {
    render(<EditListingPage />);
    const titleInput = await screen.findByLabelText(/^title$/i);
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Updated Title Here');

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    });

    await waitFor(() =>
      expect(mockUpdateMutation.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Updated Title Here',
          payment_methods: ['btc', 'eth'],
          price_indication: '50',
          currency: 'USD',
          country_code: 'US',
        }),
      ),
    );
  });

  it('navigates to listing detail on success', async () => {
    render(<EditListingPage />);
    await screen.findByLabelText(/^title$/i);

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    });

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/listings/listing-1'));
  });

  it('includes status and country in update payload', async () => {
    render(<EditListingPage />);
    await screen.findByLabelText(/^title$/i);

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    });

    await waitFor(() =>
      expect(mockUpdateMutation.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active', country_code: 'US' }),
      ),
    );
  });
});
