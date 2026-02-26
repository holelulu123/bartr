import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Mock all API modules ──────────────────────────────────────────────────────
vi.mock('@/lib/api', () => ({
  listings: {
    getListings: vi.fn(),
    getListing: vi.fn(),
    getCategories: vi.fn(),
    createListing: vi.fn(),
    updateListing: vi.fn(),
    deleteListing: vi.fn(),
    uploadListingImage: vi.fn(),
    deleteListingImage: vi.fn(),
  },
  trades: {
    getTrades: vi.fn(),
    getTrade: vi.fn(),
    createOffer: vi.fn(),
    acceptTrade: vi.fn(),
    declineTrade: vi.fn(),
    cancelTrade: vi.fn(),
    completeTrade: vi.fn(),
    rateTrade: vi.fn(),
  },
  users: {
    getUser: vi.fn(),
    getUserRatings: vi.fn(),
    getUserPublicKey: vi.fn(),
    updateProfile: vi.fn(),
    uploadAvatar: vi.fn(),
  },
  messages: {
    getThreads: vi.fn(),
    getMessages: vi.fn(),
    createThread: vi.fn(),
    sendMessage: vi.fn(),
  },
}));

// ── Mock CryptoContext ────────────────────────────────────────────────────────
const mockEncrypt = vi.fn(async (plaintext: string) => `encrypted:${plaintext}`);
const mockDecrypt = vi.fn(async (ciphertext: string) => ciphertext.replace('encrypted:', ''));

vi.mock('@/contexts/crypto-context', () => ({
  useCrypto: () => ({
    encrypt: mockEncrypt,
    decrypt: mockDecrypt,
    isUnlocked: true,
  }),
  CryptoProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import * as api from '@/lib/api';
import { listingKeys, useListings, useListing, useCategories, useCreateListing, useDeleteListing } from '@/hooks/use-listings';
import { tradeKeys, useTrades, useTrade, useCreateOffer } from '@/hooks/use-trades';
import { userKeys, useUser } from '@/hooks/use-users';
import { messageKeys, useThreads, useSendMessage, decryptMessages } from '@/hooks/use-messages';

// ── Test helpers ──────────────────────────────────────────────────────────────
function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function wrapper(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ── Query key factories ───────────────────────────────────────────────────────
describe('listingKeys', () => {
  it('produces stable, hierarchical keys', () => {
    expect(listingKeys.all).toEqual(['listings']);
    expect(listingKeys.lists()).toEqual(['listings', 'list']);
    expect(listingKeys.list({ q: 'bike' })).toEqual(['listings', 'list', { q: 'bike' }]);
    expect(listingKeys.detail('abc')).toEqual(['listings', 'detail', 'abc']);
    expect(listingKeys.categories()).toEqual(['categories']);
  });
});

describe('tradeKeys', () => {
  it('produces stable, hierarchical keys', () => {
    expect(tradeKeys.all).toEqual(['trades']);
    expect(tradeKeys.list({ role: 'buyer' })).toEqual(['trades', 'list', { role: 'buyer' }]);
    expect(tradeKeys.detail('t1')).toEqual(['trades', 'detail', 't1']);
  });
});

describe('userKeys', () => {
  it('produces stable, hierarchical keys', () => {
    expect(userKeys.all).toEqual(['users']);
    expect(userKeys.detail('alice')).toEqual(['users', 'alice']);
    expect(userKeys.ratings('alice')).toEqual(['users', 'alice', 'ratings']);
  });
});

describe('messageKeys', () => {
  it('produces stable, hierarchical keys', () => {
    expect(messageKeys.all).toEqual(['messages']);
    expect(messageKeys.threads()).toEqual(['messages', 'threads']);
    expect(messageKeys.messages('t1')).toEqual(['messages', 'thread', 't1']);
  });
});

// ── useListings ───────────────────────────────────────────────────────────────
describe('useListings', () => {
  it('fetches and returns listings', async () => {
    const mockData = { listings: [{ id: '1', title: 'Bike' }], pagination: { page: 1, limit: 20, total: 1, pages: 1 } };
    vi.mocked(api.listings.getListings).mockResolvedValue(mockData as never);

    const client = makeClient();
    function Component() {
      const { data, isLoading } = useListings();
      if (isLoading) return <div>loading</div>;
      return <div>{data?.listings[0]?.title}</div>;
    }

    render(<Component />, { wrapper: wrapper(client) });
    expect(screen.getByText('loading')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('Bike')).toBeInTheDocument());
    expect(api.listings.getListings).toHaveBeenCalledWith({});
  });

  it('passes filters to the API', async () => {
    vi.mocked(api.listings.getListings).mockResolvedValue({ listings: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } } as never);
    const client = makeClient();

    function Component() {
      const { isLoading } = useListings({ q: 'laptop', page: 2 });
      return <div>{isLoading ? 'loading' : 'done'}</div>;
    }

    render(<Component />, { wrapper: wrapper(client) });
    await waitFor(() => expect(screen.getByText('done')).toBeInTheDocument());
    expect(api.listings.getListings).toHaveBeenCalledWith({ q: 'laptop', page: 2 });
  });
});

// ── useListing ────────────────────────────────────────────────────────────────
describe('useListing', () => {
  it('fetches a single listing by id', async () => {
    vi.mocked(api.listings.getListing).mockResolvedValue({ id: '99', title: 'Camera' } as never);
    const client = makeClient();

    function Component() {
      const { data, isLoading } = useListing('99');
      if (isLoading) return <div>loading</div>;
      return <div>{data?.title}</div>;
    }

    render(<Component />, { wrapper: wrapper(client) });
    await waitFor(() => expect(screen.getByText('Camera')).toBeInTheDocument());
    expect(api.listings.getListing).toHaveBeenCalledWith('99');
  });

  it('does not fetch when id is empty', () => {
    const client = makeClient();
    function Component() {
      const { fetchStatus } = useListing('');
      return <div>{fetchStatus}</div>;
    }
    render(<Component />, { wrapper: wrapper(client) });
    expect(api.listings.getListing).not.toHaveBeenCalled();
  });
});

// ── useCategories ─────────────────────────────────────────────────────────────
describe('useCategories', () => {
  it('fetches categories', async () => {
    vi.mocked(api.listings.getCategories).mockResolvedValue({ categories: [{ id: 1, name: 'Electronics', slug: 'electronics', parent_id: null }] });
    const client = makeClient();

    function Component() {
      const { data, isLoading } = useCategories();
      if (isLoading) return <div>loading</div>;
      return <div>{data?.categories[0]?.name}</div>;
    }

    render(<Component />, { wrapper: wrapper(client) });
    await waitFor(() => expect(screen.getByText('Electronics')).toBeInTheDocument());
  });
});

// ── useCreateListing mutation ─────────────────────────────────────────────────
describe('useCreateListing', () => {
  it('calls createListing and invalidates list queries', async () => {
    const created = { id: 'new-1', title: 'New Listing' };
    vi.mocked(api.listings.createListing).mockResolvedValue(created as never);
    vi.mocked(api.listings.getListings).mockResolvedValue({ listings: [], pagination: {} } as never);

    const client = makeClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    function Component() {
      const { mutate, isPending } = useCreateListing();
      return (
        <button onClick={() => mutate({ title: 'New Listing', description: 'desc', payment_methods: ['btc'] })}>
          {isPending ? 'creating' : 'create'}
        </button>
      );
    }

    render(<Component />, { wrapper: wrapper(client) });

    await act(async () => {
      screen.getByText('create').click();
    });

    await waitFor(() => expect(api.listings.createListing).toHaveBeenCalled());
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: listingKeys.lists() })
    );
  });
});

