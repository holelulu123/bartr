import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// jsdom doesn't implement scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
const mockReplace = vi.fn();
let mockParams: Record<string, string> = {};
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useParams: () => mockParams,
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/',
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

let mockUser: { id: string; nickname: string } | null = { id: 'user-1', nickname: 'alice' };
const mockLogout = vi.fn();

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: !!mockUser,
    logout: mockLogout,
  }),
}));

let mockIsUnlocked = true;
const mockDecrypt = vi.fn(async (ciphertext: string) => `decrypted: ${ciphertext}`);
const mockEncrypt = vi.fn(async (text: string) => `encrypted: ${text}`);

vi.mock('@/contexts/crypto-context', () => ({
  useCrypto: () => ({
    decrypt: mockDecrypt,
    encrypt: mockEncrypt,
    isUnlocked: mockIsUnlocked,
  }),
}));

// CryptoGuard uses useCrypto + useAuth — mock it so it just renders children in tests
vi.mock('@/components/crypto-guard', () => ({
  CryptoGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Message sidebar mock
const mockOpenSidebar = vi.fn();
const mockCloseSidebar = vi.fn();
const mockOpenThread = vi.fn();
const mockOpenContact = vi.fn();
const mockClearSelection = vi.fn();
let mockSidebarState = {
  isOpen: false,
  selectedThreadId: null as string | null,
  pendingContact: null as { nickname: string; listingId?: string } | null,
};

vi.mock('@/contexts/message-sidebar-context', () => ({
  useMessageSidebar: () => ({
    ...mockSidebarState,
    openSidebar: mockOpenSidebar,
    closeSidebar: mockCloseSidebar,
    openThread: mockOpenThread,
    openContact: mockOpenContact,
    clearSelection: mockClearSelection,
  }),
}));

// threads query mock
const mockUseThreads = vi.fn();
const mockUseMessages = vi.fn();
const mockUseSendMessage = vi.fn();
const mockUseCreateThread = vi.fn();
const mockUseQueryClient = vi.fn(() => ({
  getQueryData: vi.fn(() => null),
}));

vi.mock('@/hooks/use-messages', () => ({
  useThreads: (...args: unknown[]) => mockUseThreads(...args),
  useMessages: (...args: unknown[]) => mockUseMessages(...args),
  useSendMessage: (...args: unknown[]) => mockUseSendMessage(...args),
  useCreateThread: () => mockUseCreateThread(),
  messageKeys: {
    threads: () => ['messages', 'threads'],
    messages: (id: string) => ['messages', 'thread', id],
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mockUseQueryClient(),
  useQuery: () => ({ data: undefined, isLoading: false }),
}));

vi.mock('@/hooks/use-users', () => ({
  useUser: () => ({ data: { reputation: { rating_avg: 4.2, tier: 'verified', composite_score: 75 } } }),
}));

// trades hooks mock
const mockUseTrade = vi.fn();
const mockUseTrades = vi.fn();
const mockAcceptMutation = { mutateAsync: vi.fn(), isPending: false };
const mockDeclineMutation = { mutateAsync: vi.fn(), isPending: false };
const mockCancelMutation = { mutateAsync: vi.fn(), isPending: false };
const mockCompleteMutation = { mutateAsync: vi.fn(), isPending: false };
const mockRateMutation = { mutateAsync: vi.fn(), isPending: false };

vi.mock('@/hooks/use-trades', () => ({
  useTrade: (...args: unknown[]) => mockUseTrade(...args),
  useTrades: (...args: unknown[]) => mockUseTrades(...args),
  useTradesForOffer: () => ({ data: undefined }),
  useAcceptTrade: () => mockAcceptMutation,
  useDeclineTrade: () => mockDeclineMutation,
  useCancelTrade: () => mockCancelMutation,
  useCompleteTrade: () => mockCompleteMutation,
  useRateTrade: () => mockRateMutation,
}));

// api mock (for getUserPublicKey called inside ChatPanel)
vi.mock('@/lib/api', () => ({
  users: {
    getUserPublicKey: vi.fn().mockResolvedValue({ public_key: 'pk-base64' }),
  },
  messages: {
    sendMessage: vi.fn().mockResolvedValue({}),
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

import type { MessageThread, TradeSummary, TradeDetail } from '@/lib/api';

function makeThread(overrides: Partial<MessageThread> = {}): MessageThread {
  return {
    id: 'thread-1',
    listing_id: 'listing-1',
    listing_title: 'Vintage Camera',
    participant_1_nickname: 'alice',
    participant_2_nickname: 'bob',
    created_at: new Date(Date.now() - 60_000 * 30).toISOString(),
    last_message_at: new Date(Date.now() - 60_000 * 5).toISOString(),
    ...overrides,
  };
}

function makeTrade(overrides: Partial<TradeSummary> = {}): TradeSummary {
  return {
    id: 'trade-1',
    listing_id: 'listing-1',
    listing_title: 'Vintage Camera',
    buyer_id: 'user-1',
    buyer_nickname: 'alice',
    seller_id: 'user-2',
    seller_nickname: 'bob',
    status: 'offered',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeTradeDetail(overrides: Partial<TradeDetail> = {}): TradeDetail {
  return {
    ...makeTrade(),
    events: [
      {
        id: 'ev-1',
        event_type: 'offered',
        created_by: 'user-1',
        created_at: new Date(Date.now() - 3_600_000).toISOString(),
      },
    ],
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockUser = { id: 'user-1', nickname: 'alice' };
  mockIsUnlocked = true;
  mockParams = {};
  mockSearchParams = new URLSearchParams();
  mockSidebarState = {
    isOpen: false,
    selectedThreadId: null,
    pendingContact: null,
  };
});

// ── MessagesPage (redirect) ─────────────────────────────────────────────────

import MessagesPage from '@/app/messages/page';

describe('MessagesPage — redirect', () => {
  it('calls openSidebar and redirects to / when no params', () => {
    render(<MessagesPage />);
    expect(mockOpenSidebar).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('calls openThread when ?thread= is present', () => {
    mockSearchParams = new URLSearchParams('thread=thread-42');
    render(<MessagesPage />);
    expect(mockOpenThread).toHaveBeenCalledWith('thread-42');
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('calls openContact when ?contact= is present', () => {
    mockSearchParams = new URLSearchParams('contact=bob');
    render(<MessagesPage />);
    expect(mockOpenContact).toHaveBeenCalledWith('bob');
    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});

// ── ChatRedirectPage ────────────────────────────────────────────────────────

import ChatRedirectPage from '@/app/messages/[threadId]/page';

describe('ChatRedirectPage', () => {
  it('calls openThread and redirects to /', () => {
    mockParams = { threadId: 'thread-99' };
    render(<ChatRedirectPage />);
    expect(mockOpenThread).toHaveBeenCalledWith('thread-99');
    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});

// ── MessageSidebar ──────────────────────────────────────────────────────────

import { MessageSidebar } from '@/components/message-sidebar';

function renderSidebar() {
  // Override the mock to use real context for these tests
  return render(<MessageSidebar />);
}

describe('MessageSidebar — thread list', () => {
  beforeEach(() => {
    mockSidebarState = { isOpen: true, selectedThreadId: null, pendingContact: null };
  });

  it('shows Messages heading when open with no thread selected', () => {
    mockUseThreads.mockReturnValue({ data: { threads: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } }, isLoading: false });
    renderSidebar();
    expect(screen.getByText('Messages')).toBeInTheDocument();
  });

  it('shows empty state when no threads', () => {
    mockUseThreads.mockReturnValue({ data: { threads: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } }, isLoading: false });
    renderSidebar();
    expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();
  });

  it('renders thread list with other participant name', () => {
    mockUseThreads.mockReturnValue({
      data: { threads: [makeThread()], pagination: { page: 1, limit: 20, total: 1, pages: 1 } },
      isLoading: false,
    });
    renderSidebar();
    expect(screen.getByText('bob')).toBeInTheDocument();
  });

  it('groups multiple threads from same person into one row', () => {
    mockUseThreads.mockReturnValue({
      data: {
        threads: [
          makeThread({ id: 'thread-1', listing_title: 'Vintage Camera' }),
          makeThread({ id: 'thread-2', listing_title: 'Old Laptop' }),
        ],
        pagination: { page: 1, limit: 20, total: 2, pages: 1 },
      },
      isLoading: false,
    });
    renderSidebar();
    // Only one row for "bob" even though there are 2 threads
    const bobs = screen.getAllByText('bob');
    expect(bobs).toHaveLength(1);
  });

  it('clicking a thread calls openThread', async () => {
    mockUseThreads.mockReturnValue({
      data: { threads: [makeThread({ id: 'thread-42' })], pagination: { page: 1, limit: 20, total: 1, pages: 1 } },
      isLoading: false,
    });
    renderSidebar();
    await userEvent.click(screen.getByRole('button', { name: /bob/i }));
    expect(mockOpenThread).toHaveBeenCalledWith('thread-42');
  });

  it('shows time-ago for last message', () => {
    mockUseThreads.mockReturnValue({
      data: { threads: [makeThread()], pagination: { page: 1, limit: 20, total: 1, pages: 1 } },
      isLoading: false,
    });
    renderSidebar();
    expect(screen.getByText(/\d+[mhd]/)).toBeInTheDocument();
  });

  it('close button calls closeSidebar', async () => {
    mockUseThreads.mockReturnValue({ data: { threads: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } }, isLoading: false });
    renderSidebar();
    await userEvent.click(screen.getByRole('button', { name: /close messages/i }));
    expect(mockCloseSidebar).toHaveBeenCalled();
  });
});

// ── MessageSidebar — conversation view ──────────────────────────────────────

const mockSendMutateAsync = vi.fn();

function setupSidebarChat(options: { messages?: unknown[]; isLoading?: boolean; isError?: boolean; threadId?: string } = {}) {
  const tid = options.threadId ?? 'thread-1';
  mockSidebarState = { isOpen: true, selectedThreadId: tid, pendingContact: null };

  mockUseThreads.mockReturnValue({
    data: { threads: [makeThread({ id: tid })], pagination: { page: 1, limit: 20, total: 1, pages: 1 } },
    isLoading: false,
  });

  mockUseQueryClient.mockReturnValue({
    getQueryData: vi.fn(() => ({
      threads: [makeThread({ id: tid })],
    })),
  });

  mockUseMessages.mockReturnValue({
    data: options.messages !== undefined
      ? { pages: [{ messages: options.messages, pagination: { page: 1, limit: 50, total: options.messages.length, pages: 1 } }] }
      : undefined,
    isLoading: options.isLoading ?? false,
    isError: options.isError ?? false,
  });

  mockUseSendMessage.mockReturnValue({
    mutateAsync: mockSendMutateAsync,
    isPending: false,
  });
}

describe('MessageSidebar — conversation view', () => {
  it('renders chat header with other participant when thread selected', () => {
    setupSidebarChat({ messages: [] });
    renderSidebar();
    // bob appears in header
    expect(screen.getByText('bob')).toBeInTheDocument();
  });

  it('shows back button that calls clearSelection', async () => {
    setupSidebarChat({ messages: [] });
    renderSidebar();
    await userEvent.click(screen.getByRole('button', { name: /back to threads/i }));
    expect(mockClearSelection).toHaveBeenCalled();
  });

  it('renders empty state when no messages in selected thread', async () => {
    setupSidebarChat({ messages: [] });
    renderSidebar();
    await waitFor(() => expect(screen.getByText(/no messages yet/i)).toBeInTheDocument());
  });

  it('send button is disabled when no text', () => {
    setupSidebarChat({ messages: [] });
    renderSidebar();
    const sendBtn = screen.getByRole('button', { name: '' });
    expect(sendBtn).toBeDisabled();
  });

  it('shows error state on fetch error', () => {
    setupSidebarChat({ isError: true });
    renderSidebar();
    expect(screen.getByText(/failed to load messages/i)).toBeInTheDocument();
  });
});

describe('MessageSidebar — sending messages', () => {
  beforeEach(() => {
    setupSidebarChat({ messages: [] });
    mockSendMutateAsync.mockResolvedValue({ id: 'msg-1' });
  });

  it('send button is enabled when text is entered and keys are unlocked', async () => {
    renderSidebar();
    const textarea = screen.getByPlaceholderText(/type a message/i);
    await userEvent.type(textarea, 'Hello!');
    const sendBtn = screen.getByRole('button', { name: '' });
    expect(sendBtn).not.toBeDisabled();
  });

  it('clears textarea after sending', async () => {
    renderSidebar();
    const textarea = screen.getByPlaceholderText(/type a message/i);
    await userEvent.type(textarea, 'Hello!');
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: '' }));
    });
    await waitFor(() => expect((textarea as HTMLTextAreaElement).value).toBe(''));
  });

  it('calls sendMessage mutation on Enter key', async () => {
    renderSidebar();
    const textarea = screen.getByPlaceholderText(/type a message/i);
    await userEvent.type(textarea, 'Hello!{Enter}');
    await waitFor(() => expect(mockSendMutateAsync).toHaveBeenCalledWith('Hello!'));
  });

  it('does not send on Shift+Enter', async () => {
    renderSidebar();
    const textarea = screen.getByPlaceholderText(/type a message/i);
    await userEvent.type(textarea, 'Hello!{shift>}{Enter}{/shift}');
    expect(mockSendMutateAsync).not.toHaveBeenCalled();
  });
});

// ── MessageSidebar — not rendered when closed ───────────────────────────────

describe('MessageSidebar — closed', () => {
  it('renders nothing when isOpen is false', () => {
    mockSidebarState = { isOpen: false, selectedThreadId: null, pendingContact: null };
    const { container } = renderSidebar();
    expect(container.innerHTML).toBe('');
  });
});

// ── TradesDashboardPage ──────────────────────────────────────────────────────

import TradesDashboardPage from '@/app/dashboard/trades/page';

describe('TradesDashboardPage', () => {
  beforeEach(() => {
    mockUseTrades.mockReturnValue({
      data: { trades: [makeTrade()], pagination: { page: 1, limit: 20, total: 1, pages: 1 } },
      isLoading: false,
    });
  });

  it('renders page heading', () => {
    render(<TradesDashboardPage />);
    expect(screen.getByRole('heading', { name: /my trades/i })).toBeInTheDocument();
  });

  it('renders Buying and Selling tabs', () => {
    render(<TradesDashboardPage />);
    expect(screen.getByRole('button', { name: /buying/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /selling/i })).toBeInTheDocument();
  });

  it('shows trade listing title in row', () => {
    render(<TradesDashboardPage />);
    expect(screen.getByText('Vintage Camera')).toBeInTheDocument();
  });

  it('shows trade status badge', () => {
    render(<TradesDashboardPage />);
    expect(screen.getByText('offered')).toBeInTheDocument();
  });

  it('trade row links to trade detail page', () => {
    render(<TradesDashboardPage />);
    const link = screen.getByRole('link', { name: /vintage camera/i });
    expect(link).toHaveAttribute('href', '/trades/trade-1');
  });

  it('shows empty state when no trades', () => {
    mockUseTrades.mockReturnValue({
      data: { trades: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } },
      isLoading: false,
    });
    render(<TradesDashboardPage />);
    expect(screen.getByText(/no purchases yet/i)).toBeInTheDocument();
  });

  it('switches to Selling tab', async () => {
    const buyingTrade = makeTrade({ listing_title: 'Vintage Camera' });
    const sellingTrade = makeTrade({ id: 'trade-2', listing_title: 'My Widget', buyer_nickname: 'charlie', buyer_id: 'user-3' });

    mockUseTrades.mockImplementation((filters: { role?: string } = {}) => {
      if (filters.role === 'seller') {
        return { data: { trades: [sellingTrade], pagination: { page: 1, limit: 20, total: 1, pages: 1 } }, isLoading: false };
      }
      return { data: { trades: [buyingTrade], pagination: { page: 1, limit: 20, total: 1, pages: 1 } }, isLoading: false };
    });

    render(<TradesDashboardPage />);
    await userEvent.click(screen.getByRole('button', { name: /selling/i }));
    await waitFor(() => expect(screen.getByText('My Widget')).toBeInTheDocument());
  });
});

// ── TradeDetailPage ──────────────────────────────────────────────────────────

import TradeDetailPage from '@/app/trades/[id]/page';

describe('TradeDetailPage — loading and errors', () => {
  it('shows loading skeleton', () => {
    mockParams = { id: 'trade-1' };
    mockUseTrade.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    render(<TradeDetailPage />);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('shows not found when error', () => {
    mockParams = { id: 'trade-1' };
    mockUseTrade.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<TradeDetailPage />);
    expect(screen.getByText(/trade not found/i)).toBeInTheDocument();
  });
});

describe('TradeDetailPage — content', () => {
  beforeEach(() => {
    mockParams = { id: 'trade-1' };
    mockUseTrade.mockReturnValue({
      data: makeTradeDetail(),
      isLoading: false,
      isError: false,
    });
  });

  it('renders listing title', () => {
    render(<TradeDetailPage />);
    expect(screen.getByRole('heading', { name: /vintage camera/i })).toBeInTheDocument();
  });

  it('renders status badge', () => {
    render(<TradeDetailPage />);
    expect(screen.getByText('offered')).toBeInTheDocument();
  });

  it('renders buyer and seller nicknames', () => {
    render(<TradeDetailPage />);
    expect(screen.getByRole('link', { name: 'alice' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'bob' })).toBeInTheDocument();
  });

  it('renders event timeline', () => {
    render(<TradeDetailPage />);
    expect(screen.getByText('Offer made')).toBeInTheDocument();
  });

  it('renders back to trades link', () => {
    render(<TradeDetailPage />);
    expect(screen.getByRole('link', { name: /my trades/i })).toHaveAttribute('href', '/dashboard/trades');
  });

  it('Open chat button calls openSidebar', async () => {
    render(<TradeDetailPage />);
    await userEvent.click(screen.getByRole('button', { name: /open chat/i }));
    expect(mockOpenSidebar).toHaveBeenCalled();
  });
});

describe('TradeDetailPage — seller actions (offered)', () => {
  beforeEach(() => {
    mockParams = { id: 'trade-1' };
    mockUser = { id: 'user-2', nickname: 'bob' };
    mockUseTrade.mockReturnValue({
      data: makeTradeDetail({ seller_id: 'user-2', seller_nickname: 'bob', buyer_id: 'user-1', buyer_nickname: 'alice' }),
      isLoading: false,
      isError: false,
    });
  });

  it('shows Accept and Decline buttons for seller on offered trade', () => {
    render(<TradeDetailPage />);
    expect(screen.getByRole('button', { name: /accept offer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /decline/i })).toBeInTheDocument();
  });

  it('calls acceptTrade mutation when Accept clicked', async () => {
    mockAcceptMutation.mutateAsync.mockResolvedValue({});
    render(<TradeDetailPage />);
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /accept offer/i }));
    });
    await waitFor(() => expect(mockAcceptMutation.mutateAsync).toHaveBeenCalledWith('trade-1'));
  });

  it('calls declineTrade mutation when Decline clicked', async () => {
    mockDeclineMutation.mutateAsync.mockResolvedValue({});
    render(<TradeDetailPage />);
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /decline/i }));
    });
    await waitFor(() => expect(mockDeclineMutation.mutateAsync).toHaveBeenCalledWith('trade-1'));
  });
});

