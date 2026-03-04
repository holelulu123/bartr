'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MessageSquare, X } from 'lucide-react';
import { useMessageSidebar } from '@/contexts/message-sidebar-context';
import { useThreads, useCreateThread } from '@/hooks/use-messages';
import { useAuth } from '@/contexts/auth-context';
import { useUnreadThreads, isThreadUnread } from '@/hooks/use-unread-threads';
import { UserAvatar } from '@/components/user-avatar';
import { ChatPanel } from '@/components/chat-panel';
import { CryptoGuard } from '@/components/crypto-guard';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { MessageThread } from '@/lib/api';

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

/** Group threads by the other participant nickname. Returns one entry per person sorted by most recent activity. */
function groupByPerson(threads: MessageThread[], myNickname: string) {
  const map = new Map<string, { nickname: string; threads: MessageThread[]; lastActivity: string; hasUnread: boolean }>();

  for (const t of threads) {
    const other = t.participant_1_nickname === myNickname ? t.participant_2_nickname : t.participant_1_nickname;
    const entry = map.get(other);
    const activity = t.last_message_at ?? t.created_at;
    const unread = isThreadUnread(t, myNickname);

    if (entry) {
      entry.threads.push(t);
      if (activity > entry.lastActivity) entry.lastActivity = activity;
      if (unread) entry.hasUnread = true;
    } else {
      map.set(other, { nickname: other, threads: [t], lastActivity: activity, hasUnread: unread });
    }
  }

  return [...map.values()].sort((a, b) => (a.lastActivity > b.lastActivity ? -1 : 1));
}

function PersonRow({
  nickname,
  lastActivity,
  unread,
  selected,
  onSelect,
}: {
  nickname: string;
  lastActivity: string;
  unread: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left',
        selected
          ? 'bg-primary/10'
          : unread
            ? 'bg-primary/5'
            : 'hover:bg-muted/50',
      )}
    >
      <div className="relative shrink-0">
        <UserAvatar nickname={nickname} size={32} />
        {unread && (
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-orange-500 border-2 border-background" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <span className={cn('text-sm truncate block', unread ? 'font-semibold' : 'font-medium')}>
          {nickname}
        </span>
      </div>

      <span className="text-xs text-muted-foreground shrink-0">
        {timeAgo(lastActivity)}
      </span>
    </button>
  );
}

