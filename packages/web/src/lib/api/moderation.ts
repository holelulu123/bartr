import { get, post, put } from './client';
import type {
  Flag,
  CreateFlagPayload,
  AdminFlagsResponse,
  ModerationCheckResponse,
  ModerationStatus,
} from './types';

export function submitFlag(payload: CreateFlagPayload): Promise<Flag> {
  return post<Flag>('/flags', payload);
}

export function getMyFlags(): Promise<{ flags: Flag[] }> {
  return get<{ flags: Flag[] }>('/flags/mine');
}

export function getAdminFlags(
  filters: { status?: ModerationStatus; type?: string; page?: number; limit?: number } = {}
): Promise<AdminFlagsResponse> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.type) params.set('type', filters.type);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));

  const qs = params.toString();
  return get<AdminFlagsResponse>(`/admin/flags${qs ? `?${qs}` : ''}`);
}

export function updateFlag(id: string, status: ModerationStatus): Promise<Flag> {
  return put<Flag>(`/admin/flags/${id}`, { status });
}

export function checkText(text: string): Promise<ModerationCheckResponse> {
  return post<ModerationCheckResponse>('/moderation/check', { text });
}
