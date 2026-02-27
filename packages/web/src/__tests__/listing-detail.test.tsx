import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
let mockParams: Record<string, string> = { id: 'listing-1' };

vi.mock('next/navigation', () => ({
  useParams: () => mockParams,
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/listings/listing-1',
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

let mockUser: { id: string; nickname: string } | null = null;

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: mockUser }),
}));

const mockUseListing = vi.fn();
const mockDeleteMutation = { mutateAsync: vi.fn(), isPending: false };
const mockUseDeleteListing = vi.fn(() => mockDeleteMutation);

vi.mock('@/hooks/use-listings', () => ({
  useListing: (...args: unknown[]) => mockUseListing(...args),
  useDeleteListing: () => mockUseDeleteListing(),
}));

const mockCreateThreadMutation = { mutateAsync: vi.fn(), isPending: false };
vi.mock('@/hooks/use-messages', () => ({
  useCreateThread: () => mockCreateThreadMutation,
}));

const mockSubmitFlagMutation = { mutateAsync: vi.fn(), isPending: false };
vi.mock('@/hooks/use-moderation', () => ({
  useSubmitFlag: () => mockSubmitFlagMutation,
}));

// ── Helpers ────────────────────────────────────────────────────────────────

import type { ListingDetail } from '@/lib/api';
import ListingDetailPage from '@/app/listings/[id]/page';

function makeListing(overrides: Partial<ListingDetail> = {}): ListingDetail {
  return {
    id: 'listing-1',
    user_id: 'user-1',
    title: 'Vintage Camera',
    description: 'A beautiful vintage film camera in excellent condition.',
    category_id: 1,
    payment_methods: ['btc', 'cash'],
    price_indication: '200',
    currency: 'USD',
    status: 'active',
    created_at: new Date(Date.now() - 60_000 * 30).toISOString(),
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
  mockUser = null;
  mockParams = { id: 'listing-1' };
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ListingDetailPage — loading state', () => {
  it('shows loading skeleton', () => {
    setupListing(null, { isLoading: true });
    render(<ListingDetailPage />);
    expect(screen.getByLabelText(/loading listing/i)).toBeInTheDocument();
  });
});

describe('ListingDetailPage — error / not found', () => {
  it('shows not found message on error', () => {
    setupListing(null, { isError: true });
    render(<ListingDetailPage />);
    expect(screen.getByText(/listing not found/i)).toBeInTheDocument();
  });

  it('shows browse listings link when not found', () => {
    setupListing(null, { isError: true });
    render(<ListingDetailPage />);
    const link = screen.getByRole('link', { name: /browse listings/i });
    expect(link).toHaveAttribute('href', '/listings');
  });
});

describe('ListingDetailPage — content', () => {
  beforeEach(() => {
    setupListing(makeListing());
  });

  it('renders listing title', () => {
    render(<ListingDetailPage />);
    expect(screen.getByRole('heading', { name: 'Vintage Camera' })).toBeInTheDocument();
  });

  it('renders price and currency', () => {
    render(<ListingDetailPage />);
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('USD')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<ListingDetailPage />);
    expect(screen.getByText(/beautiful vintage film camera/i)).toBeInTheDocument();
  });

  it('renders payment method badges', () => {
    render(<ListingDetailPage />);
    expect(screen.getByText('BTC')).toBeInTheDocument();
    expect(screen.getByText('Cash')).toBeInTheDocument();
  });

  it('renders category badge', () => {
    render(<ListingDetailPage />);
    expect(screen.getByText('Electronics')).toBeInTheDocument();
  });

  it('renders seller nickname with link', () => {
    render(<ListingDetailPage />);
    const sellerLink = screen.getByRole('link', { name: 'alice' });
    expect(sellerLink).toHaveAttribute('href', '/user/alice');
  });

  it('renders back to listings link', () => {
    render(<ListingDetailPage />);
    const backLink = screen.getByRole('link', { name: /back to listings/i });
    expect(backLink).toHaveAttribute('href', '/listings');
  });

  it('renders "No image" placeholder when no images', () => {
    render(<ListingDetailPage />);
    expect(screen.getByText('No images')).toBeInTheDocument();
  });

  it('renders image gallery when images are present', () => {
    setupListing(
      makeListing({
        images: [
          { id: 'img-1', storage_key: 'key/img1.jpg', order_index: 0 },
        ],
      }),
    );
    render(<ListingDetailPage />);
    const img = screen.getByRole('img', { name: 'Vintage Camera' });
    expect(img).toHaveAttribute('src', '/api/images/key/img1.jpg');
  });

  it('renders thumbnail buttons when multiple images', () => {
    setupListing(
      makeListing({
        images: [
          { id: 'img-1', storage_key: 'key/img1.jpg', order_index: 0 },
          { id: 'img-2', storage_key: 'key/img2.jpg', order_index: 1 },
        ],
      }),
    );
    render(<ListingDetailPage />);
    expect(screen.getByLabelText('Image 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Image 2')).toBeInTheDocument();
  });

  it('shows time-ago', () => {
    render(<ListingDetailPage />);
    expect(screen.getByText(/posted.*ago/i)).toBeInTheDocument();
  });
});