function SidebarChatHeader({ nickname, onBack, onClose }: {
  nickname: string;
  onBack: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
      <button
        type="button"
        onClick={onBack}
        className="p-1 rounded-md text-muted-foreground hover:text-foreground"
        aria-label="Back to threads"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <UserAvatar nickname={nickname} size={28} />
      <div className="min-w-0 flex-1">
        <Link href={`/user/${nickname}`} className="font-medium text-sm truncate hover:underline block">
          {nickname}
        </Link>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="p-1 rounded-md text-muted-foreground hover:text-foreground"
        aria-label="Close messages"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function SidebarContent() {
  const { user } = useAuth();
  const { isOpen, selectedThreadId, pendingContact, closeSidebar, openThread, clearSelection } = useMessageSidebar();
  const { data, isLoading } = useThreads({ enabled: isOpen });
  const createThread = useCreateThread();
  const creatingRef = useRef(false);

  const threads = data?.threads ?? [];
  const { markThreadRead } = useUnreadThreads(threads, user?.nickname ?? '');

  const myNickname = user?.nickname ?? '';

  // Group threads by person
  const personGroups = useMemo(() => groupByPerson(threads, myNickname), [threads, myNickname]);

  // Resolve selectedThreadId to a nickname (for thread-based selection from redirects)
  const selectedFromThread = selectedThreadId
    ? threads.find((t) => t.id === selectedThreadId)
    : null;
  const resolvedNickname = selectedFromThread
    ? (selectedFromThread.participant_1_nickname === myNickname
      ? selectedFromThread.participant_2_nickname
      : selectedFromThread.participant_1_nickname)
    : null;

  // Pending contact nickname
  const activeNickname = resolvedNickname ?? pendingContact?.nickname ?? null;

  // Find the most recent thread for the active person (used for ChatPanel)
  const activeGroup = activeNickname ? personGroups.find((g) => g.nickname === activeNickname) : null;
  const activeThread = activeGroup
    ? activeGroup.threads.sort((a, b) => {
        const aTime = a.last_message_at ?? a.created_at;
        const bTime = b.last_message_at ?? b.created_at;
        return bTime > aTime ? 1 : -1;
      })[0]
    : null;

  // Mark all threads for this person as read when selected
  useEffect(() => {
    if (activeGroup) {
      for (const t of activeGroup.threads) {
        markThreadRead(t.id, t.last_message_at);
      }
    }
  }, [activeNickname, activeGroup, markThreadRead]);

  // Handle pendingContact: find or create thread
  useEffect(() => {
    if (!pendingContact || !user || creatingRef.current) return;
    if (pendingContact.nickname === user.nickname) return;

    if (!isLoading && data) {
      // If there's already a thread with this person, just open it
      const existing = threads.find(
        (t) =>
          t.participant_1_nickname === pendingContact.nickname ||
          t.participant_2_nickname === pendingContact.nickname,
      );
      if (existing) {
        openThread(existing.id);
        return;
      }

      creatingRef.current = true;
      createThread
        .mutateAsync({
          recipient_nickname: pendingContact.nickname,
        })
        .then((thread) => {
          openThread(thread.id);
        })
        .catch(() => {
          // stay on thread list
        })
        .finally(() => {
          creatingRef.current = false;
        });
    }
  }, [pendingContact, user, isLoading, data, threads, openThread, createThread]);

  function selectPerson(nickname: string, group: { threads: MessageThread[] }) {
    // Mark all threads for this person as read
    for (const t of group.threads) {
      markThreadRead(t.id, t.last_message_at);
    }
    // Open the most recent thread
    const mostRecent = group.threads.sort((a, b) => {
      const aTime = a.last_message_at ?? a.created_at;
      const bTime = b.last_message_at ?? b.created_at;
      return bTime > aTime ? 1 : -1;
    })[0];
    openThread(mostRecent.id);
  }

  // Conversation view
  if (activeNickname && activeThread) {
    return (
      <div className="flex flex-col h-full">
        <SidebarChatHeader
          nickname={activeNickname}
          onBack={clearSelection}
          onClose={closeSidebar}
        />
        <ChatPanel
          key={activeThread.id}
          threadId={activeThread.id}
          recipientNickname={activeNickname}
          className="flex-1 min-h-0"
        />
      </div>
    );
  }

  // Thread list view (grouped by person)
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <h2 className="text-lg font-semibold">Messages</h2>
        <button
          type="button"
          onClick={closeSidebar}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground"
          aria-label="Close messages"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-1">
        {isLoading || pendingContact ? (
          <InboxSkeleton />
        ) : personGroups.length === 0 ? (
          <div className="p-10 text-center space-y-1.5">
            <MessageSquare className="h-6 w-6 mx-auto text-muted-foreground/40" />
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-[11px] text-muted-foreground">
              Start a conversation from an exchange offer or listing.
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {personGroups.map((group) => (
              <PersonRow
                key={group.nickname}
                nickname={group.nickname}
                lastActivity={group.lastActivity}
                unread={group.hasUnread}
                selected={activeNickname === group.nickname}
                onSelect={() => selectPerson(group.nickname, group)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function MessageSidebar() {
  const { isOpen, closeSidebar } = useMessageSidebar();
  const [footerHeight, setFooterHeight] = useState(0);

  // Measure footer height dynamically
  useEffect(() => {
    const footer = document.querySelector('[data-footer]');
    if (!footer) return;

    const observer = new ResizeObserver(([entry]) => {
      setFooterHeight(entry.contentRect.height + 1); // +1 for the border-t
    });
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  // Escape key closes widget
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeSidebar();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, closeSidebar]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed right-16 w-[320px] max-w-[calc(100vw-2rem)] h-[350px] bg-background border border-border rounded-t-xl z-[61] shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
      style={{ bottom: `${footerHeight}px`, maxHeight: `calc(100vh - 5rem - ${footerHeight}px)` }}
      role="dialog"
      aria-label="Messages"
    >
      <CryptoGuard>
        <SidebarContent />
      </CryptoGuard>
    </div>
  );
}