describe('TradeDetailPage — buyer actions', () => {
  beforeEach(() => {
    mockParams = { id: 'trade-1' };
    mockUser = { id: 'user-1', nickname: 'alice' };
  });

  it('shows Cancel button for buyer on offered trade', () => {
    mockUseTrade.mockReturnValue({
      data: makeTradeDetail({ status: 'offered' }),
      isLoading: false,
      isError: false,
    });
    render(<TradeDetailPage />);
    expect(screen.getByRole('button', { name: /cancel trade/i })).toBeInTheDocument();
  });

  it('shows Confirm completion for buyer on accepted trade', () => {
    mockUseTrade.mockReturnValue({
      data: makeTradeDetail({ status: 'accepted' }),
      isLoading: false,
      isError: false,
    });
    render(<TradeDetailPage />);
    expect(screen.getByRole('button', { name: /confirm completion/i })).toBeInTheDocument();
  });

  it('calls completeTrade when Confirm completion clicked', async () => {
    mockCompleteMutation.mutateAsync.mockResolvedValue({ id: 'trade-1', status: 'accepted', message: 'Waiting' });
    mockUseTrade.mockReturnValue({
      data: makeTradeDetail({ status: 'accepted' }),
      isLoading: false,
      isError: false,
    });
    render(<TradeDetailPage />);
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /confirm completion/i }));
    });
    await waitFor(() => expect(mockCompleteMutation.mutateAsync).toHaveBeenCalledWith('trade-1'));
  });
});

