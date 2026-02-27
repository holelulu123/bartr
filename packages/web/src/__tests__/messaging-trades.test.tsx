import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// jsdom doesn't implement scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
const mockReplace = vi.fn();
let mockParams: Record<string, string> = {};

vi.mock('next/navigation', () => ({
  useParams: () => mockParams,
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(),
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
  useAcceptTrade: () => mockAcceptMutation,
  useDeclineTrade: () => mockDeclineMutation,
  useCancelTrade: () => mockCancelMutation,
  useCompleteTrade: () => mockCompleteMutation,
  useRateTrade: () => mockRateMutation,
}));

// api mock (for getUserPublicKey called inside ChatPage)
vi.mock('@/lib/api', () => ({
  users: {
    getUserPublicKey: vi.fn().mockResolvedValue({ public_key: 'pk-base64' }),
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
});

// ── MessagesPage (inbox) ─────────────────────────────────────────────────────

import MessagesPage from '@/app/messages/page';

describe('MessagesPage — inbox', () => {
  it('shows loading skeleton while fetching threads', () => {
    mockUseThreads.mockReturnValue({ data: undefined, isLoading: true });
    render(<MessagesPage />);
    expect(screen.getByRole('heading', { name: /messages/i })).toBeInTheDocument();
  });

  it('shows empty state when no threads', () => {
    mockUseThreads.mockReturnValue({ data: { threads: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } }, isLoading: false });
    render(<MessagesPage />);
    expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();
  });

  it('renders thread list with other participant name', () => {
    mockUseThreads.mockReturnValue({
      data: { threads: [makeThread()], pagination: { page: 1, limit: 20, total: 1, pages: 1 } },
      isLoading: false,
    });
    render(<MessagesPage />);
    // alice is current user, so other is bob
    expect(screen.getByText('bob')).toBeInTheDocument();
  });

  it('shows listing title in thread row', () => {
    mockUseThreads.mockReturnValue({
      data: { threads: [makeThread()], pagination: { page: 1, limit: 20, total: 1, pages: 1 } },
      isLoading: false,
    });
    render(<MessagesPage />);
    expect(screen.getByText(/vintage camera/i)).toBeInTheDocument();
  });

  it('thread row links to correct message thread', () => {
    mockUseThreads.mockReturnValue({
      data: { threads: [makeThread({ id: 'thread-42' })], pagination: { page: 1, limit: 20, total: 1, pages: 1 } },
      isLoading: false,
    });
    render(<MessagesPage />);
    const link = screen.getByRole('link', { name: /bob/i });
    expect(link).toHaveAttribute('href', '/messages/thread-42');
  });

  it('shows time-ago for last message', () => {
    mockUseThreads.mockReturnValue({
      data: { threads: [makeThread()], pagination: { page: 1, limit: 20, total: 1, pages: 1 } },
      isLoading: false,
    });
    render(<MessagesPage />);
    expect(screen.getByText(/ago/i)).toBeInTheDocument();
  });
});

// ── ChatPage ─────────────────────────────────────────────────────────────────

import ChatPage from '@/app/messages/[threadId]/page';

const mockSendMutateAsync = vi.fn();

function setupChat(options: { messages?: unknown[]; isLoading?: boolean; isError?: boolean } = {}) {
  mockParams = { threadId: 'thread-1' };

  mockUseQueryClient.mockReturnValue({
    getQueryData: vi.fn(() => ({
      threads: [makeThread()],
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

describe('ChatPage — rendering', () => {
  it('renders chat header with other participant', () => {
    setupChat({ messages: [] });
    render(<ChatPage />);
    expect(screen.getByText('bob')).toBeInTheDocument();
  });

  it('shows listing title in header', () => {
    setupChat({ messages: [] });
    render(<ChatPage />);
    expect(screen.getByText(/vintage camera/i)).toBeInTheDocument();
  });

  it('renders empty state when no messages', async () => {
    setupChat({ messages: [] });
    render(<ChatPage />);
    await waitFor(() => expect(screen.getByText(/no messages yet/i)).toBeInTheDocument());
  });

  it('shows locked banner when keys not unlocked', () => {
    mockIsUnlocked = false;
    setupChat({ messages: [] });
    render(<ChatPage />);
    expect(screen.getByText(/end-to-end encrypted/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /unlock your keys/i })).toHaveAttribute('href', '/auth/unlock');
  });

  it('does not show locked banner when keys are unlocked', () => {
    mockIsUnlocked = true;
    setupChat({ messages: [] });
    render(<ChatPage />);
    expect(screen.queryByText(/end-to-end encrypted/i)).not.toBeInTheDocument();
  });

  it('disables send button when keys are locked', () => {
    mockIsUnlocked = false;
    setupChat({ messages: [] });
    render(<ChatPage />);
    const sendBtn = screen.getByRole('button');
    expect(sendBtn).toBeDisabled();
  });

  it('renders back to inbox link', () => {
    setupChat({ messages: [] });
    render(<ChatPage />);
    expect(screen.getByRole('link', { name: '' })).toHaveAttribute('href', '/messages');
  });

  it('shows error state on fetch error', () => {
    setupChat({ isError: true });
    render(<ChatPage />);
    expect(screen.getByText(/thread not found/i)).toBeInTheDocument();
  });
});

describe('ChatPage — sending messages', () => {
  beforeEach(() => {
    setupChat({ messages: [] });
    mockSendMutateAsync.mockResolvedValue({ id: 'msg-1' });
  });

  it('send button is enabled when text is entered and keys are unlocked', async () => {
    render(<ChatPage />);
    const textarea = screen.getByPlaceholderText(/type a message/i);
    await userEvent.type(textarea, 'Hello!');
    const sendBtn = screen.getByRole('button');
    expect(sendBtn).not.toBeDisabled();
  });

  it('clears textarea after sending', async () => {
    render(<ChatPage />);
    const textarea = screen.getByPlaceholderText(/type a message/i);
    await userEvent.type(textarea, 'Hello!');
    await act(async () => {
      await userEvent.click(screen.getByRole('button'));
    });
    await waitFor(() => expect((textarea as HTMLTextAreaElement).value).toBe(''));
  });

  it('calls sendMessage mutation on Enter key', async () => {
    render(<ChatPage />);
    const textarea = screen.getByPlaceholderText(/type a message/i);
    await userEvent.type(textarea, 'Hello!{Enter}');
    await waitFor(() => expect(mockSendMutateAsync).toHaveBeenCalledWith('Hello!'));
  });

  it('does not send on Shift+Enter', async () => {
    render(<ChatPage />);
    const textarea = screen.getByPlaceholderText(/type a message/i);
    await userEvent.type(textarea, 'Hello!{shift>}{Enter}{/shift}');
    expect(mockSendMutateAsync).not.toHaveBeenCalled();
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

    // The component calls useTrades({ role: 'buyer' }) and useTrades({ role: 'seller' })
    // simultaneously, so mock based on argument
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
    // Skeleton has aria not yet set, just verify no crash
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
});

describe('TradeDetailPage — seller actions (offered)', () => {
  beforeEach(() => {
    mockParams = { id: 'trade-1' };
    // alice is the seller here
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
