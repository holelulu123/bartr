'use client';

import { useState } from 'react';
import { useTrades } from './use-trades';
import type { TradeSummary } from '@/lib/api';

const STORAGE_KEY = 'bartr_notif_read';
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function getStoredReadAt(): Date {
  if (typeof window === 'undefined') return new Date(0);
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? new Date(stored) : new Date(0);
}

export interface Notification {
  id: string;
  type: 'incoming_offer' | 'offer_accepted' | 'offer_declined';
  trade: TradeSummary;
  timestamp: string;
}

export function usePendingProposals(enabled: boolean) {
  // Fetch ALL trades as seller (any status) — captures incoming offers even after accept/decline
  const { data: sellerData } = useTrades(
    { role: 'seller', limit: 50 },
    { enabled, refetchInterval: 30_000 },
  );

  // Fetch ALL trades as buyer (any status) — captures accepted/declined responses
  const { data: buyerData } = useTrades(
    { role: 'buyer', limit: 50 },
    { enabled, refetchInterval: 30_000 },
  );

  const [readAt, setReadAt] = useState(getStoredReadAt);

  const cutoff = new Date(Date.now() - ONE_WEEK_MS).toISOString();

  // Build unified notification list from all trades in the last week
  const all: Notification[] = [];

  for (const t of (sellerData?.trades ?? []).filter((t) => t.offer_id && t.offer_summary)) {
    // Every trade where I'm seller = someone offered me
    if (t.created_at >= cutoff) {
      all.push({ id: `offer-${t.id}`, type: 'incoming_offer', trade: t, timestamp: t.created_at });
    }
  }

  for (const t of (buyerData?.trades ?? []).filter((t) => t.offer_id && t.offer_summary)) {
    // Trades where I'm buyer and status changed to accepted or declined
    if (t.status === 'accepted' || t.status === 'completed') {
      if (t.updated_at >= cutoff) {
        all.push({ id: `accepted-${t.id}`, type: 'offer_accepted', trade: t, timestamp: t.updated_at });
      }
    } else if (t.status === 'declined') {
      if (t.updated_at >= cutoff) {
        all.push({ id: `declined-${t.id}`, type: 'offer_declined', trade: t, timestamp: t.updated_at });
      }
    }
  }

  all.sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1));

  const hasNew = all.some((n) => new Date(n.timestamp) > readAt);

  function markAllRead() {
    const now = new Date();
    setReadAt(now);
    localStorage.setItem(STORAGE_KEY, now.toISOString());
  }

  return { notifications: all, hasNew, hasMore: false, loadMore: () => {}, markAllRead };
}
