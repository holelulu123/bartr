import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isThreadUnread } from '@/hooks/use-unread-threads';
import type { MessageThread } from '@/lib/api';

// Provide a simple localStorage stub (vitest jsdom may not support .clear)
let store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { store = {}; },
};

beforeEach(() => {
  store = {};
  vi.stubGlobal('localStorage', localStorageMock);
});

function makeThread(overrides: Partial<MessageThread> = {}): MessageThread {
  return {
    id: 'thread-1',
    listing_id: null,
    created_at: '2024-01-01T00:00:00Z',
    participant_1_nickname: 'alice',
    participant_2_nickname: 'bob',
    listing_title: null,
    last_message_at: '2024-01-02T12:00:00Z',
    last_sender_nickname: 'bob',
    ...overrides,
  };
}

describe('isThreadUnread', () => {
  it('returns true when there is a message from the other person and no read record', () => {
    const thread = makeThread({ last_sender_nickname: 'bob', last_message_at: '2024-01-02T12:00:00Z' });
    expect(isThreadUnread(thread, 'alice')).toBe(true);
  });

  it('returns false when last sender is the current user', () => {
    const thread = makeThread({ last_sender_nickname: 'alice', last_message_at: '2024-01-02T12:00:00Z' });
    expect(isThreadUnread(thread, 'alice')).toBe(false);
  });

  it('returns false when there are no messages yet', () => {
    const thread = makeThread({ last_message_at: null, last_sender_nickname: null });
    expect(isThreadUnread(thread, 'alice')).toBe(false);
  });

  it('returns false after thread is marked as read', () => {
    const thread = makeThread({ last_sender_nickname: 'bob', last_message_at: '2024-01-02T12:00:00Z' });

    // Simulate markThreadRead storing the timestamp
    const map: Record<string, string> = { 'thread-1': '2024-01-02T12:00:00Z' };
    localStorage.setItem('bartr_thread_read', JSON.stringify(map));

    expect(isThreadUnread(thread, 'alice')).toBe(false);
  });

  it('returns true again when a new message arrives after the read timestamp', () => {
    // User read at noon
    const map: Record<string, string> = { 'thread-1': '2024-01-02T12:00:00Z' };
    localStorage.setItem('bartr_thread_read', JSON.stringify(map));

    // New message arrived at 1pm
    const thread = makeThread({ last_sender_nickname: 'bob', last_message_at: '2024-01-02T13:00:00Z' });
    expect(isThreadUnread(thread, 'alice')).toBe(true);
  });

  it('returns false when read timestamp is newer than last message', () => {
    const map: Record<string, string> = { 'thread-1': '2024-01-02T14:00:00Z' };
    localStorage.setItem('bartr_thread_read', JSON.stringify(map));

    const thread = makeThread({ last_sender_nickname: 'bob', last_message_at: '2024-01-02T12:00:00Z' });
    expect(isThreadUnread(thread, 'alice')).toBe(false);
  });
});