// ── useDeleteListing mutation ─────────────────────────────────────────────────
describe('useDeleteListing', () => {
  it('removes detail cache and invalidates lists on success', async () => {
    vi.mocked(api.listings.deleteListing).mockResolvedValue(undefined);
    const client = makeClient();
    const removeSpy = vi.spyOn(client, 'removeQueries');
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    function Component() {
      const { mutate } = useDeleteListing();
      return <button onClick={() => mutate('list-1')}>delete</button>;
    }

    render(<Component />, { wrapper: wrapper(client) });

    await act(async () => {
      screen.getByText('delete').click();
    });

    await waitFor(() => expect(api.listings.deleteListing).toHaveBeenCalledWith('list-1'));
    expect(removeSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: listingKeys.detail('list-1') }));
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: listingKeys.lists() }));
  });
});

// ── useTrades ─────────────────────────────────────────────────────────────────
describe('useTrades', () => {
  it('fetches trades with filters', async () => {
    vi.mocked(api.trades.getTrades).mockResolvedValue({ trades: [{ id: 't1' }], pagination: {} } as never);
    const client = makeClient();

    function Component() {
      const { data } = useTrades({ role: 'buyer' });
      return <div>{data?.trades[0]?.id ?? 'none'}</div>;
    }

    render(<Component />, { wrapper: wrapper(client) });
    await waitFor(() => expect(screen.getByText('t1')).toBeInTheDocument());
    expect(api.trades.getTrades).toHaveBeenCalledWith({ role: 'buyer' });
  });
});

