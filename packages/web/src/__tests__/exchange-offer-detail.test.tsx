import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
let mockParams: Record<string, string> = { id: 'offer-1' };

vi.mock('next/navigation', () => ({
  useParams: () => mockParams,
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/exchange/offer-1',
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

let mockUser: { id: string; nickname: string } | null = null;
let mockIsAuthenticated = false;

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: mockUser, isAuthenticated: mockIsAuthenticated }),
}));

let mockIsUnlocked = false;

vi.mock('@/contexts/crypto-context', () => ({
  useCrypto: () => ({ isUnlocked: mockIsUnlocked, encrypt: vi.fn(), decrypt: vi.fn() }),
}));

const mockUseOffer = vi.fn();
const mockUpdateMutation = { mutateAsync: vi.fn(), isPending: false };
const mockDeleteMutation = { mutateAsync: vi.fn(), isPending: false };
const mockCreateOfferMutation = { mutateAsync: vi.fn(), isPending: false };
vi.mock('@/hooks/use-exchange', () => ({
  useOffer: (...args: unknown[]) => mockUseOffer(...args),
  useUpdateOffer: () => mockUpdateMutation,
  useDeleteOffer: () => mockDeleteMutation,
  useCreateOffer: () => mockCreateOfferMutation,
}));

const mockUseUser = vi.fn().mockReturnValue({ data: null });
vi.mock('@/hooks/use-users', () => ({
  useUser: (...args: unknown[]) => mockUseUser(...args),
}));

vi.mock('@/hooks/use-prices', () => ({
  usePrices: () => ({ data: null }),
}));

const mockCreateTradeMutation = { mutateAsync: vi.fn(), isPending: false };
const mockTradesForOffer = { data: null, refetch: vi.fn() };
const mockAcceptTradeMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };
const mockDeclineTradeMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };
const mockRateTradeMutation = { mutateAsync: vi.fn(), isPending: false, isError: false, error: null };

vi.mock('@/hooks/use-trades', () => ({
  useCreateExchangeTrade: () => mockCreateTradeMutation,
  useTradesForOffer: () => mockTradesForOffer,
  useAcceptTrade: () => mockAcceptTradeMutation,
  useDeclineTrade: () => mockDeclineTradeMutation,
  useCompleteTrade: () => ({ mutate: vi.fn(), isPending: false }),
  useTradeCompletions: () => ({ data: null, isLoading: false }),
  useRateTrade: () => mockRateTradeMutation,
  useCheckPairRating: () => ({ data: { rated: false }, isLoading: false }),
}));

