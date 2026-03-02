'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, AlertCircle, Star } from 'lucide-react';
import { useMessages, useThreads, useSendMessage } from '@/hooks/use-messages';
import { useAuth } from '@/contexts/auth-context';
import { useCrypto } from '@/contexts/crypto-context';
import { useUser } from '@/hooks/use-users';
import { useUnreadThreads } from '@/hooks/use-unread-threads';
import { UserAvatar } from '@/components/user-avatar';
import { users as usersApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { CryptoGuard } from '@/components/crypto-guard';
import { cn } from '@/lib/utils';
import type { Message } from '@/lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

interface DecryptedMessage extends Message {
  body: string;
  decryptError?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return (
    d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function MessageBubble({ msg, isOwn }: { msg: DecryptedMessage; isOwn: boolean }) {
  return (
    <div className={cn('flex mb-2', isOwn ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
          isOwn
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-muted text-foreground rounded-bl-sm',
        )}
      >
        {msg.decryptError ? (
          <span className="flex items-center gap-1.5 text-xs opacity-70 italic">
            <AlertCircle className="h-3 w-3" />
            Unable to decrypt
          </span>
        ) : (
          <p className="whitespace-pre-wrap break-words">{msg.body}</p>
        )}
        <p className={cn('text-[11px] mt-0.5', isOwn ? 'text-primary-foreground/50' : 'text-muted-foreground')}>
          {timeLabel(msg.created_at)}
        </p>
      </div>
    </div>
  );
}

function ChatSkeleton() {
  return (
    <div className="flex-1 p-3 space-y-2 overflow-hidden">
      <div className="flex justify-start">
        <Skeleton className="h-12 w-44 rounded-2xl" />
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-9 w-32 rounded-2xl" />
      </div>
      <div className="flex justify-start">
        <Skeleton className="h-14 w-48 rounded-2xl" />
      </div>
    </div>
  );
}

function ChatHeader({ nickname, listingTitle }: { nickname: string; listingTitle: string | null }) {
  const { data: profile } = useUser(nickname);
  const rating = profile?.reputation?.rating_avg ?? 0;
  const stars = Math.round(rating);

  return (
    <div className="flex items-center gap-2.5 px-3 py-2 border-b border-border shrink-0">
      <Link
        href="/messages"
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <UserAvatar nickname={nickname} size={28} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Link href={`/user/${nickname}`} className="font-medium text-sm truncate hover:underline">
            {nickname}
          </Link>
          <div className="flex items-center gap-0.5 shrink-0">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={cn('h-3 w-3', n <= stars ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/20')}
              />
            ))}
            {rating > 0 && (
              <span className="text-xs text-muted-foreground ml-0.5">{rating.toFixed(1)}</span>
            )}
          </div>
        </div>
        {listingTitle && (
          <p className="text-xs text-muted-foreground truncate leading-tight">
            re: {listingTitle}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Hook: send message via mutation, stable ref so we can call in callbacks ──

function useSendMessageStable(threadId: string, recipientNickname: string) {
  const mutation = useSendMessage(threadId, recipientNickname);
  const ref = useRef(mutation.mutateAsync);
  useEffect(() => {
    ref.current = mutation.mutateAsync;
  });
  return useCallback((text: string) => ref.current(text), []);
}

// ── Main page ─────────────────────────────────────────────────────────────────

function ChatInner() {
  const { threadId } = useParams<{ threadId: string }>();
  const { user } = useAuth();
  const { decrypt, isUnlocked } = useCrypto();

  const [decrypted, setDecrypted] = useState<DecryptedMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError } = useMessages(threadId);
  const { data: threadsData } = useThreads();

  const threadMeta = threadsData?.threads.find((t) => t.id === threadId) ?? null;
  const { markThreadRead } = useUnreadThreads(threadsData?.threads ?? [], user?.nickname ?? '');

  useEffect(() => {
    if (threadMeta) {
      markThreadRead(threadId, threadMeta.last_message_at);
    }
  }, [threadId, threadMeta?.last_message_at, markThreadRead]);

  const otherNickname =
    threadMeta?.participant_1_nickname === user?.nickname
      ? threadMeta.participant_2_nickname
      : threadMeta?.participant_1_nickname;

  const send = useSendMessageStable(threadId, otherNickname ?? '');

  // Decrypt messages
  useEffect(() => {
    if (!data || !otherNickname) return;
    const raw = data.pages.flatMap((p) => p.messages);

    if (!isUnlocked) {
      setDecrypted(raw.map((m) => ({ ...m, body: '', decryptError: true })));
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { public_key } = await usersApi.getUserPublicKey(otherNickname);
        const result = await Promise.all(
          raw.map(async (m): Promise<DecryptedMessage> => {
            try {
              const body = await decrypt(m.body_encrypted, public_key);
              return { ...m, body };
            } catch {
              return { ...m, body: '', decryptError: true };
            }
          }),
        );
        if (!cancelled) setDecrypted(result);
      } catch {
        if (!cancelled) setDecrypted(raw.map((m) => ({ ...m, body: '', decryptError: true })));
      }
    })();

    return () => { cancelled = true; };
  }, [data, isUnlocked, otherNickname, decrypt]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [decrypted.length]);

  async function doSend() {
    const trimmed = text.trim();
    if (!trimmed || !otherNickname || !isUnlocked) return;
    setSending(true);
    setSendError('');
    try {
      await send(trimmed);
      setText('');
    } catch {
      setSendError('Failed to send. Try again.');
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  }

  if (isError) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-3">
        <p className="text-sm font-medium">Thread not found</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/messages">Back to inbox</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Header */}
      {otherNickname ? (
        <ChatHeader nickname={otherNickname} listingTitle={threadMeta?.listing_title ?? null} />
      ) : (
        <div className="flex items-center gap-2.5 px-3 py-2 border-b border-border shrink-0">
          <Link href="/messages" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Skeleton className="h-7 w-7 rounded-full" />
          <Skeleton className="h-3.5 w-28" />
        </div>
      )}

      {/* Message stream */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {isLoading ? (
          <ChatSkeleton />
        ) : decrypted.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-10">
            No messages yet. Say hello!
          </div>
        ) : (
          decrypted.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isOwn={msg.sender_nickname === user?.nickname}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-border px-3 py-2.5">
        {sendError && <p className="text-xs text-destructive mb-1.5">{sendError}</p>}
        <div className="flex items-end gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            disabled={sending}
            rows={1}
            className="resize-none min-h-[36px] max-h-28 flex-1 text-sm py-2"
          />
          <Button
            onClick={doSend}
            disabled={!text.trim() || sending}
            size="icon"
            className="shrink-0 h-9 w-9"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <CryptoGuard>
      <ChatInner />
    </CryptoGuard>
  );
}