// ── useCreateOffer ────────────────────────────────────────────────────────────
describe('useCreateOffer', () => {
  it('calls createOffer and invalidates trade lists', async () => {
    vi.mocked(api.trades.createOffer).mockResolvedValue({ id: 'new-trade' } as never);
    const client = makeClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    function Component() {
      const { mutate } = useCreateOffer();
      return <button onClick={() => mutate('listing-1')}>offer</button>;
    }

    render(<Component />, { wrapper: wrapper(client) });

    await act(async () => screen.getByText('offer').click());

    await waitFor(() => expect(api.trades.createOffer).toHaveBeenCalledWith('listing-1'));
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: tradeKeys.lists() }));
  });
});

// ── useUser ───────────────────────────────────────────────────────────────────
describe('useUser', () => {
  it('fetches a user profile', async () => {
    vi.mocked(api.users.getUser).mockResolvedValue({ id: '1', nickname: 'alice', reputation: { tier: 'trusted' } } as never);
    const client = makeClient();

    function Component() {
      const { data } = useUser('alice');
      return <div>{data?.nickname ?? 'none'}</div>;
    }

    render(<Component />, { wrapper: wrapper(client) });
    await waitFor(() => expect(screen.getByText('alice')).toBeInTheDocument());
    expect(api.users.getUser).toHaveBeenCalledWith('alice');
  });

  it('skips fetch when nickname is empty', () => {
    const client = makeClient();
    function Component() {
      const { fetchStatus } = useUser('');
      return <div>{fetchStatus}</div>;
    }
    render(<Component />, { wrapper: wrapper(client) });
    expect(api.users.getUser).not.toHaveBeenCalled();
  });
});

// ── useThreads ────────────────────────────────────────────────────────────────
describe('useThreads', () => {
  it('fetches message threads', async () => {
    vi.mocked(api.messages.getThreads).mockResolvedValue({ threads: [{ id: 'th1' }], pagination: {} } as never);
    const client = makeClient();

    function Component() {
      const { data } = useThreads();
      return <div>{data?.threads[0]?.id ?? 'none'}</div>;
    }

    render(<Component />, { wrapper: wrapper(client) });
    await waitFor(() => expect(screen.getByText('th1')).toBeInTheDocument());
  });
});

// ── useSendMessage — encrypts before sending ──────────────────────────────────
describe('useSendMessage', () => {
  it('fetches recipient public key, encrypts, then calls sendMessage', async () => {
    vi.mocked(api.users.getUserPublicKey).mockResolvedValue({ public_key: 'bob-pub-key' });
    vi.mocked(api.messages.sendMessage).mockResolvedValue({ id: 'msg-1' });

    const client = makeClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    function Component() {
      const { mutate } = useSendMessage('th1', 'bob');
      return <button onClick={() => mutate('hello')}>send</button>;
    }

    render(<Component />, { wrapper: wrapper(client) });

    await act(async () => screen.getByText('send').click());

    await waitFor(() => expect(api.messages.sendMessage).toHaveBeenCalled());

    // Should have looked up bob's public key
    expect(api.users.getUserPublicKey).toHaveBeenCalledWith('bob');
    // Should have encrypted the plaintext
    expect(mockEncrypt).toHaveBeenCalledWith('hello', 'bob-pub-key');
    // Should have sent the ciphertext, not plaintext
    expect(api.messages.sendMessage).toHaveBeenCalledWith('th1', 'encrypted:hello');
    // Should invalidate relevant queries
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: messageKeys.messages('th1') }));
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: messageKeys.threads() }));
  });
});

// ── decryptMessages utility ───────────────────────────────────────────────────
describe('decryptMessages', () => {
  it('decrypts all messages using sender public key', async () => {
    vi.mocked(api.users.getUserPublicKey).mockResolvedValue({ public_key: 'alice-pub-key' });

    const fakeResponse = {
      messages: [
        { id: '1', sender_id: 'a', sender_nickname: 'alice', recipient_id: 'b', body_encrypted: 'encrypted:hello', created_at: '' },
        { id: '2', sender_id: 'a', sender_nickname: 'alice', recipient_id: 'b', body_encrypted: 'encrypted:world', created_at: '' },
      ],
      pagination: { page: 1, limit: 50, total: 2, pages: 1 },
    };

    const result = await decryptMessages(fakeResponse, 'alice', mockDecrypt);

    expect(result[0].body).toBe('hello');
    expect(result[1].body).toBe('world');
    expect(mockDecrypt).toHaveBeenCalledWith('encrypted:hello', 'alice-pub-key');
    expect(mockDecrypt).toHaveBeenCalledWith('encrypted:world', 'alice-pub-key');
  });
});