const mockCreateThreadMutation = { mutateAsync: vi.fn().mockResolvedValue({ id: 'thread-1' }), isPending: false };
vi.mock('@/hooks/use-messages', () => ({
  useCreateThread: () => mockCreateThreadMutation,
  useMessages: () => ({ data: null, isLoading: false, isError: false }),
  useSendMessage: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('@/contexts/message-sidebar-context', () => ({
  useMessageSidebar: () => ({
    isOpen: false,
    selectedThreadId: null,
    pendingContact: null,
    openSidebar: vi.fn(),
    closeSidebar: vi.fn(),
    openThread: vi.fn(),
    openContact: vi.fn(),
    clearSelection: vi.fn(),
  }),
}));

vi.mock('@/components/crypto-icons', () => ({
  CoinIcon: () => <span>CoinIcon</span>,
}));

// Mock Radix Select (jsdom doesn't support pointer capture)
let selectOnValueChange: ((v: string) => void) | null = null;
vi.mock('@/components/ui/select', () => ({
  Select: ({ onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: React.ReactNode }) => {
    selectOnValueChange = onValueChange;
    return <div data-testid="select-root">{children}</div>;
  },
  SelectTrigger: ({ children, ...props }: { children: React.ReactNode; id?: string }) => (
    <button role="combobox" {...props}>{children}</button>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span>{placeholder}</span>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <button data-testid={`select-item-${value}`} onClick={() => selectOnValueChange?.(value)}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/reputation-badge', () => ({
  ReputationBadge: () => <span>ReputationBadge</span>,
}));

vi.mock('@/components/half-star-picker', () => ({
  HalfStarPicker: ({ value, readOnly }: { value: number; readOnly?: boolean }) => (
    <div data-testid="half-star-picker" data-value={value} data-readonly={readOnly}>
      Stars: {value}
    </div>
  ),
}));

vi.mock('@/lib/countries', () => ({
  getCountryFlag: (code: string) => code,
  getCountryName: (code: string) => code,
}));

// ── Helpers ────────────────────────────────────────────────────────────────

import type { ExchangeOffer, TradeSummary } from '@/lib/api';
import OfferDetailPage from '@/app/exchange/[id]/page';

function makeOffer(overrides: Partial<ExchangeOffer> = {}): ExchangeOffer {
  return {
    id: 'offer-1',
    user_id: 'seller-1',
    offer_type: 'sell',
    crypto_currency: 'BTC',
    fiat_currency: 'USD',
    amount: null,
    min_amount: 100,
    max_amount: 5000,
    rate_type: 'market',
    margin_percent: 2,
    fixed_price: null,
    payment_methods: ['bank_transfer', 'cash_in_person'],
    country_code: 'US',
    city: 'Miami',
    terms: 'Quick trade',
    price_source: 'coingecko',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    seller_nickname: 'seller_nick',
    seller_rating_avg: 4.5,
    seller_tier: 'verified',
    seller_trade_count: 10,
    ...overrides,
  };
}

function makeTrade(overrides: Partial<TradeSummary> = {}): TradeSummary {
  return {
    id: 'trade-1',
    listing_id: null,
    offer_id: 'offer-1',
    buyer_id: 'buyer-1',
    seller_id: 'seller-1',
    status: 'offered',
    fiat_amount: 500,
    payment_method: 'bank_transfer',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    listing_title: null,
    offer_summary: 'sell BTC/USD',
    buyer_nickname: 'buyer_nick',
    seller_nickname: 'seller_nick',
    ...overrides,
  };
}

function setupOffer(offer: ExchangeOffer | null, options: { isLoading?: boolean; isError?: boolean } = {}) {
  mockUseOffer.mockReturnValue({
    data: offer,
    isLoading: options.isLoading ?? false,
    isError: options.isError ?? false,
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockUser = null;
  mockIsAuthenticated = false;
  mockIsUnlocked = false;
  mockParams = { id: 'offer-1' };
  mockTradesForOffer.data = null;
  mockUseUser.mockReturnValue({ data: null });
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('OfferDetailPage — loading/error states', () => {
  it('shows loading skeleton', () => {
    setupOffer(null, { isLoading: true });
    render(<OfferDetailPage />);
    expect(screen.getByLabelText(/loading/i)).toBeInTheDocument();
  });

  it('shows not found on error', () => {
    setupOffer(null, { isError: true });
    render(<OfferDetailPage />);
    expect(screen.getByText(/offer not found/i)).toBeInTheDocument();
  });
});

describe('OfferDetailPage — offer content', () => {
  beforeEach(() => {
    setupOffer(makeOffer());
  });

  it('renders crypto pair heading', () => {
    render(<OfferDetailPage />);
    expect(screen.getByRole('heading', { name: 'BTC/USD' })).toBeInTheDocument();
  });

  it('renders seller nickname', () => {
    render(<OfferDetailPage />);
    expect(screen.getByText('seller_nick')).toBeInTheDocument();
  });

  it('renders settlement methods', () => {
    render(<OfferDetailPage />);
    expect(screen.getByText(/bank transfer/i)).toBeInTheDocument();
  });

  it('renders back to exchange link', () => {
    render(<OfferDetailPage />);
    const link = screen.getByRole('link', { name: /back to exchange/i });
    expect(link).toHaveAttribute('href', '/exchange');
  });

  it('renders trade terms', () => {
    render(<OfferDetailPage />);
    expect(screen.getByText('Quick trade')).toBeInTheDocument();
  });
});

describe('OfferDetailPage — non-authenticated visitor', () => {
  beforeEach(() => {
    setupOffer(makeOffer());
    mockUser = null;
    mockIsAuthenticated = false;
  });

  it('shows "Log in to make an offer" prompt', () => {
    render(<OfferDetailPage />);
    expect(screen.getByText(/log in to make an offer/i)).toBeInTheDocument();
  });

  it('does not show Make Offer form', () => {
    render(<OfferDetailPage />);
    expect(screen.queryByText(/^make an offer$/i)).not.toBeInTheDocument();
  });
});

describe('OfferDetailPage — authenticated buyer, keys not unlocked', () => {
  beforeEach(() => {
    setupOffer(makeOffer());
    mockUser = { id: 'buyer-1', nickname: 'buyer_nick' };
    mockIsAuthenticated = true;
    mockIsUnlocked = false;
  });

  it('shows "Unlock keys to trade" prompt', () => {
    render(<OfferDetailPage />);
    expect(screen.getByText(/unlock keys to trade/i)).toBeInTheDocument();
  });
});

describe('OfferDetailPage — authenticated buyer, no active trade', () => {
  beforeEach(() => {
    setupOffer(makeOffer());
    mockUser = { id: 'buyer-1', nickname: 'buyer_nick' };
    mockIsAuthenticated = true;
    mockIsUnlocked = true;
    mockTradesForOffer.data = { trades: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } };
  });

  it('renders Make Offer form', () => {
    render(<OfferDetailPage />);
    expect(screen.getByText(/^make an offer$/i)).toBeInTheDocument();
  });

  it('renders settlement method select in form', () => {
    render(<OfferDetailPage />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders "Submit your trade proposal" placeholder', () => {
    render(<OfferDetailPage />);
    expect(screen.getByText(/submit your trade proposal/i)).toBeInTheDocument();
  });

  it('shows Make offer button', () => {
    render(<OfferDetailPage />);
    expect(screen.getByRole('button', { name: /make offer/i })).toBeInTheDocument();
  });
});

describe('OfferDetailPage — authenticated buyer with active trade', () => {
  beforeEach(() => {
    setupOffer(makeOffer());
    mockUser = { id: 'buyer-1', nickname: 'buyer_nick' };
    mockIsAuthenticated = true;
    mockIsUnlocked = true;
    mockTradesForOffer.data = {
      trades: [makeTrade()],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    };
  });

  it('does not show Make Offer form when active trade exists', () => {
    render(<OfferDetailPage />);
    expect(screen.queryByRole('button', { name: /^make offer$/i })).not.toBeInTheDocument();
  });

  it('shows safety reminders in left panel', () => {
    render(<OfferDetailPage />);
    expect(screen.getByText(/safety reminders/i)).toBeInTheDocument();
  });

  it('shows seller profile card in right panel', () => {
    render(<OfferDetailPage />);
    // TradeProfileCard renders the seller nickname in right panel
    const links = screen.getAllByText('seller_nick');
    expect(links.length).toBeGreaterThanOrEqual(1);
  });

  it('shows greyed rating section', () => {
    render(<OfferDetailPage />);
    expect(screen.getByText(/rate seller_nick/i)).toBeInTheDocument();
    expect(screen.getByText(/complete the trade to leave a review/i)).toBeInTheDocument();
  });
});

describe('OfferDetailPage — owner view', () => {
  beforeEach(() => {
    setupOffer(makeOffer({ user_id: 'owner-1' }));
    mockUser = { id: 'owner-1', nickname: 'seller_nick' };
    mockIsAuthenticated = true;
    mockIsUnlocked = true;
  });

  it('does not show Make Offer form for owner', () => {
    render(<OfferDetailPage />);
    expect(screen.queryByText(/^make an offer$/i)).not.toBeInTheDocument();
  });

  it('shows Pause offer button', () => {
    render(<OfferDetailPage />);
    expect(screen.getByRole('button', { name: /pause offer/i })).toBeInTheDocument();
  });

  it('shows Delete offer button', () => {
    render(<OfferDetailPage />);
    expect(screen.getByRole('button', { name: /delete offer/i })).toBeInTheDocument();
  });

  it('shows Trade proposals panel', () => {
    mockTradesForOffer.data = { trades: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } };
    render(<OfferDetailPage />);
    expect(screen.getByText(/trade proposals/i)).toBeInTheDocument();
  });

  it('shows safety warnings when no proposals', () => {
    mockTradesForOffer.data = { trades: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } };
    render(<OfferDetailPage />);
    expect(screen.getByText(/safety reminders/i)).toBeInTheDocument();
    expect(screen.getByText(/always verify payment/i)).toBeInTheDocument();
  });

  it('shows trade proposal with accept/decline buttons', () => {
    mockTradesForOffer.data = {
      trades: [makeTrade({ buyer_nickname: 'some_buyer' })],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    };
    render(<OfferDetailPage />);
    expect(screen.getByText('some_buyer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /decline/i })).toBeInTheDocument();
  });
});

describe('OfferDetailPage — Make Offer form validation', () => {
  beforeEach(() => {
    setupOffer(makeOffer({ min_amount: 100, max_amount: 5000 }));
    mockUser = { id: 'buyer-1', nickname: 'buyer_nick' };
    mockIsAuthenticated = true;
    mockIsUnlocked = true;
    mockTradesForOffer.data = { trades: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } };
  });

  it('shows error when submitting without amount', async () => {
    const user = userEvent.setup();
    render(<OfferDetailPage />);
    await user.click(screen.getByRole('button', { name: /make offer/i }));
    await waitFor(() => expect(screen.getByText(/valid amount|select a settlement/i)).toBeInTheDocument());
  });

  it('creates trade and thread on valid submission', async () => {
    const user = userEvent.setup();
    mockCreateTradeMutation.mutateAsync.mockResolvedValue({ id: 'trade-new' });
    mockCreateThreadMutation.mutateAsync.mockResolvedValue({ id: 'thread-new' });

    render(<OfferDetailPage />);

    // Type amount
    const amountInput = screen.getByPlaceholderText(/100/);
    await user.type(amountInput, '500');

    // Select payment method via mocked Select
    const selectItem = screen.getByTestId('select-item-bank_transfer');
    await user.click(selectItem);

    // Submit
    await user.click(screen.getByRole('button', { name: /make offer/i }));

    await waitFor(() =>
      expect(mockCreateTradeMutation.mutateAsync).toHaveBeenCalledWith({
        offer_id: 'offer-1',
        fiat_amount: 500,
        payment_method: 'bank_transfer',
      }),
    );
    await waitFor(() =>
      expect(mockCreateThreadMutation.mutateAsync).toHaveBeenCalledWith({
        recipient_nickname: 'seller_nick',
        offer_id: 'offer-1',
      }),
    );
  });
});