describe('TradeDetailPage — completed trade', () => {
  beforeEach(() => {
    mockParams = { id: 'trade-1' };
    mockUser = { id: 'user-1', nickname: 'alice' };
    mockUseTrade.mockReturnValue({
      data: makeTradeDetail({ status: 'completed' }),
      isLoading: false,
      isError: false,
    });
  });

  it('shows Leave a rating button', () => {
    render(<TradeDetailPage />);
    expect(screen.getByRole('button', { name: /leave a rating/i })).toBeInTheDocument();
  });

  it('opens rating dialog when Leave a rating clicked', async () => {
    render(<TradeDetailPage />);
    await userEvent.click(screen.getByRole('button', { name: /leave a rating/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(screen.getByRole('heading', { name: /leave a rating/i })).toBeInTheDocument();
  });

  it('rating dialog has 5 star buttons', async () => {
    render(<TradeDetailPage />);
    await userEvent.click(screen.getByRole('button', { name: /leave a rating/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    const stars = screen.getAllByRole('button', { name: /star/i });
    expect(stars).toHaveLength(5);
  });

  it('submits rating via mutation', async () => {
    mockRateMutation.mutateAsync.mockResolvedValue({});
    render(<TradeDetailPage />);
    await userEvent.click(screen.getByRole('button', { name: /leave a rating/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /submit rating/i }));
    });
    await waitFor(() =>
      expect(mockRateMutation.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ tradeId: 'trade-1', payload: expect.objectContaining({ score: 5 }) }),
      ),
    );
  });
});
