import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { messages as messagesApi, users as usersApi } from '@/lib/api';
import { useCrypto } from '@/contexts/crypto-context';
import type { CreateThreadPayload, MessagesResponse } from '@/lib/api';

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

/**
 * Encrypts plaintext with the recipient's public key before sending.
 * The server never sees the plaintext.
 */
export function useSendMessage(threadId: string, recipientNickname: string) {
  const qc = useQueryClient();
  const { encrypt } = useCrypto();

  return useMutation({
    mutationFn: async (plaintext: string) => {
      const { public_key } = await usersApi.getUserPublicKey(recipientNickname);
      const body_encrypted = await encrypt(plaintext, public_key);
      return messagesApi.sendMessage(threadId, body_encrypted);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: messageKeys.messages(threadId) });
      qc.invalidateQueries({ queryKey: messageKeys.threads() });
    },
  });
}

/**
 * Decrypts a batch of messages using the sender's public key.
 * Returns messages with a `body` field populated by decryption.
 */
export async function decryptMessages(
  response: MessagesResponse,
  senderNickname: string,
  decrypt: (ciphertext: string, senderPublicKeyBase64: string) => Promise<string>,
): Promise<Array<{ id: string; sender_id: string; sender_nickname: string; recipient_id: string; body: string; created_at: string }>> {
  const { public_key } = await usersApi.getUserPublicKey(senderNickname);
  return Promise.all(
    response.messages.map(async (msg) => ({
      ...msg,
      body: await decrypt(msg.body_encrypted, public_key),
    })),
  );
}
