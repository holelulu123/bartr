'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, AlertCircle } from 'lucide-react';
import { useMessages, useSendMessage } from '@/hooks/use-messages';
import { useAuth } from '@/contexts/auth-context';
import { useCrypto } from '@/contexts/crypto-context';
import { users as usersApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Message } from '@/lib/api';

interface DecryptedMessage extends Message {
  body: string;
  decryptError?: boolean;
}

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

export function MessageBubble({ msg, isOwn }: { msg: DecryptedMessage; isOwn: boolean }) {
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

function useSendMessageStable(threadId: string, recipientNickname: string) {
  const mutation = useSendMessage(threadId, recipientNickname);
  const ref = useRef(mutation.mutateAsync);
  useEffect(() => {
    ref.current = mutation.mutateAsync;
  });
  return useCallback((text: string) => ref.current(text), []);
}

export interface ChatPanelProps {
  threadId: string;
  recipientNickname: string;
  contextLabel?: string | null;
  className?: string;
}

export function ChatPanel({ threadId, recipientNickname, contextLabel, className }: ChatPanelProps) {
  const { user } = useAuth();
  const { decrypt, isUnlocked } = useCrypto();

  const [decrypted, setDecrypted] = useState<DecryptedMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError } = useMessages(threadId);
  const send = useSendMessageStable(threadId, recipientNickname);

  // Decrypt messages
  useEffect(() => {
    if (!data || !recipientNickname) return;
    const raw = data.pages.flatMap((p) => p.messages);

    if (!isUnlocked) {
      setDecrypted(raw.map((m) => ({ ...m, body: '', decryptError: true })));
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { public_key } = await usersApi.getUserPublicKey(recipientNickname);
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
  }, [data, isUnlocked, recipientNickname, decrypt]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [decrypted.length]);

  async function doSend() {
    const trimmed = text.trim();
    if (!trimmed || !recipientNickname || !isUnlocked) return;
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
      <div className={cn('flex items-center justify-center p-6 text-sm text-muted-foreground', className)}>
        Failed to load messages.
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Context label */}
      {contextLabel && (
        <div className="px-3 py-1.5 border-b border-border shrink-0">
          <p className="text-xs text-muted-foreground truncate">re: {contextLabel}</p>
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
