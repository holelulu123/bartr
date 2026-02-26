import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { apiRequest, get, post, put, del, upload, setTokenStore, ApiError, getBaseUrl } from '@/lib/api/client';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

function jsonResponse(data: unknown, status = 200, statusText = 'OK') {
  return new Response(JSON.stringify(data), {
    status,
    statusText,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(status: number, statusText: string, body?: unknown) {
  return new Response(body ? JSON.stringify(body) : null, {
    status,
    statusText,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('getBaseUrl', () => {
  it('returns default localhost URL', () => {
    const url = getBaseUrl();
    expect(url).toBe('http://localhost:4000');
  });
});

describe('apiRequest', () => {
  it('makes a GET request with correct URL', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

    const result = await apiRequest('/health');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('http://localhost:4000/health');
    expect(opts.method).toBeUndefined(); // defaults in RequestInit
    expect(result).toEqual({ ok: true });
  });

  it('sets Content-Type to application/json by default', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));

    await apiRequest('/test', { method: 'POST', body: '{}' });

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('does not set Content-Type for FormData', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));
    const formData = new FormData();

    await apiRequest('/upload', { method: 'POST', body: formData });

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers.has('Content-Type')).toBe(false);
  });

  it('throws ApiError on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(404, 'Not Found', { error: 'not found' }));

    await expect(apiRequest('/missing')).rejects.toThrow(ApiError);

    try {
      mockFetch.mockResolvedValueOnce(errorResponse(400, 'Bad Request', { error: 'invalid' }));
      await apiRequest('/bad');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      const err = e as ApiError;
      expect(err.status).toBe(400);
      expect(err.statusText).toBe('Bad Request');
      expect(err.body).toEqual({ error: 'invalid' });
    }
  });

  it('handles 204 No Content', async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 204, statusText: 'No Content' }));

    const result = await apiRequest('/empty');
    expect(result).toBeUndefined();
  });
});

describe('auth token handling', () => {
  const mockStore = {
    getAccessToken: vi.fn(),
    getRefreshToken: vi.fn(),
    setTokens: vi.fn(),
    clearTokens: vi.fn(),
  };

  beforeEach(() => {
    setTokenStore(mockStore);
    mockStore.getAccessToken.mockReset();
    mockStore.getRefreshToken.mockReset();
    mockStore.setTokens.mockReset();
    mockStore.clearTokens.mockReset();
  });

  afterEach(() => {
    setTokenStore(null as never);
  });

  it('attaches Authorization header when token is available', async () => {
    mockStore.getAccessToken.mockReturnValue('test-token-123');
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await apiRequest('/protected');

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers.get('Authorization')).toBe('Bearer test-token-123');
  });

  it('does not attach Authorization header when no token', async () => {
    mockStore.getAccessToken.mockReturnValue(null);
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await apiRequest('/public');

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers.has('Authorization')).toBe(false);
  });

  it('refreshes token on 401 and retries', async () => {
    mockStore.getAccessToken
      .mockReturnValueOnce('expired-token')
      .mockReturnValueOnce('new-token');
    mockStore.getRefreshToken.mockReturnValue('refresh-token');

    // First call: 401
    mockFetch.mockResolvedValueOnce(errorResponse(401, 'Unauthorized'));
    // Refresh call: success
    mockFetch.mockResolvedValueOnce(jsonResponse({ access_token: 'new-token', refresh_token: 'new-refresh' }));
    // Retry: success
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: 'secret' }));

    const result = await apiRequest('/protected');

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(mockStore.setTokens).toHaveBeenCalledWith('new-token', 'new-refresh');
    expect(result).toEqual({ data: 'secret' });

    // Verify retry used new token
    const retryHeaders = mockFetch.mock.calls[2][1].headers;
    expect(retryHeaders.get('Authorization')).toBe('Bearer new-token');
  });

  it('clears tokens when refresh fails', async () => {
    mockStore.getAccessToken.mockReturnValue('expired-token');
    mockStore.getRefreshToken.mockReturnValue('bad-refresh');

    // First call: 401
    mockFetch.mockResolvedValueOnce(errorResponse(401, 'Unauthorized'));
    // Refresh call: fails
    mockFetch.mockResolvedValueOnce(errorResponse(401, 'Unauthorized'));

    await expect(apiRequest('/protected')).rejects.toThrow(ApiError);
    expect(mockStore.clearTokens).toHaveBeenCalled();
  });
});

describe('convenience methods', () => {
  beforeEach(() => {
    setTokenStore(null as never);
  });

  it('get() calls fetch with GET', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ items: [] }));

    const result = await get('/items');

    expect(result).toEqual({ items: [] });
    expect(mockFetch.mock.calls[0][1].method).toBe('GET');
  });

  it('post() sends JSON body', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: '1' }));

    const result = await post('/items', { name: 'test' });

    expect(result).toEqual({ id: '1' });
    const opts = mockFetch.mock.calls[0][1];
    expect(opts.method).toBe('POST');
    expect(opts.body).toBe('{"name":"test"}');
  });

  it('put() sends JSON body', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: '1', name: 'updated' }));

    await put('/items/1', { name: 'updated' });

    const opts = mockFetch.mock.calls[0][1];
    expect(opts.method).toBe('PUT');
    expect(opts.body).toBe('{"name":"updated"}');
  });

  it('del() calls with DELETE method', async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 204, statusText: 'No Content' }));

    await del('/items/1');

    expect(mockFetch.mock.calls[0][1].method).toBe('DELETE');
  });

  it('upload() sends FormData without Content-Type', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: 'img-1' }));

    const formData = new FormData();
    formData.append('file', new Blob(['test']), 'test.jpg');

    await upload('/upload', formData);

    const opts = mockFetch.mock.calls[0][1];
    expect(opts.method).toBe('POST');
    expect(opts.body).toBe(formData);
    const headers = opts.headers;
    expect(headers.has('Content-Type')).toBe(false);
  });
});

