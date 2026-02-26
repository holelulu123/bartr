import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/dashboard/listings',
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: { id: 'user-1', nickname: 'alice' } }),
}));

const mockUseListings = vi.fn();
const mockDeleteMutation = { mutateAsync: vi.fn(), isPending: false };
const mockUpdateMutation = { mutateAsync: vi.fn(), isPending: false };

vi.mock('@/hooks/use-listings', () => ({
  useListings: (...args: unknown[]) => mockUseListings(...args),
  useDeleteListing: () => mockDeleteMutation,
  useUpdateListing: () => mockUpdateMutation,
}));

// ── Helpers ────────────────────────────────────────────────────────────────

import type { ListingSummary } from '@/lib/api';
import MyListingsDashboard from '@/app/dashboard/listings/page';

function makeListing(overrides: Partial<ListingSummary> = {}): ListingSummary {
  return {
    id: '1',
    title: 'Test Listing',
    price_indication: '100',
    currency: 'USD',
    payment_methods: ['btc'],
    status: 'active',
    created_at: new Date().toISOString(),
    seller_nickname: 'alice',
    category_name: null,
    category_slug: null,
    thumbnail: null,
    ...overrides,
  };
}

function setupListings(listings: ListingSummary[], isLoading = false) {
  mockUseListings.mockReturnValue({
    data: { listings, pagination: { page: 1, limit: 50, total: listings.length, pages: 1 } },
    isLoading,
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('MyListingsDashboard — rendering', () => {
  it('renders page heading', () => {
    setupListings([]);
    render(<MyListingsDashboard />);
    expect(screen.getByRole('heading', { name: /my listings/i })).toBeInTheDocument();
  });

  it('renders New listing button', () => {
    setupListings([]);
    render(<MyListingsDashboard />);
    const link = screen.getByRole('link', { name: /new listing/i });
    expect(link).toHaveAttribute('href', '/listings/new');
  });

  it('renders status filter tabs', () => {
    setupListings([]);
    render(<MyListingsDashboard />);
    expect(screen.getByRole('tab', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Active' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Paused' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Sold' })).toBeInTheDocument();
  });

  it('shows listing count', () => {
    setupListings([makeListing(), makeListing({ id: '2', title: 'Second' })]);
    render(<MyListingsDashboard />);
    expect(screen.getByText(/2 listings/i)).toBeInTheDocument();
  });

  it('shows loading skeletons while loading', () => {
    setupListings([], true);
    render(<MyListingsDashboard />);
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });
});

describe('MyListingsDashboard — listing rows', () => {
  beforeEach(() => {
    setupListings([
      makeListing({ id: '1', title: 'Camera', status: 'active' }),
      makeListing({ id: '2', title: 'Laptop', status: 'paused' }),
      makeListing({ id: '3', title: 'Phone', status: 'sold' }),
    ]);
  });

  it('renders all listing titles', () => {
    render(<MyListingsDashboard />);
    expect(screen.getByText('Camera')).toBeInTheDocument();
    expect(screen.getByText('Laptop')).toBeInTheDocument();
    expect(screen.getByText('Phone')).toBeInTheDocument();
  });

  it('renders listing status badges', () => {
    render(<MyListingsDashboard />);
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('paused')).toBeInTheDocument();
    expect(screen.getByText('sold')).toBeInTheDocument();
  });

  it('renders Edit link for each listing', () => {
    render(<MyListingsDashboard />);
    const editLinks = screen.getAllByRole('link', { name: /edit/i });
    expect(editLinks.find(l => l.getAttribute('href') === '/listings/1/edit')).toBeDefined();
    expect(editLinks.find(l => l.getAttribute('href') === '/listings/2/edit')).toBeDefined();
  });

  it('renders Delete button for each listing', () => {
    render(<MyListingsDashboard />);
    expect(screen.getAllByRole('button', { name: /delete/i })).toHaveLength(3);
  });

  it('renders Mark sold button for non-sold listings', () => {
    render(<MyListingsDashboard />);
    // Camera (active) and Laptop (paused) get Mark sold, Phone (sold) does not
    expect(screen.getAllByRole('button', { name: /mark.*sold/i })).toHaveLength(2);
  });

  it('does not render Mark sold button for already sold listing', () => {
    setupListings([makeListing({ status: 'sold', title: 'Phone' })]);
    render(<MyListingsDashboard />);
    expect(screen.queryByRole('button', { name: /mark.*sold/i })).not.toBeInTheDocument();
  });

  it('renders price and currency in row', () => {
    setupListings([makeListing({ price_indication: '0.005', currency: 'BTC' })]);
    render(<MyListingsDashboard />);
    expect(screen.getByText(/0.005 BTC/)).toBeInTheDocument();
  });

  it('links listing title to detail page', () => {
    setupListings([makeListing({ id: 'abc', title: 'Camera' })]);
    render(<MyListingsDashboard />);
    const link = screen.getByRole('link', { name: 'Camera' });
    expect(link).toHaveAttribute('href', '/listings/abc');
  });
});

describe('MyListingsDashboard — status filter', () => {
  it('All tab is selected by default', () => {
    setupListings([]);
    render(<MyListingsDashboard />);
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');
  });

  it('clicking a tab passes status filter to useListings', async () => {
    setupListings([]);
    render(<MyListingsDashboard />);
    await userEvent.click(screen.getByRole('tab', { name: 'Active' }));
    expect(mockUseListings).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active' }),
    );
  });

  it('clicking All tab removes status filter', async () => {
    setupListings([]);
    render(<MyListingsDashboard />);
    await userEvent.click(screen.getByRole('tab', { name: 'Paused' }));
    await userEvent.click(screen.getByRole('tab', { name: 'All' }));
    const lastCall = mockUseListings.mock.calls[mockUseListings.mock.calls.length - 1][0];
    expect(lastCall.status).toBeUndefined();
  });

  it('passes user_id to useListings', () => {
    setupListings([]);
    render(<MyListingsDashboard />);
    expect(mockUseListings).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1' }),
    );
  });
});

describe('MyListingsDashboard — empty states', () => {
  it('shows empty state with no listings (all filter)', () => {
    setupListings([]);
    render(<MyListingsDashboard />);
    expect(screen.getByText(/no listings found/i)).toBeInTheDocument();
    expect(screen.getByText(/post your first listing/i)).toBeInTheDocument();
  });

  it('shows filtered empty state with active filter', async () => {
    setupListings([]);
    render(<MyListingsDashboard />);
    await userEvent.click(screen.getByRole('tab', { name: 'Paused' }));
    expect(screen.getByText(/no listings found/i)).toBeInTheDocument();
    expect(screen.getByText(/no paused listings/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view all/i })).toBeInTheDocument();
  });

  it('View all button resets filter to all', async () => {
    setupListings([]);
    render(<MyListingsDashboard />);
    await userEvent.click(screen.getByRole('tab', { name: 'Paused' }));
    await userEvent.click(screen.getByRole('button', { name: /view all/i }));
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('MyListingsDashboard — delete flow', () => {
  beforeEach(() => {
    setupListings([makeListing({ id: '1', title: 'Camera' })]);
  });

  it('opens delete dialog when Delete clicked', async () => {
    render(<MyListingsDashboard />);
    await userEvent.click(screen.getByRole('button', { name: /delete camera/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(screen.getByText(/permanently delete.*camera/i)).toBeInTheDocument();
  });

  it('closes dialog on Cancel', async () => {
    render(<MyListingsDashboard />);
    await userEvent.click(screen.getByRole('button', { name: /delete camera/i }));
    await waitFor(() => screen.getByRole('dialog'));
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('calls deleteMutation and closes dialog on confirm', async () => {
    mockDeleteMutation.mutateAsync.mockResolvedValue(undefined);
    render(<MyListingsDashboard />);
    await userEvent.click(screen.getByRole('button', { name: /delete camera/i }));
    await waitFor(() => screen.getByRole('dialog'));
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(mockDeleteMutation.mutateAsync).toHaveBeenCalledWith('1'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('MyListingsDashboard — mark sold', () => {
  it('calls updateListing with status sold', async () => {
    setupListings([makeListing({ id: '1', title: 'Camera', status: 'active' })]);
    mockUpdateMutation.mutateAsync.mockResolvedValue(undefined);
    render(<MyListingsDashboard />);
    await userEvent.click(screen.getByRole('button', { name: /mark camera as sold/i }));
    await waitFor(() =>
      expect(mockUpdateMutation.mutateAsync).toHaveBeenCalledWith({ status: 'sold' }),
    );
  });
});
