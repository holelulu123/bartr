import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/listings',
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string; [k: string]: unknown }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />
  ),
}));

const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams();

const mockUseInfiniteListings = vi.fn();
const mockUseCategories = vi.fn();

vi.mock('@/hooks/use-listings', () => ({
  useInfiniteListings: (...args: unknown[]) => mockUseInfiniteListings(...args),
  useCategories: () => mockUseCategories(),
}));

// ── Helpers ────────────────────────────────────────────────────────────────

import type { ListingSummary, Category } from '@/lib/api';
import type { ReputationTier } from '@bartr/shared';

function makeListing(overrides: Partial<ListingSummary> = {}): ListingSummary {
  return {
    id: '1',
    title: 'Test Listing',
    price_indication: '100',
    currency: 'USD',
    payment_methods: ['btc'],
    country_code: 'US',
    condition: null,
    status: 'active',
    created_at: new Date(Date.now() - 60_000 * 5).toISOString(), // 5 min ago
    seller_nickname: 'alice',
    category_name: 'Electronics',
    category_slug: 'electronics',
    thumbnail: null,
    ...overrides,
  };
}

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 1,
    name: 'Electronics',
    slug: 'electronics',
    parent_id: null,
    ...overrides,
  };
}

function defaultInfiniteData(listings: ListingSummary[] = [makeListing()]) {
  return {
    pages: [
      {
        listings,
        pagination: { page: 1, limit: 20, total: listings.length, pages: 1 },
      },
    ],
    pageParams: [1],
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockSearchParams = new URLSearchParams();
});

// ── ReputationBadge ────────────────────────────────────────────────────────

import { ReputationBadge } from '@/components/reputation-badge';

