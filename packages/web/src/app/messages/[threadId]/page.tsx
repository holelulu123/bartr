'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, AlertCircle } from 'lucide-react';
import { useMessages, useThreads, useSendMessage } from '@/hooks/use-messages';
import { useAuth } from '@/contexts/auth-context';
import { useCrypto } from '@/contexts/crypto-context';
import { users as usersApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { CryptoGuard } from '@/components/crypto-guard';
import type { Message } from '@/lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

interface DecryptedMessage extends Message {
  body: string;
  decryptError?: boolean;
}

interface ThreadMeta {
  participant_1_nickname: string;
  participant_2_nickname: string;
  listing_title: string | null;
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
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isOwn
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-muted text-foreground rounded-bl-sm'
        }`}
      >
        {msg.decryptError ? (
          <span className="flex items-center gap-1.5 text-xs opacity-70 italic">
            <AlertCircle className="h-3 w-3" />
            Unable to decrypt
          </span>
        ) : (
          <p className="whitespace-pre-wrap break-words">{msg.body}</p>
        )}
        <p
          className={`text-[10px] mt-1 ${
            isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground'
          }`}
        >
          {timeLabel(msg.created_at)}
        </p>
      </div>
    </div>
  );
}

function ChatSkeleton() {
  return (
    <div className="flex-1 p-4 space-y-3 overflow-hidden">
      <div className="flex justify-start">
        <Skeleton className="h-14 w-48 rounded-2xl" />
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-10 w-36 rounded-2xl" />
      </div>
      <div className="flex justify-start">
        <Skeleton className="h-16 w-52 rounded-2xl" />
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
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <p className="font-medium">Thread not found</p>
        <Button asChild variant="outline">
          <Link href="/messages">Back to inbox</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <Link
          href="/messages"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
          {(otherNickname ?? '??').slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{otherNickname ?? 'Loading…'}</p>
          {threadMeta?.listing_title && (
            <p className="text-xs text-muted-foreground truncate">
              re: {threadMeta.listing_title}
            </p>
          )}
        </div>
      </div>

      {/* Message stream */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <ChatSkeleton />
        ) : decrypted.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-12">
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
      <div className="shrink-0 border-t border-border p-4">
        {sendError && <p className="text-xs text-destructive mb-2">{sendError}</p>}
        <div className="flex items-end gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (Enter to send)"
            disabled={sending}
            rows={1}
            className="resize-none min-h-[40px] max-h-32 flex-1"
          />
          <Button
            onClick={doSend}
            disabled={!text.trim() || sending}
            size="icon"
            className="shrink-0"
          >
            <Send className="h-4 w-4" />
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

