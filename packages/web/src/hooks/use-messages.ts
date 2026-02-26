import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { messages as messagesApi } from '@/lib/api';
import type { CreateThreadPayload } from '@/lib/api';

export const messageKeys = {
  all: ['messages'] as const,
  threads: () => [...messageKeys.all, 'threads'] as const,
  messages: (threadId: string) => [...messageKeys.all, 'thread', threadId] as const,
};

export function useThreads() {
  return useQuery({
    queryKey: messageKeys.threads(),
    queryFn: () => messagesApi.getThreads(),
  });
}

export function useMessages(threadId: string) {
  return useInfiniteQuery({
    queryKey: messageKeys.messages(threadId),
    queryFn: ({ pageParam = 1 }) => messagesApi.getMessages(threadId, pageParam as number),
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.pages ? last.pagination.page + 1 : undefined,
    initialPageParam: 1,
    enabled: !!threadId,
  });
}

export function useCreateThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateThreadPayload) => messagesApi.createThread(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: messageKeys.threads() });
    },
  });
}

export function useSendMessage(threadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => messagesApi.sendMessage(threadId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: messageKeys.messages(threadId) });
      qc.invalidateQueries({ queryKey: messageKeys.threads() });
    },
  });
}