describe('ReputationBadge', () => {
  const tiers: ReputationTier[] = ['new', 'verified', 'trusted', 'elite'];

  tiers.forEach((tier) => {
    it(`renders label for tier: ${tier}`, () => {
      render(<ReputationBadge tier={tier} />);
      const label = tier.charAt(0).toUpperCase() + tier.slice(1);
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it('accepts optional className', () => {
    render(<ReputationBadge tier="trusted" className="custom-class" />);
    const badge = screen.getByText('Trusted');
    expect(badge).toHaveClass('custom-class');
  });
});

// ── ListingCard ────────────────────────────────────────────────────────────

import { ListingCard, ListingCardSkeleton } from '@/components/listing-card';

describe('ListingCard', () => {
  it('renders listing title', () => {
    render(<ListingCard listing={makeListing()} />);
    expect(screen.getByText('Test Listing')).toBeInTheDocument();
  });

  it('renders price and currency with flag', () => {
    render(<ListingCard listing={makeListing()} />);
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText(/USD/)).toBeInTheDocument();
  });

  it('renders payment method badges', () => {
    render(<ListingCard listing={makeListing({ payment_methods: ['btc', 'usdt'] })} />);
    expect(screen.getByText('BTC')).toBeInTheDocument();
    expect(screen.getByText('USDT')).toBeInTheDocument();
  });

  it('caps payment badges at 3 and shows overflow count', () => {
    render(
      <ListingCard
        listing={makeListing({ payment_methods: ['btc', 'eth', 'usdt', 'sol', 'xrp'] })}
      />,
    );
    expect(screen.getByText('BTC')).toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('renders seller nickname', () => {
    render(<ListingCard listing={makeListing({ seller_nickname: 'satoshi' })} />);
    expect(screen.getByText('satoshi')).toBeInTheDocument();
  });

  it('renders category badge', () => {
    render(<ListingCard listing={makeListing({ category_name: 'Collectibles' })} />);
    expect(screen.getByText('Collectibles')).toBeInTheDocument();
  });

  it('renders "No image" placeholder when thumbnail is null', () => {
    render(<ListingCard listing={makeListing({ thumbnail: null })} />);
    expect(screen.getByText('No image')).toBeInTheDocument();
  });

  it('renders thumbnail image when provided', () => {
    render(<ListingCard listing={makeListing({ thumbnail: 'listings/abc/img.jpg' })} />);
    const img = screen.getByRole('img', { name: 'Test Listing' });
    expect(img).toHaveAttribute('src', expect.stringContaining('listings/abc/img.jpg'));
  });

  it('links to the listing detail page', () => {
    render(<ListingCard listing={makeListing({ id: 'abc-123' })} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/listings/abc-123');
  });

  it('renders time-ago for recent listing', () => {
    render(<ListingCard listing={makeListing()} />);
    expect(screen.getByText(/ago/i)).toBeInTheDocument();
  });

  it('renders skeleton', () => {
    render(<ListingCardSkeleton />);
    // Skeleton has animated pulse divs — just check it renders without crashing
    expect(document.querySelector('.animate-pulse')).toBeTruthy();
  });
});

// ── /listings browse page ──────────────────────────────────────────────────

import ListingsPage from '@/app/listings/page';

function setupMocks(overrides: {
  listings?: ListingSummary[];
  isLoading?: boolean;
  isError?: boolean;
  hasNextPage?: boolean;
  categories?: Category[];
} = {}) {
  const {
    listings = [makeListing()],
    isLoading = false,
    isError = false,
    hasNextPage = false,
    categories = [makeCategory()],
  } = overrides;

  mockUseInfiniteListings.mockReturnValue({
    data: isLoading ? undefined : defaultInfiniteData(listings),
    fetchNextPage: vi.fn(),
    hasNextPage,
    isFetchingNextPage: false,
    isLoading,
    isError,
  });

  mockUseCategories.mockReturnValue({
    data: { categories },
  });
}

describe('/listings browse page', () => {
  it('renders page heading', () => {
    setupMocks();
    render(<ListingsPage />);
    expect(screen.getByRole('heading', { name: /browse listings/i })).toBeInTheDocument();
  });

  it('renders listing cards', () => {
    setupMocks({ listings: [makeListing(), makeListing({ id: '2', title: 'Second Listing' })] });
    render(<ListingsPage />);
    expect(screen.getByText('Test Listing')).toBeInTheDocument();
    expect(screen.getByText('Second Listing')).toBeInTheDocument();
  });

  it('shows skeletons while loading', () => {
    setupMocks({ isLoading: true });
    render(<ListingsPage />);
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows error state when fetch fails', () => {
    setupMocks({ isError: true });
    render(<ListingsPage />);
    expect(screen.getByText(/failed to load listings/i)).toBeInTheDocument();
  });

  it('shows empty state with no filters', () => {
    setupMocks({ listings: [] });
    render(<ListingsPage />);
    expect(screen.getByText(/no listings found/i)).toBeInTheDocument();
    expect(screen.getByText(/be the first/i)).toBeInTheDocument();
  });

  it('shows empty state with active filters', () => {
    mockSearchParams = new URLSearchParams('q=bitcoin');
    setupMocks({ listings: [] });
    render(<ListingsPage />);
    expect(screen.getByText(/no listings found/i)).toBeInTheDocument();
    expect(screen.getByText(/adjusting your filters/i)).toBeInTheDocument();
  });

  it('renders search input', () => {
    setupMocks();
    render(<ListingsPage />);
    expect(screen.getByRole('textbox', { name: /search listings/i })).toBeInTheDocument();
  });

  it('renders category and crypto filter dropdowns', () => {
    setupMocks();
    render(<ListingsPage />);
    expect(screen.getByRole('combobox', { name: /category/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /crypto filter/i })).toBeInTheDocument();
  });

  it('shows active filter pills when URL has filters', () => {
    mockSearchParams = new URLSearchParams('q=laptop&category=electronics');
    setupMocks();
    render(<ListingsPage />);
    expect(screen.getByText(/search: laptop/i)).toBeInTheDocument();
    expect(screen.getByText(/category: electronics/i)).toBeInTheDocument();
  });

  it('shows Clear button when filters are active', () => {
    mockSearchParams = new URLSearchParams('q=laptop');
    setupMocks();
    render(<ListingsPage />);
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
  });

  it('does not show Clear button without filters', () => {
    setupMocks();
    render(<ListingsPage />);
    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();
  });

  it('shows Load more button when hasNextPage', () => {
    setupMocks({ hasNextPage: true });
    render(<ListingsPage />);
    expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument();
  });

  it('does not show Load more button on last page', () => {
    setupMocks({ hasNextPage: false });
    render(<ListingsPage />);
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });

  it('shows listing count', () => {
    setupMocks({ listings: [makeListing()] });
    render(<ListingsPage />);
    expect(screen.getByText(/1 listing/i)).toBeInTheDocument();
  });

  it('calls useInfiniteListings with q filter from URL', () => {
    mockSearchParams = new URLSearchParams('q=camera');
    setupMocks();
    render(<ListingsPage />);
    expect(mockUseInfiniteListings).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'camera' }),
    );
  });

  it('calls useInfiniteListings with payment_method filter from URL', () => {
    mockSearchParams = new URLSearchParams('payment=btc');
    setupMocks();
    render(<ListingsPage />);
    expect(mockUseInfiniteListings).toHaveBeenCalledWith(
      expect.objectContaining({ payment_method: 'btc' }),
    );
  });

  it('pushes router when Clear button clicked', async () => {
    mockSearchParams = new URLSearchParams('q=test');
    setupMocks();
    render(<ListingsPage />);
    await userEvent.click(screen.getByRole('button', { name: /clear/i }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/listings'));
  });
});
