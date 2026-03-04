'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Star,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react';
import { useMessageSidebar } from '@/contexts/message-sidebar-context';
import {
  useTrade,
  useAcceptTrade,
  useDeclineTrade,
  useCancelTrade,
  useCompleteTrade,
  useRateTrade,
} from '@/hooks/use-trades';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
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
    <Badge variant={STATUS_VARIANT[status] ?? 'outline'} className="capitalize">
      {status}
    </Badge>
  );
}

// ── Timeline event ────────────────────────────────────────────────────────────

const EVENT_ICONS: Record<string, React.ReactNode> = {
  offered: <Clock className="h-4 w-4 text-blue-500" />,
  accepted: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  declined: <XCircle className="h-4 w-4 text-red-500" />,
  cancelled: <XCircle className="h-4 w-4 text-red-500" />,
  complete_confirmed: <CheckCircle2 className="h-4 w-4 text-green-400" />,
  completed: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  disputed: <AlertTriangle className="h-4 w-4 text-amber-500" />,
};

const EVENT_LABELS: Record<string, string> = {
  offered: 'Offer made',
  accepted: 'Offer accepted',
  declined: 'Offer declined',
  cancelled: 'Trade cancelled',
  complete_confirmed: 'Completion confirmed',
  completed: 'Trade completed',
  disputed: 'Dispute opened',
};

function TimelineEvent({
  event,
}: {
  event: { id: string; event_type: string; created_by: string; created_at: string };
}) {
  const icon = EVENT_ICONS[event.event_type] ?? <Clock className="h-4 w-4 text-muted-foreground" />;
  const label = EVENT_LABELS[event.event_type] ?? event.event_type;
  const time = new Date(event.created_at).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{time}</p>
      </div>
    </div>
  );
}

// ── Rating dialog ─────────────────────────────────────────────────────────────

