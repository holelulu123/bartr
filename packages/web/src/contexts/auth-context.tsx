'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { auth, setTokenStore, setOnUnauthenticated, setInitRefreshPromise, ApiError } from '@/lib/api';
import type { CurrentUser } from '@/lib/api';

interface AuthState {
  user: CurrentUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthActions {
  setTokens: (access: string, refresh: string) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

type AuthContextValue = AuthState & AuthActions;

const AuthContext = createContext<AuthContextValue | null>(null);

const REFRESH_TOKEN_KEY = 'bartr_refresh';

function getRefreshTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${REFRESH_TOKEN_KEY}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setRefreshTokenCookie(token: string) {
  if (typeof document === 'undefined') return;
  const maxAge = 60 * 60 * 24 * 30; // 30 days
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${REFRESH_TOKEN_KEY}=${encodeURIComponent(token)}; max-age=${maxAge}; path=/; SameSite=Strict${secure}`;
}

function clearRefreshTokenCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${REFRESH_TOKEN_KEY}=; max-age=0; path=/`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const accessTokenRef = useRef<string | null>(null);

  // Wire up the token store and unauthenticated handler once
  useEffect(() => {
    setTokenStore({
      getAccessToken: () => accessTokenRef.current,
      getRefreshToken: () => getRefreshTokenFromCookie(),
      setTokens: (access: string, refresh: string) => {
        accessTokenRef.current = access;
        setRefreshTokenCookie(refresh);
      },
      clearTokens: () => {
        accessTokenRef.current = null;
        clearRefreshTokenCookie();
        setUser(null);
      },
    });
    setOnUnauthenticated(() => {
      accessTokenRef.current = null;
      clearRefreshTokenCookie();
      setUser(null);
      // Redirect to login — the GlobalAuthGuard will also catch this,
      // but doing it here is immediate and doesn't wait for a re-render cycle
      if (typeof window !== 'undefined') {
        window.location.replace('/login');
      }
    });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await auth.getMe();
      setUser(me);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        accessTokenRef.current = null;
        clearRefreshTokenCookie();
        setUser(null);
      }
    }
  }, []);

  // On mount: if there's a refresh cookie, try to get a fresh access token.
  // Register the refresh promise with the API client so any requests that fire
  // simultaneously during boot reuse it instead of racing with a second refresh.
  useEffect(() => {
    async function init() {
      const refreshToken = getRefreshTokenFromCookie();
      if (!refreshToken) {
        setIsLoading(false);
        return;
      }

      const refreshP: Promise<boolean> = auth.refreshTokens(refreshToken).then(
        (tokens) => {
          accessTokenRef.current = tokens.access_token;
          setRefreshTokenCookie(tokens.refresh_token);
          return true;
        },
        () => {
          accessTokenRef.current = null;
          clearRefreshTokenCookie();
          return false;
        },
      );

      // Let the API client reuse this promise for concurrent 401 retries
      setInitRefreshPromise(refreshP);

      try {
        const refreshed = await refreshP;
        if (refreshed) {
          const me = await auth.getMe();
          setUser(me);
        }
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, []);

  const setTokens = useCallback((access: string, refresh: string) => {
    accessTokenRef.current = access;
    setRefreshTokenCookie(refresh);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = getRefreshTokenFromCookie();
    if (refreshToken) {
      try {
        await auth.logout(refreshToken);
      } catch {
        // Best-effort — clear locally regardless
      }
    }
    accessTokenRef.current = null;
    clearRefreshTokenCookie();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        setTokens,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
