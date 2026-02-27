import { get, post } from './client';
import type { TokenPair, CurrentUser, RegisterPayload, KeyBlobs } from './types';

export function register(payload: RegisterPayload): Promise<TokenPair> {
  return post<TokenPair>('/auth/register', payload);
}

export interface EmailRegisterPayload {
  email: string;
  password: string;
  public_key: string;
  private_key_blob: string;
  recovery_key_blob: string;
}

export function registerEmail(payload: EmailRegisterPayload): Promise<TokenPair> {
  return post<TokenPair>('/auth/register/email', payload);
}

export function loginEmail(email: string, password: string): Promise<TokenPair> {
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

export function getGoogleAuthUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  return `${baseUrl}/auth/google`;
}