function RatingDialog({
  open,
  onClose,
  tradeId,
}: {
  open: boolean;
  onClose: () => void;
  tradeId: string;
}) {
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState('');
  const rateMutation = useRateTrade();

  async function handleSubmit() {
    await rateMutation.mutateAsync({ tradeId, payload: { score, comment: comment || undefined } });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Leave a rating</DialogTitle>
          <DialogDescription>How was your experience with this trade?</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Star picker */}
          <div className="flex items-center gap-1 justify-center">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onClick={() => setScore(s)}
                className="focus:outline-none"
                aria-label={`${s} star${s !== 1 ? 's' : ''}`}
              >
                <Star
                  className={`h-7 w-7 transition-colors ${
                    s <= score
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-muted-foreground'
                  }`}
                />
              </button>
            ))}
          </div>

          <Textarea
            placeholder="Optional comment…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={500}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={rateMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={rateMutation.isPending}>
            {rateMutation.isPending ? 'Submitting…' : 'Submit rating'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function TradeDetailSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <Skeleton className="h-4 w-24" />
      <div className="rounded-xl border border-border p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="space-y-1">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TradeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [ratingOpen, setRatingOpen] = useState(false);
  const [actionError, setActionError] = useState('');

  const { openSidebar } = useMessageSidebar();
  const { data: trade, isLoading, isError } = useTrade(id);
  const acceptMutation = useAcceptTrade();
  const declineMutation = useDeclineTrade();
  const cancelMutation = useCancelTrade();
  const completeMutation = useCompleteTrade();

  if (isLoading) return <TradeDetailSkeleton />;

  if (isError || !trade) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <p className="font-medium">Trade not found</p>
        <Button asChild variant="outline">
          <Link href="/dashboard/trades">My trades</Link>
        </Button>
      </div>
    );
  }

  const isBuyer = user?.id === trade.buyer_id;
  const isSeller = user?.id === trade.seller_id;

  async function runAction(fn: () => Promise<unknown>) {
    setActionError('');
    try {
      await fn();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Action failed');
    }
  }

  // Determine whether this user has already confirmed completion
  const hasConfirmedComplete = trade.events.some(
    (ev) => ev.event_type === 'complete_confirmed' && ev.created_by === user?.id,
  );

  const isTerminal = ['completed', 'declined', 'cancelled'].includes(trade.status);
  const canRate = trade.status === 'completed' && !isTerminal;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <Link
        href="/dashboard/trades"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        My trades
      </Link>

      {/* Trade card */}
      <div className="rounded-xl border border-border p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold leading-snug">{trade.listing_title}</h1>
            <p className="text-xs text-muted-foreground mt-1">Trade #{trade.id.slice(0, 8)}</p>
          </div>
          <StatusBadge status={trade.status} />
        </div>

        {/* Participants */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Buyer</p>
            <Link href={`/user/${trade.buyer_nickname}`} className="font-medium hover:underline">
              {trade.buyer_nickname}
            </Link>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Seller</p>
            <Link href={`/user/${trade.seller_nickname}`} className="font-medium hover:underline">
              {trade.seller_nickname}
            </Link>
          </div>
        </div>

        {/* Message button */}
        <div className="pt-1">
          <Button variant="outline" size="sm" onClick={openSidebar}>
            <MessageSquare className="h-4 w-4 mr-2" />
            Open chat
          </Button>
        </div>
      </div>

      {/* Actions */}
      {!isTerminal && (
        <div className="rounded-xl border border-border p-5 space-y-3">
          <p className="text-sm font-medium">Actions</p>

          {actionError && (
            <p className="text-xs text-destructive">{actionError}</p>
          )}

          {/* Seller actions on offered trade */}
          {isSeller && trade.status === 'offered' && (
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => runAction(() => acceptMutation.mutateAsync(id))}
                disabled={acceptMutation.isPending}
              >
                {acceptMutation.isPending ? 'Accepting…' : 'Accept offer'}
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => runAction(() => declineMutation.mutateAsync(id))}
                disabled={declineMutation.isPending}
              >
                {declineMutation.isPending ? 'Declining…' : 'Decline'}
              </Button>
            </div>
          )}

          {/* Buyer cancel on offered/accepted */}
          {isBuyer && ['offered', 'accepted'].includes(trade.status) && (
            <Button
              variant="destructive"
              onClick={() => runAction(() => cancelMutation.mutateAsync(id))}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? 'Cancelling…' : 'Cancel trade'}
            </Button>
          )}

          {/* Both confirm completion on accepted */}
          {(isBuyer || isSeller) && trade.status === 'accepted' && !hasConfirmedComplete && (
            <Button
              variant="outline"
              onClick={() => runAction(() => completeMutation.mutateAsync(id))}
              disabled={completeMutation.isPending}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {completeMutation.isPending ? 'Confirming…' : 'Confirm completion'}
            </Button>
          )}
          {(isBuyer || isSeller) && trade.status === 'accepted' && hasConfirmedComplete && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              You confirmed completion. Waiting for the other party.
            </p>
          )}
        </div>
      )}

      {/* Rate completed trade */}
      {trade.status === 'completed' && (
        <div className="rounded-xl border border-border p-5">
          <p className="text-sm font-medium mb-3">Rate this trade</p>
          <Button variant="outline" size="sm" onClick={() => setRatingOpen(true)}>
            <Star className="h-4 w-4 mr-2" />
            Leave a rating
          </Button>
        </div>
      )}

      {/* Event timeline */}
      <div className="rounded-xl border border-border p-5 space-y-4">
        <p className="text-sm font-medium">Timeline</p>
        <div className="space-y-3">
          {trade.events.map((ev) => (
            <TimelineEvent key={ev.id} event={ev} />
          ))}
        </div>
      </div>

      {/* Rating dialog */}
      <RatingDialog
        open={ratingOpen}
        onClose={() => setRatingOpen(false)}
        tradeId={id}
      />
    </div>
  );
}
