'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { MessageSquare, Star } from 'lucide-react';
import { useThreads, useCreateThread } from '@/hooks/use-messages';
import { useAuth } from '@/contexts/auth-context';
import { useUser } from '@/hooks/use-users';
import { useUnreadThreads, isThreadUnread } from '@/hooks/use-unread-threads';
import { UserAvatar } from '@/components/user-avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { CryptoGuard } from '@/components/crypto-guard';
import { cn } from '@/lib/utils';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

function InboxSkeleton() {
  return (
    <div className="space-y-1">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5 min-w-0">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-2.5 w-40" />
          </div>
          <Skeleton className="h-2.5 w-8 shrink-0" />
        </div>
      ))}
    </div>
  );
}

function ThreadRow({
  thread,
  otherNickname,
  unread,
  onRead,
}: {
  thread: { id: string; last_message_at: string | null; created_at: string; listing_title: string | null; last_sender_nickname: string | null };
  otherNickname: string;
  unread: boolean;
  onRead: () => void;
}) {
  const { data: profile } = useUser(otherNickname);
  const lastActivity = thread.last_message_at ?? thread.created_at;
  const rating = profile?.reputation?.rating_avg ?? 0;
  const stars = Math.round(rating);

  return (
    <Link
      href={`/messages/${thread.id}`}
      onClick={onRead}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
        unread ? 'bg-primary/5' : 'hover:bg-muted/50',
      )}
    >
      <div className="relative shrink-0">
        <UserAvatar nickname={otherNickname} size={32} />
        {unread && (
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-orange-500 border-2 border-background" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn('text-sm truncate', unread ? 'font-semibold' : 'font-medium')}>
            {otherNickname}
          </span>
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
        {thread.listing_title && (
          <p className="text-xs text-muted-foreground truncate leading-tight">
            re: {thread.listing_title}
          </p>
        )}
      </div>

      <span className="text-xs text-muted-foreground shrink-0">
        {timeAgo(lastActivity)}
      </span>
    </Link>
  );
}

function MessagesInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { data, isLoading } = useThreads();
  const createThread = useCreateThread();
  const creatingRef = useRef(false);

  const threads = data?.threads ?? [];
  const { markThreadRead } = useUnreadThreads(threads, user?.nickname ?? '');

  const contact = searchParams.get('contact');

  useEffect(() => {
    if (!contact || !user || creatingRef.current) return;
    if (contact === user.nickname) return;

    if (!isLoading && data) {
      const existing = threads.find(
        (t) =>
          t.participant_1_nickname === contact ||
          t.participant_2_nickname === contact,
      );
      if (existing) {
        router.replace(`/messages/${existing.id}`);
        return;
      }

      creatingRef.current = true;
      createThread
        .mutateAsync({ recipient_nickname: contact })
        .then((thread) => router.replace(`/messages/${thread.id}`))
        .catch(() => {
          router.replace('/messages');
        });
    }
  }, [contact, user, isLoading, data, threads, router, createThread]);

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <h1 className="text-lg font-semibold mb-4">Messages</h1>

      {isLoading || contact ? (
        <div className="rounded-lg border border-border p-1">
          <InboxSkeleton />
        </div>
      ) : threads.length === 0 ? (
        <div className="rounded-lg border border-border p-10 text-center space-y-1.5">
          <MessageSquare className="h-6 w-6 mx-auto text-muted-foreground/40" />
          <p className="text-sm font-medium">No messages yet</p>
          <p className="text-[11px] text-muted-foreground">
            Start a conversation from an exchange offer or listing.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border p-1 space-y-0.5">
          {threads.map((thread) => {
            const otherNickname =
              thread.participant_1_nickname === user?.nickname
                ? thread.participant_2_nickname
                : thread.participant_1_nickname;

            return (
              <ThreadRow
                key={thread.id}
                thread={thread}
                otherNickname={otherNickname}
                unread={user ? isThreadUnread(thread, user.nickname) : false}
                onRead={() => markThreadRead(thread.id, thread.last_message_at)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function MessagesPage() {
  return (
    <CryptoGuard>
      <MessagesInner />
    </CryptoGuard>
  );
}
