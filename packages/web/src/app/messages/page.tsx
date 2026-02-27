'use client';

import Link from 'next/link';
import { MessageSquare, Clock } from 'lucide-react';
import { useThreads } from '@/hooks/use-messages';
import { useAuth } from '@/contexts/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
import { CryptoGuard } from '@/components/crypto-guard';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function InboxSkeleton() {
  return (
    <div className="space-y-px">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 p-4 border-b border-border">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2 min-w-0">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-3 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

function MessagesInner() {
  const { user } = useAuth();
  const { data, isLoading } = useThreads();

  const threads = data?.threads ?? [];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <MessageSquare className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Messages</h1>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-border overflow-hidden">
          <InboxSkeleton />
        </div>
      ) : threads.length === 0 ? (
        <div className="rounded-xl border border-border p-12 text-center space-y-2">
          <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/50" />
          <p className="text-sm font-medium">No messages yet</p>
          <p className="text-xs text-muted-foreground">
            When you contact a seller or receive a message, it will appear here.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
          {threads.map((thread) => {
            const otherNickname =
              thread.participant_1_nickname === user?.nickname
                ? thread.participant_2_nickname
                : thread.participant_1_nickname;

            const lastActivity = thread.last_message_at ?? thread.created_at;

            return (
              <Link
                key={thread.id}
                href={`/messages/${thread.id}`}
                className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors group"
              >
                {/* Avatar */}
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium shrink-0 group-hover:bg-primary/10 transition-colors">
                  {otherNickname.slice(0, 2).toUpperCase()}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{otherNickname}</span>
                  </div>
                  {thread.listing_title && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      re: {thread.listing_title}
                    </p>
                  )}
                </div>

                {/* Time */}
                <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                  <Clock className="h-3 w-3" />
                  {timeAgo(lastActivity)}
                </div>
              </Link>
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
