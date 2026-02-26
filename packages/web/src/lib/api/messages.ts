import { get, post } from './client';
import type { MessageThread, ThreadsResponse, MessagesResponse, CreateThreadPayload } from './types';

export function getThreads(page = 1, limit = 20): Promise<ThreadsResponse> {
  return get<ThreadsResponse>(`/threads?page=${page}&limit=${limit}`);
}

export function createThread(payload: CreateThreadPayload): Promise<MessageThread> {
  return post<MessageThread>('/threads', payload);
}

export function getMessages(threadId: string, page = 1, limit = 50): Promise<MessagesResponse> {
  return get<MessagesResponse>(`/threads/${threadId}/messages?page=${page}&limit=${limit}`);
}

export function sendMessage(threadId: string, body_encrypted: string): Promise<{ id: string }> {
  return post<{ id: string }>(`/threads/${threadId}/messages`, { body_encrypted });
}