describe('ListingDetailPage — visitor actions', () => {
  beforeEach(() => {
    setupListing(makeListing());
    mockUser = null; // not logged in, still shows actions
  });

  it('shows Make Offer button for visitors', () => {
    render(<ListingDetailPage />);
    expect(screen.getByRole('button', { name: /make offer/i })).toBeInTheDocument();
  });

  it('shows Message Seller button for visitors', () => {
    render(<ListingDetailPage />);
    expect(screen.getByRole('button', { name: /message seller/i })).toBeInTheDocument();
  });

  it('does not show Edit or Delete buttons for visitors', () => {
    render(<ListingDetailPage />);
    expect(screen.queryByRole('link', { name: /edit listing/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete listing/i })).not.toBeInTheDocument();
  });

  it('Make Offer opens chat thread and navigates to messages page', async () => {
    mockCreateThreadMutation.mutateAsync.mockResolvedValue({ id: 'thread-1', listing_id: 'listing-1', created_at: '', participant_1_nickname: 'alice', participant_2_nickname: 'bob', listing_title: null, last_message_at: null });
    render(<ListingDetailPage />);
    await userEvent.click(screen.getByRole('button', { name: /make offer/i }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/messages/thread-1'));
  });

  it('Message Seller creates thread and navigates to messages page', async () => {
    mockCreateThreadMutation.mutateAsync.mockResolvedValue({ id: 'thread-1', listing_id: 'listing-1', created_at: '', participant_1_nickname: 'alice', participant_2_nickname: 'bob', listing_title: null, last_message_at: null });
    render(<ListingDetailPage />);
    await userEvent.click(screen.getByRole('button', { name: /message seller/i }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/messages/thread-1'));
  });
});

describe('ListingDetailPage — owner actions', () => {
  beforeEach(() => {
    mockUser = { id: 'user-1', nickname: 'alice' };
    setupListing(makeListing({ seller_nickname: 'alice' }));
  });

  it('shows Edit button for owner', () => {
    render(<ListingDetailPage />);
    expect(screen.getByRole('link', { name: /edit listing/i })).toHaveAttribute(
      'href',
      '/listings/listing-1/edit',
    );
  });

  it('shows Delete button for owner', () => {
    render(<ListingDetailPage />);
    expect(screen.getByRole('button', { name: /delete listing/i })).toBeInTheDocument();
  });

  it('does not show Make Offer or Message Seller for owner', () => {
    render(<ListingDetailPage />);
    expect(screen.queryByRole('button', { name: /make offer/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /message seller/i })).not.toBeInTheDocument();
  });

  it('opens delete dialog when Delete button clicked', async () => {
    render(<ListingDetailPage />);
    await userEvent.click(screen.getByRole('button', { name: /delete listing/i }));
    await waitFor(() =>
      expect(screen.getByRole('dialog')).toBeInTheDocument(),
    );
    expect(screen.getByText(/permanently delete/i)).toBeInTheDocument();
  });

  it('closes dialog on Cancel click', async () => {
    render(<ListingDetailPage />);
    await userEvent.click(screen.getByRole('button', { name: /delete listing/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });

  it('calls deleteMutation and navigates to /listings on confirm', async () => {
    mockDeleteMutation.mutateAsync.mockResolvedValue(undefined);
    render(<ListingDetailPage />);
    await userEvent.click(screen.getByRole('button', { name: /delete listing/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(mockDeleteMutation.mutateAsync).toHaveBeenCalledWith('listing-1'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/listings'));
  });
});

describe('ListingDetailPage — report listing', () => {
  beforeEach(() => {
    setupListing(makeListing({ seller_nickname: 'alice' }));
    mockUser = { id: 'user-2', nickname: 'bob' }; // non-owner
  });

  it('shows Report listing button for non-owners', () => {
    render(<ListingDetailPage />);
    expect(screen.getByTestId('report-button')).toBeInTheDocument();
  });

  it('does not show Report button for owners', () => {
    mockUser = { id: 'user-1', nickname: 'alice' };
    setupListing(makeListing({ seller_nickname: 'alice' }));
    render(<ListingDetailPage />);
    expect(screen.queryByTestId('report-button')).not.toBeInTheDocument();
  });

  it('opens report dialog on click', async () => {
    const user = userEvent.setup();
    render(<ListingDetailPage />);
    await user.click(screen.getByTestId('report-button'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('report-reason-input')).toBeInTheDocument();
  });

  it('submit is disabled when reason is too short', async () => {
    const user = userEvent.setup();
    render(<ListingDetailPage />);
    await user.click(screen.getByTestId('report-button'));
    await waitFor(() => expect(screen.getByTestId('report-reason-input')).toBeInTheDocument());
    await user.type(screen.getByTestId('report-reason-input'), 'hi');
    expect(screen.getByTestId('report-submit')).toBeDisabled();
  });

  it('submit is enabled when reason is 5+ chars', async () => {
    const user = userEvent.setup();
    render(<ListingDetailPage />);
    await user.click(screen.getByTestId('report-button'));
    await waitFor(() => expect(screen.getByTestId('report-reason-input')).toBeInTheDocument());
    await user.type(screen.getByTestId('report-reason-input'), 'This is a scam listing');
    expect(screen.getByTestId('report-submit')).not.toBeDisabled();
  });

  it('submits flag and shows success message', async () => {
    mockSubmitFlagMutation.mutateAsync.mockResolvedValue({});
    const user = userEvent.setup();
    render(<ListingDetailPage />);
    await user.click(screen.getByTestId('report-button'));
    await waitFor(() => expect(screen.getByTestId('report-reason-input')).toBeInTheDocument());
    await user.type(screen.getByTestId('report-reason-input'), 'This is a scam listing');
    await user.click(screen.getByTestId('report-submit'));
    await waitFor(() => expect(screen.getByTestId('report-success')).toBeInTheDocument());
  });

  it('calls submitFlag with correct payload', async () => {
    mockSubmitFlagMutation.mutateAsync.mockResolvedValue({});
    const user = userEvent.setup();
    render(<ListingDetailPage />);
    await user.click(screen.getByTestId('report-button'));
    await waitFor(() => expect(screen.getByTestId('report-reason-input')).toBeInTheDocument());
    await user.type(screen.getByTestId('report-reason-input'), 'Selling stolen goods');
    await user.click(screen.getByTestId('report-submit'));
    await waitFor(() =>
      expect(mockSubmitFlagMutation.mutateAsync).toHaveBeenCalledWith({
        target_type: 'listing',
        target_id: 'listing-1',
        reason: 'Selling stolen goods',
      }),
    );
  });
});

describe('ListingDetailPage — non-active listing', () => {
  it('shows status badge when listing is not active', () => {
    setupListing(makeListing({ status: 'sold' }));
    render(<ListingDetailPage />);
    expect(screen.getByText('sold')).toBeInTheDocument();
  });

  it('Make Offer button is disabled for non-active listing', () => {
    mockUser = null;
    setupListing(makeListing({ status: 'sold', seller_nickname: 'bob' }));
    render(<ListingDetailPage />);
    const btn = screen.getByRole('button', { name: /make offer/i });
    expect(btn).toBeDisabled();
  });
});
