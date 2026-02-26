import { get, put, uploadPut } from './client';
import type { UserProfile, UpdateProfilePayload, UserRatingsResponse } from './types';

export function getUser(nickname: string): Promise<UserProfile> {
  return get<UserProfile>(`/users/${nickname}`);
}

export function updateProfile(payload: UpdateProfilePayload): Promise<UserProfile> {
  return put<UserProfile>('/users/me', payload);
}

export function uploadAvatar(file: File): Promise<{ avatar_url: string }> {
  const formData = new FormData();
  formData.append('avatar', file);
  return uploadPut<{ avatar_url: string }>('/users/me/avatar', formData);
}

export function getUserRatings(
  nickname: string,
  page = 1,
  limit = 20
): Promise<UserRatingsResponse> {
  return get<UserRatingsResponse>(`/users/${nickname}/ratings?page=${page}&limit=${limit}`);
}
