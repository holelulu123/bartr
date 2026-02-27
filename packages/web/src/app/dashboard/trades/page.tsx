'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ShoppingBag, Tag } from 'lucide-react';
import { useTrades } from '@/hooks/use-trades';
import { useAuth } from '@/contexts/auth-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { TradeSummary } from '@/lib/api';
import type { TradeStatus } from '@bartr/shared';

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_VARIANT: Record<TradeStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  offered: 'default',
  accepted: 'secondary',
  completed: 'outline',
  declined: 'destructive',
  cancelled: 'destructive',
  disputed: 'destructive',
};

function StatusBadge({ status }: { status: TradeStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? 'outline'} className="capitalize text-xs">
      {status}
    </Badge>
  );
}

// ── Trade row ─────────────────────────────────────────────────────────────────

function TradeRow({ trade, role }: { trade: TradeSummary; role: 'buyer' | 'seller' }) {
  const counterpart = role === 'buyer' ? trade.seller_nickname : trade.buyer_nickname;
  const date = new Date(trade.updated_at).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });

  return (
    <Link
      href={`/trades/${trade.id}`}
      className="flex items-center gap-4 px-4 py-3.5 hover:bg-muted/50 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{trade.listing_title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {role === 'buyer' ? 'from' : 'to'} {counterpart} · {date}
        </p>
      </div>
      <StatusBadge status={trade.status} />
      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </Link>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function TradeSkeleton() {
  return (
    <div className="divide-y divide-border">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5">
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-4 w-4 rounded" />
        </div>
      ))}
    </div>
  );
}

// ── Tab ───────────────────────────────────────────────────────────────────────

type RoleTab = 'buying' | 'selling';

function EmptyState({ role }: { role: RoleTab }) {
  return (
    <div className="py-12 text-center space-y-2">
      {role === 'buying' ? (
        <ShoppingBag className="h-7 w-7 mx-auto text-muted-foreground/50" />
      ) : (
        <Tag className="h-7 w-7 mx-auto text-muted-foreground/50" />
      )}
      <p className="text-sm font-medium">
        {role === 'buying' ? 'No purchases yet' : 'No sales yet'}
      </p>
      <p className="text-xs text-muted-foreground">
        {role === 'buying'
          ? 'Browse listings and make an offer to get started.'
          : 'When buyers make offers on your listings they appear here.'}
      </p>
      {role === 'buying' && (
        <Button asChild variant="outline" size="sm" className="mt-2">
          <Link href="/listings">Browse listings</Link>
        </Button>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TradesDashboardPage() {
  const [tab, setTab] = useState<RoleTab>('buying');

  const { data: buyingData, isLoading: buyingLoading } = useTrades({ role: 'buyer' });
  const { data: sellingData, isLoading: sellingLoading } = useTrades({ role: 'seller' });

  const buyingTrades = buyingData?.trades ?? [];
  const sellingTrades = sellingData?.trades ?? [];
  const isLoading = tab === 'buying' ? buyingLoading : sellingLoading;
  const trades = tab === 'buying' ? buyingTrades : sellingTrades;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-xl font-semibold mb-6">My Trades</h1>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg bg-muted mb-4 w-fit">
        {(['buying', 'selling'] as RoleTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'buying' ? 'Buying' : 'Selling'}
            <span className="ml-1.5 text-xs opacity-70">
              ({t === 'buying' ? buyingTrades.length : sellingTrades.length})
            </span>
          </button>
        ))}
      </div>

      {/* Trade list */}
      <div className="rounded-xl border border-border overflow-hidden">
        {isLoading ? (
          <TradeSkeleton />
        ) : trades.length === 0 ? (
          <EmptyState role={tab} />
        ) : (
          <div className="divide-y divide-border">
            {trades.map((trade) => (
              <TradeRow
                key={trade.id}
                trade={trade}
                role={tab === 'buying' ? 'buyer' : 'seller'}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
