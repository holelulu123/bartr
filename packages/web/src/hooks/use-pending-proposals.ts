'use client';

import { useState } from 'react';
import { useTrades } from './use-trades';
import type { TradeSummary } from '@/lib/api';

const STORAGE_KEY = 'bartr_notif_read';
const PAGE_SIZE = 7; // days per "page"

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
  // Seller: incoming offers (status=offered)
  const { data: sellerData } = useTrades(
    { role: 'seller', status: 'offered' },
    { enabled, refetchInterval: 30_000 },
  );

  // Buyer: accepted offers
  const { data: buyerAccepted } = useTrades(
    { role: 'buyer', status: 'accepted' },
    { enabled, refetchInterval: 30_000 },
  );

  // Buyer: declined offers
  const { data: buyerDeclined } = useTrades(
    { role: 'buyer', status: 'declined' },
    { enabled, refetchInterval: 30_000 },
  );

  const [readAt, setReadAt] = useState(getStoredReadAt);
  const [daysShown, setDaysShown] = useState(PAGE_SIZE);

  // Build unified notification list
  const all: Notification[] = [];

  for (const t of (sellerData?.trades ?? []).filter((t) => t.offer_id && t.offer_summary)) {
    all.push({ id: `offer-${t.id}`, type: 'incoming_offer', trade: t, timestamp: t.created_at });
  }

  for (const t of (buyerAccepted?.trades ?? []).filter((t) => t.offer_id && t.offer_summary)) {
    all.push({ id: `accepted-${t.id}`, type: 'offer_accepted', trade: t, timestamp: t.updated_at });
  }

  for (const t of (buyerDeclined?.trades ?? []).filter((t) => t.offer_id && t.offer_summary)) {
    all.push({ id: `declined-${t.id}`, type: 'offer_declined', trade: t, timestamp: t.updated_at });
  }

  all.sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1));

  // Filter to current window
  const cutoff = new Date(Date.now() - daysShown * 24 * 60 * 60 * 1000).toISOString();
  const visible = all.filter((n) => n.timestamp >= cutoff);
  const hasMore = all.length > visible.length;

  const hasNew = all.some((n) => new Date(n.timestamp) > readAt);

  function markAllRead() {
    const now = new Date();
    setReadAt(now);
    localStorage.setItem(STORAGE_KEY, now.toISOString());
  }

  function loadMore() {
    setDaysShown((d) => d + PAGE_SIZE);
  }

  return { notifications: visible, hasNew, hasMore, loadMore, markAllRead };
}
