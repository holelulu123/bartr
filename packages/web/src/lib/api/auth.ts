import { get, post } from './client';
import type { TokenPair, CurrentUser, KeyBlobs } from './types';

export interface RegisterPayload {
  email: string;
  password: string;
  public_key?: string;
  private_key_blob?: string;
  recovery_key_blob?: string;
}

export function register(payload: RegisterPayload): Promise<TokenPair> {
  return post<TokenPair>('/auth/register/email', payload);
}

export function login(email: string, password: string): Promise<TokenPair> {
  return post<TokenPair>('/auth/login/email', { email, password });
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

export function getKeyBlobs(): Promise<KeyBlobs> {
  return get<KeyBlobs>('/auth/key-blobs');
}

export function verifyEmail(code: string): Promise<{ verified: boolean }> {
  return post<{ verified: boolean }>('/auth/verify-email', { code });
}

export function resendVerification(): Promise<{ message: string }> {
  return post<{ message: string }>('/auth/resend-verification', {});
}
