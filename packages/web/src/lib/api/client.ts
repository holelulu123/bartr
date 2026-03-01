export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body: unknown
  ) {
    super(`API Error ${status}: ${statusText}`);
    this.name = 'ApiError';
  }
}

type TokenStore = {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  setTokens: (access: string, refresh: string) => void;
  clearTokens: () => void;
};

let tokenStore: TokenStore | null = null;
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;
let onUnauthenticated: (() => void) | null = null;

export function setTokenStore(store: TokenStore) {
  tokenStore = store;
}

export function setOnUnauthenticated(cb: () => void) {
  onUnauthenticated = cb;
}

/**
 * Called by AuthProvider.init() so that any API requests fired during
 * app boot reuse the same in-flight refresh instead of racing with it.
 */
export function setInitRefreshPromise(p: Promise<boolean>) {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshPromise = p.finally(() => {
      isRefreshing = false;
      refreshPromise = null;
    });
  }
}

export function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // Browser: use relative path so it works from any host (localhost, LAN IP, domain)
    return process.env.NEXT_PUBLIC_API_URL || '/api';
  }
  // Server-side (SSR): needs absolute URL to reach the API container
  return process.env.API_URL || 'http://localhost:4000';
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = tokenStore?.getRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${getBaseUrl()}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      tokenStore?.clearTokens();
      return false;
    }

    const data = await res.json();
    tokenStore?.setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    tokenStore?.clearTokens();
    return false;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
  const headers = new Headers(options.headers);

  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const accessToken = tokenStore?.getAccessToken();
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  let res = await fetch(url, { ...options, headers });

  // On 401, try refreshing the token once (skip if no token was sent — e.g. login attempt)
  if (res.status === 401 && tokenStore && accessToken) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshAccessToken();
    }

    const refreshed = await refreshPromise;
    isRefreshing = false;
    refreshPromise = null;

    if (refreshed) {
      const newToken = tokenStore.getAccessToken();
      if (newToken) {
        headers.set('Authorization', `Bearer ${newToken}`);
      }
      res = await fetch(url, { ...options, headers });
    } else {
      // Refresh failed — session is dead, redirect to login
      onUnauthenticated?.();
    }
  }

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text().catch(() => null);
    }
    throw new ApiError(res.status, res.statusText, body);
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}

// Convenience methods
export function get<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: 'GET' });
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function put<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function del<T = void>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: 'DELETE' });
}

export function upload<T>(path: string, formData: FormData): Promise<T> {
  return apiRequest<T>(path, {
    method: 'POST',
    body: formData,
  });
}

export function uploadPut<T>(path: string, formData: FormData): Promise<T> {
  return apiRequest<T>(path, {
    method: 'PUT',
    body: formData,
  });
}