describe('domain API modules', () => {
  beforeEach(() => {
    setTokenStore(null as never);
  });

  it('auth module exports expected functions', async () => {
    const auth = await import('@/lib/api/auth');
    expect(auth.register).toBeTypeOf('function');
    expect(auth.refreshTokens).toBeTypeOf('function');
    expect(auth.logout).toBeTypeOf('function');
    expect(auth.getMe).toBeTypeOf('function');
    expect(auth.getGoogleAuthUrl).toBeTypeOf('function');
  });

  it('listings module exports expected functions', async () => {
    const listings = await import('@/lib/api/listings');
    expect(listings.getListings).toBeTypeOf('function');
    expect(listings.getListing).toBeTypeOf('function');
    expect(listings.createListing).toBeTypeOf('function');
    expect(listings.updateListing).toBeTypeOf('function');
    expect(listings.deleteListing).toBeTypeOf('function');
    expect(listings.uploadListingImage).toBeTypeOf('function');
    expect(listings.deleteListingImage).toBeTypeOf('function');
    expect(listings.getCategories).toBeTypeOf('function');
  });

  it('trades module exports expected functions', async () => {
    const trades = await import('@/lib/api/trades');
    expect(trades.getTrades).toBeTypeOf('function');
    expect(trades.getTrade).toBeTypeOf('function');
    expect(trades.createOffer).toBeTypeOf('function');
    expect(trades.acceptTrade).toBeTypeOf('function');
    expect(trades.declineTrade).toBeTypeOf('function');
    expect(trades.cancelTrade).toBeTypeOf('function');
    expect(trades.completeTrade).toBeTypeOf('function');
    expect(trades.rateTrade).toBeTypeOf('function');
  });

  it('users module exports expected functions', async () => {
    const users = await import('@/lib/api/users');
    expect(users.getUser).toBeTypeOf('function');
    expect(users.updateProfile).toBeTypeOf('function');
    expect(users.uploadAvatar).toBeTypeOf('function');
    expect(users.getUserRatings).toBeTypeOf('function');
  });

  it('messages module exports expected functions', async () => {
    const messages = await import('@/lib/api/messages');
    expect(messages.getThreads).toBeTypeOf('function');
    expect(messages.createThread).toBeTypeOf('function');
    expect(messages.getMessages).toBeTypeOf('function');
    expect(messages.sendMessage).toBeTypeOf('function');
  });

  it('moderation module exports expected functions', async () => {
    const moderation = await import('@/lib/api/moderation');
    expect(moderation.submitFlag).toBeTypeOf('function');
    expect(moderation.getMyFlags).toBeTypeOf('function');
    expect(moderation.getAdminFlags).toBeTypeOf('function');
    expect(moderation.updateFlag).toBeTypeOf('function');
    expect(moderation.checkText).toBeTypeOf('function');
  });

  it('listings.getListings builds query string from filters', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ listings: [], pagination: {} }));

    const { getListings } = await import('@/lib/api/listings');
    await getListings({ q: 'laptop', category: 'electronics', page: 2, limit: 10 });

    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('q=laptop');
    expect(url).toContain('category=electronics');
    expect(url).toContain('page=2');
    expect(url).toContain('limit=10');
  });

  it('trades.getTrades builds query string from filters', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ trades: [], pagination: {} }));

    const { getTrades } = await import('@/lib/api/trades');
    await getTrades({ role: 'buyer', status: 'offered' });

    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('role=buyer');
    expect(url).toContain('status=offered');
  });

  it('auth.getGoogleAuthUrl returns correct URL', async () => {
    const { getGoogleAuthUrl } = await import('@/lib/api/auth');
    const url = getGoogleAuthUrl();
    expect(url).toContain('/auth/google');
  });
});

describe('barrel export', () => {
  it('index re-exports all modules and types', async () => {
    const api = await import('@/lib/api/index');
    expect(api.auth).toBeDefined();
    expect(api.listings).toBeDefined();
    expect(api.trades).toBeDefined();
    expect(api.users).toBeDefined();
    expect(api.messages).toBeDefined();
    expect(api.moderation).toBeDefined();
    expect(api.ApiError).toBeDefined();
    expect(api.apiRequest).toBeTypeOf('function');
    expect(api.get).toBeTypeOf('function');
    expect(api.post).toBeTypeOf('function');
    expect(api.put).toBeTypeOf('function');
    expect(api.del).toBeTypeOf('function');
  });
});
