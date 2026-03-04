'use client';

import { useState } from 'react';
import { useTrades } from './use-trades';

const STORAGE_KEY = 'bartr_notif_read';

function getStoredReadAt(): Date {
  if (typeof window === 'undefined') return new Date(0);
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? new Date(stored) : new Date(0);
}

export function usePendingProposals(enabled: boolean) {
  const { data } = useTrades(
    { role: 'seller', status: 'offered' },
    { enabled, refetchInterval: 30_000 },
  );

  const [readAt, setReadAt] = useState(getStoredReadAt);

  const proposals = data?.trades ?? [];
  const hasNew = proposals.some(
    (t) => new Date(t.created_at) > readAt,
  );

  function markAllRead() {
    const now = new Date();
    setReadAt(now);
    localStorage.setItem(STORAGE_KEY, now.toISOString());
  }

  return { proposals, hasNew, markAllRead };
}
