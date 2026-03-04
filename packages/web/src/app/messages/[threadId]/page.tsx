'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Star } from 'lucide-react';
import { useThreads } from '@/hooks/use-messages';
import { useAuth } from '@/contexts/auth-context';
import { useUser } from '@/hooks/use-users';
import { useUnreadThreads } from '@/hooks/use-unread-threads';
import { UserAvatar } from '@/components/user-avatar';
import { ChatPanel } from '@/components/chat-panel';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CryptoGuard } from '@/components/crypto-guard';
import { cn } from '@/lib/utils';

function ChatHeader({ nickname, listingTitle, offerSummary }: { nickname: string; listingTitle: string | null; offerSummary: string | null }) {
  const { data: profile } = useUser(nickname);
  const rating = profile?.reputation?.rating_avg ?? 0;
  const stars = Math.round(rating);
  const contextLabel = listingTitle || offerSummary;

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
        {contextLabel && (
          <p className="text-xs text-muted-foreground truncate leading-tight">
            re: {contextLabel}
          </p>
        )}
      </div>
    </div>
  );
}

function ChatInner() {
  const { threadId } = useParams<{ threadId: string }>();
  const { user } = useAuth();
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
      ? threadMeta?.participant_2_nickname
      : threadMeta?.participant_1_nickname;

  if (!otherNickname) {
    return (
      <div className="max-w-xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
        <div className="flex items-center gap-2.5 px-3 py-2 border-b border-border shrink-0">
          <Link href="/messages" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Skeleton className="h-7 w-7 rounded-full" />
          <Skeleton className="h-3.5 w-28" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      <ChatHeader
        nickname={otherNickname}
        listingTitle={threadMeta?.listing_title ?? null}
        offerSummary={threadMeta?.offer_summary ?? null}
      />
      <ChatPanel
        threadId={threadId}
        recipientNickname={otherNickname}
        className="flex-1 min-h-0"
      />
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
