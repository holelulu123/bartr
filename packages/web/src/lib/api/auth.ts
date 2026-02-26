import { get, post } from './client';
import type { TokenPair, CurrentUser, RegisterPayload } from './types';

export function register(payload: RegisterPayload): Promise<TokenPair> {
  return post<TokenPair>('/auth/register', payload);
}

export function refreshTokens(refresh_token: string): Promise<TokenPair> {
  return post<TokenPair>('/auth/refresh', { refresh_token });
}

export function logout(refresh_token: string): Promise<void> {
  return post<void>('/auth/logout', { refresh_token });
}

export function getMe(): Promise<CurrentUser> {
  return get<CurrentUser>('/auth/me');
}

export function getGoogleAuthUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  return `${baseUrl}/auth/google`;
}
