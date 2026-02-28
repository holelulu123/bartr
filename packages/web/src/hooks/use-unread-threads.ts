/**
 * Tracks which message threads have unread messages using localStorage.
 *
 * A thread is "unread" when:
 *   - it has a last_message_at timestamp
 *   - the last sender is NOT the current user
 *   - the stored read-timestamp for that thread is older than last_message_at
 *     (or there is no stored timestamp at all)
 *
 * Call markThreadRead(threadId, lastMessageAt) when the user opens a thread
 * to clear its unread state.
 */

import { useCallback } from 'react';
import type { MessageThread } from '@/lib/api';

const STORAGE_KEY = 'bartr_thread_read';

function getReadMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function setReadMap(map: Record<string, string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // storage unavailable — no-op
  }
}

/** Returns true if the thread has a message from the other person that hasn't been read. */
export function isThreadUnread(
  thread: MessageThread,
  myNickname: string,
): boolean {
  if (!thread.last_message_at) return false;
  if (thread.last_sender_nickname === myNickname) return false;

  const map = getReadMap();
  const readAt = map[thread.id];
  if (!readAt) return true;

  // Unread if last message arrived after the user last read this thread
  return new Date(thread.last_message_at) > new Date(readAt);
}

export function useUnreadThreads(threads: MessageThread[], myNickname: string) {
  const unreadCount = threads.filter((t) => isThreadUnread(t, myNickname)).length;
  const hasUnread = unreadCount > 0;

  const markThreadRead = useCallback((threadId: string, lastMessageAt: string | null) => {
    const map = getReadMap();
    map[threadId] = lastMessageAt ?? new Date().toISOString();
    setReadMap(map);
  }, []);

  return { hasUnread, unreadCount, markThreadRead };
}
