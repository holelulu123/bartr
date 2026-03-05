'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, MessageSquare, X } from 'lucide-react';
import { useMessageSidebar } from '@/contexts/message-sidebar-context';
import { useThreads, useCreateThread } from '@/hooks/use-messages';
import { useAuth } from '@/contexts/auth-context';
import { useCrypto } from '@/contexts/crypto-context';
import { useUnreadThreads, isThreadUnread } from '@/hooks/use-unread-threads';
import { useTradesForOffer, useAcceptTrade, useDeclineTrade } from '@/hooks/use-trades';
import { UserAvatar } from '@/components/user-avatar';
import { ChatPanel } from '@/components/chat-panel';
import type { TradeAction } from '@/components/chat-panel';
import { CryptoGuard } from '@/components/crypto-guard';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, fmtAmount } from '@/lib/utils';
import { messages as messagesApi, users as usersApi } from '@/lib/api';
import { SETTLEMENT_METHOD_LABELS } from '@bartr/shared';
import type { SettlementMethod } from '@bartr/shared';
import type { MessageThread } from '@/lib/api';

const CRYPTO_COLORS: Record<string, string> = {
  BTC: 'text-orange-500',
  ETH: 'text-indigo-400',
  SOL: 'text-fuchsia-500',
  XRP: 'text-slate-400',
  USDT: 'text-emerald-500',
  USDC: 'text-blue-400',
};

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
  myNickname,
  unread,
  selected,
  onSelect,
}: {
  thread: MessageThread;
  myNickname: string;
  unread: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const otherNickname = thread.participant_1_nickname === myNickname
    ? thread.participant_2_nickname
    : thread.participant_1_nickname;
  const activity = thread.last_message_at ?? thread.created_at;
  const linkHref = thread.offer_id ? `/exchange/${thread.offer_id}` : null;

  const crypto = thread.offer_crypto;
  const fiat = thread.offer_fiat;
  const tradeFiatAmount = thread.trade_fiat_amount ? Number(thread.trade_fiat_amount) : null;
  const tradeStatus = thread.trade_status;

  // Hide threads with no offer_summary (deleted/removed offers)
  const hasContext = !!(thread.offer_summary || thread.listing_title);
  if (!hasContext && thread.offer_id) return null;

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
        <UserAvatar nickname={otherNickname} size={32} />
        {unread && (
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-orange-500 border-2 border-background" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5 truncate">
          <span className={cn('text-sm', unread ? 'font-semibold' : 'font-medium')}>
            {otherNickname}
          </span>
          {tradeStatus && tradeStatus !== 'offered' && (
            <span className={cn(
              'text-[11px] font-semibold',
              tradeStatus === 'accepted' ? 'text-green-500' : tradeStatus === 'completed' ? 'text-blue-500' : tradeStatus === 'declined' ? 'text-red-500' : 'text-muted-foreground',
            )}>
              {tradeStatus === 'accepted' ? 'Accepted' : tradeStatus === 'completed' ? 'Completed' : tradeStatus === 'declined' ? 'Declined' : ''}
            </span>
          )}
        </span>
        <span className="text-sm truncate block leading-tight">
          {crypto && fiat ? (
            tradeFiatAmount ? (
              <span className="text-muted-foreground">{fmtAmount(tradeFiatAmount)} {fiat} for {crypto}</span>
            ) : (
              <span className="text-muted-foreground">{crypto}/{fiat}</span>
            )
          ) : thread.listing_title ? (
            <span className="text-muted-foreground">{thread.listing_title}</span>
          ) : null}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground">
          {timeAgo(activity)}
        </span>
        {linkHref && (
          <Link
            href={linkHref}
            onClick={(e) => e.stopPropagation()}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label="Go to contract"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        )}
      </div>
    </button>
  );
}

function SidebarChatHeader({ nickname, offerId, onBack, onClose }: {
  nickname: string;
  offerId: string | null;
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
      {offerId && (
        <Link
          href={`/exchange/${offerId}`}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
          aria-label="Go to contract"
        >
          <ExternalLink className="h-4 w-4" />
        </Link>
      )}
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

  // Sort threads by most recent activity
  const sortedThreads = useMemo(() => {
    return [...threads].sort((a, b) => {
      const aTime = a.last_message_at ?? a.created_at;
      const bTime = b.last_message_at ?? b.created_at;
      return bTime > aTime ? 1 : bTime < aTime ? -1 : 0;
    });
  }, [threads]);

  // Find selected thread
  const activeThread = selectedThreadId
    ? threads.find((t) => t.id === selectedThreadId)
    : null;

  const activeNickname = activeThread
    ? (activeThread.participant_1_nickname === myNickname
      ? activeThread.participant_2_nickname
      : activeThread.participant_1_nickname)
    : pendingContact?.nickname ?? null;

  // Mark thread as read when selected
  useEffect(() => {
    if (activeThread) {
      markThreadRead(activeThread.id, activeThread.last_message_at);
    }
  }, [activeThread, markThreadRead]);

  // Handle pendingContact: find or create thread
  useEffect(() => {
    if (!pendingContact || !user || creatingRef.current) return;
    if (pendingContact.nickname === user.nickname) return;

    if (!isLoading && data) {
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

  function selectThread(thread: MessageThread) {
    markThreadRead(thread.id, thread.last_message_at);
    openThread(thread.id);
  }

  // Trade action for offer-linked threads (accept/decline in chat)
  const offerId = activeThread?.offer_id ?? '';
  const { data: tradesData } = useTradesForOffer(offerId);
  const acceptTrade = useAcceptTrade();
  const declineTrade = useDeclineTrade();
  const createThreadForAction = useCreateThread();
  const { encrypt } = useCrypto();

  const sidebarTradeAction: TradeAction | undefined = useMemo(() => {
    if (!tradesData || !activeNickname || !offerId || !user) return undefined;
    const trade = tradesData.trades.find(
      (t) => t.buyer_nickname === activeNickname && t.seller_id === user.id,
    );
    if (!trade) return undefined;
    return {
      tradeId: trade.id,
      status: trade.status,
      isPending: acceptTrade.isPending || declineTrade.isPending,
      onAccept: async (tradeId: string) => {
        await acceptTrade.mutateAsync(tradeId);
        const methodLabel = trade.payment_method
          ? (SETTLEMENT_METHOD_LABELS[trade.payment_method as SettlementMethod] ?? trade.payment_method)
          : '';
        const parts = (trade.offer_summary ?? '').split(' ');
        const [cryptoCurrency, fiatCurrency] = (parts[1] ?? '/').split('/');
        const details = trade.fiat_amount
          ? `${fmtAmount(trade.fiat_amount)} ${fiatCurrency || ''} for ${cryptoCurrency || ''}${methodLabel ? ` via ${methodLabel}` : ''}`
          : '';
        const autoMsg = `[SYSTEM] Accepted: ${details}`;
        try {
          const thread = await createThreadForAction.mutateAsync({
            recipient_nickname: activeNickname,
            offer_id: offerId,
          });
          const { public_key } = await usersApi.getUserPublicKey(activeNickname);
          const encrypted = await encrypt(autoMsg, public_key);
          await messagesApi.sendMessage(thread.id, encrypted);
        } catch { /* non-critical */ }
      },
      onDecline: async (tradeId: string) => {
        await declineTrade.mutateAsync(tradeId);
        const methodLabel = trade.payment_method
          ? (SETTLEMENT_METHOD_LABELS[trade.payment_method as SettlementMethod] ?? trade.payment_method)
          : '';
        const parts = (trade.offer_summary ?? '').split(' ');
        const [cryptoCurrency, fiatCurrency] = (parts[1] ?? '/').split('/');
        const details = trade.fiat_amount
          ? `${fmtAmount(trade.fiat_amount)} ${fiatCurrency || ''} for ${cryptoCurrency || ''}${methodLabel ? ` via ${methodLabel}` : ''}`
          : '';
        const autoMsg = `[SYSTEM] Declined: ${details}`;
        try {
          const thread = await createThreadForAction.mutateAsync({
            recipient_nickname: activeNickname,
            offer_id: offerId,
          });
          const { public_key } = await usersApi.getUserPublicKey(activeNickname);
          const encrypted = await encrypt(autoMsg, public_key);
          await messagesApi.sendMessage(thread.id, encrypted);
        } catch { /* non-critical */ }
      },
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradesData, activeNickname, offerId, user?.id, acceptTrade.isPending, declineTrade.isPending]);

  // Determine if chat is locked (offer-linked thread with non-accepted trade)
  const sidebarChatLocked = useMemo(() => {
    if (!tradesData || !offerId || !activeNickname || !user) return false;
    const trade = tradesData.trades.find(
      (t) =>
        (t.buyer_nickname === activeNickname && t.seller_id === user.id) ||
        (t.buyer_id === user.id && t.seller_nickname === activeNickname),
    );
    if (!trade) return false;
    return trade.status !== 'accepted';
  }, [tradesData, offerId, activeNickname, user?.id]);

  const sidebarLockedMessage = useMemo(() => {
    if (!tradesData || !offerId || !activeNickname || !user) return '';
    const trade = tradesData.trades.find(
      (t) =>
        (t.buyer_nickname === activeNickname && t.seller_id === user.id) ||
        (t.buyer_id === user.id && t.seller_nickname === activeNickname),
    );
    if (!trade) return '';
    if (trade.status === 'declined') return 'This offer was declined.';
    if (trade.seller_id === user.id) return 'Accept the offer to start chatting.';
    return 'Waiting for the seller to accept your offer\u2026';
  }, [tradesData, offerId, activeNickname, user?.id]);

  // Conversation view
  if (activeNickname && activeThread) {
    return (
      <div className="flex flex-col h-full">
        <SidebarChatHeader
          nickname={activeNickname}
          offerId={activeThread.offer_id}
          onBack={clearSelection}
          onClose={closeSidebar}
        />
        <ChatPanel
          key={activeThread.id}
          threadId={activeThread.id}
          recipientNickname={activeNickname}
          className="flex-1 min-h-0"
          tradeAction={sidebarTradeAction}
          chatLocked={sidebarChatLocked}
          chatLockedMessage={sidebarLockedMessage}
        />
      </div>
    );
  }

  // Thread list view
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
        ) : sortedThreads.length === 0 ? (
          <div className="p-10 text-center space-y-1.5">
            <MessageSquare className="h-6 w-6 mx-auto text-muted-foreground/40" />
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-[11px] text-muted-foreground">
              Start a conversation from an exchange offer or listing.
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {sortedThreads.map((thread) => (
              <ThreadRow
                key={thread.id}
                thread={thread}
                myNickname={myNickname}
                unread={isThreadUnread(thread, myNickname)}
                selected={selectedThreadId === thread.id}
                onSelect={() => selectThread(thread)}
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
