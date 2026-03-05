'use client';

import { useState, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ArrowUp, ArrowDown, Star, Pause, Play, Trash2,
  Lock, LogIn, MessageSquare, Check, X, ShieldAlert,
} from 'lucide-react';
import { useOffer, useUpdateOffer, useDeleteOffer } from '@/hooks/use-exchange';
import { useUser } from '@/hooks/use-users';
import { useAuth } from '@/contexts/auth-context';
import { useCrypto } from '@/contexts/crypto-context';
import { usePrices } from '@/hooks/use-prices';
import { useCreateExchangeTrade, useTradesForOffer, useAcceptTrade, useDeclineTrade, useRateTrade } from '@/hooks/use-trades';
import { useCreateThread } from '@/hooks/use-messages';
import { messages as messagesApi, users as usersApi } from '@/lib/api';
import { CoinIcon } from '@/components/crypto-icons';
import { ReputationBadge } from '@/components/reputation-badge';
import { HalfStarPicker } from '@/components/half-star-picker';
import { getCountryFlag, getCountryName } from '@/lib/countries';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError } from '@/lib/api/client';
import { cn, fmtAmount } from '@/lib/utils';
import { SETTLEMENT_METHOD_LABELS } from '@bartr/shared';
import type { SettlementMethod } from '@bartr/shared';
import type { TradeSummary } from '@/lib/api';

const fmt = fmtAmount;

function MiniIdenticon({ seed, size = 32 }: { seed: string; size?: number }) {
  const cells = 5;
  const cellSize = size / cells;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = Math.imul(31, hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const h = ((hash >>> 0) * 2654435761) >>> 0;
  const hue1 = h % 360;
  const hue2 = (hue1 + 150) % 360;
  const fg = `hsl(${hue1},65%,55%)`;
  const bg = `hsl(${hue2},30%,18%)`;

  const grid: boolean[][] = Array.from({ length: cells }, (_, r) =>
    Array.from({ length: cells }, (_, c) => {
      const col = c < Math.ceil(cells / 2) ? c : cells - 1 - c;
      return ((h >>> (r * Math.ceil(cells / 2) + col)) & 1) === 1;
    }),
  );

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ borderRadius: '50%' }}>
      <rect width={size} height={size} fill={bg} />
      {grid.map((row, r) =>
        row.map((on, c) =>
          on ? <rect key={`${r}-${c}`} x={c * cellSize} y={r * cellSize} width={cellSize} height={cellSize} fill={fg} /> : null,
        ),
      )}
    </svg>
  );
}

function OfferDetailSkeleton() {
  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6" aria-label="Loading">
      <div className="h-5 w-32 bg-muted animate-pulse rounded" />
      <div className="h-8 w-64 bg-muted animate-pulse rounded" />
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ── Trade Profile Card ──────────────────────────────────────────────────────

function TradeProfileCard({ nickname }: { nickname: string }) {
  const { data: profile } = useUser(nickname);

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Link href={`/user/${nickname}`} className="shrink-0">
          <MiniIdenticon seed={nickname} size={40} />
        </Link>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/user/${nickname}`}
              className="text-sm font-medium hover:underline truncate"
            >
              {nickname}
            </Link>
            {profile && <ReputationBadge tier={profile.reputation.tier} />}
          </div>
          {profile && (
            <div className="flex items-center gap-1.5 mt-1">
              <HalfStarPicker value={profile.reputation.rating_avg} readOnly size={16} />
              <span className="text-sm text-muted-foreground">
                {profile.reputation.rating_avg.toFixed(1)}
              </span>
              <span className="text-sm text-muted-foreground">
                · Score: {profile.reputation.composite_score}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Rating Section ──────────────────────────────────────────────────────────

function RatingSection({ tradeId, tradeStatus }: { tradeId: string; tradeStatus: string }) {
  const [score, setScore] = useState(2.5);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const rateMutation = useRateTrade();

  const isCompleted = tradeStatus === 'completed';

  async function handleSubmit() {
    await rateMutation.mutateAsync({
      tradeId,
      payload: { score, comment: comment || undefined },
    });
    setSubmitted(true);
  }

  return (
    <div className={cn('p-4 border-t border-border space-y-3', !isCompleted && 'opacity-50')}>
      <h4 className="text-sm font-semibold">Rate this trade</h4>

      {!isCompleted && (
        <p className="text-xs text-muted-foreground">Complete the trade to leave a rating</p>
      )}

      {isCompleted && submitted && (
        <p className="text-xs text-green-500">Rating submitted. Thank you!</p>
      )}

      {isCompleted && !submitted && (
        <>
          <div className="flex items-center gap-2">
            <HalfStarPicker value={score} onChange={setScore} size={24} />
            <span className="text-sm text-muted-foreground">{score.toFixed(1)}</span>
          </div>
          <textarea
            placeholder="Optional comment..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            maxLength={500}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            disabled={!isCompleted}
          />
          <Button
            size="sm"
            className="w-full"
            onClick={handleSubmit}
            disabled={rateMutation.isPending}
          >
            {rateMutation.isPending ? 'Submitting...' : 'Submit rating'}
          </Button>
          {rateMutation.isError && (
            <p className="text-xs text-destructive">
              {rateMutation.error instanceof ApiError && rateMutation.error.body && typeof rateMutation.error.body === 'object' && 'error' in rateMutation.error.body
                ? String((rateMutation.error.body as { error: string }).error)
                : 'Failed to submit rating'}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ── Trade Proposal Row (for owner view) ─────────────────────────────────────

function TradeProposalRow({
  trade,
  fiatCurrency,
  cryptoCurrency,
  offerId,
  onSelect,
  isSelected,
}: {
  trade: TradeSummary;
  fiatCurrency: string;
  cryptoCurrency: string;
  offerId: string;
  onSelect: () => void;
  isSelected: boolean;
}) {
  const acceptTrade = useAcceptTrade();
  const declineTrade = useDeclineTrade();
  const createThread = useCreateThread();
  const { encrypt } = useCrypto();

  const statusColors: Record<string, string> = {
    offered: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
    accepted: 'bg-green-500/15 text-green-600 dark:text-green-400',
    declined: 'bg-red-500/15 text-red-600 dark:text-red-400',
    cancelled: 'bg-muted text-muted-foreground',
    completed: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  };

  return (
    <div
      className={cn(
        'rounded-lg border p-3 transition-colors cursor-pointer',
        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
      )}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <MiniIdenticon seed={trade.buyer_nickname} size={24} />
          <Link
            href={`/user/${trade.buyer_nickname}`}
            className="text-sm font-medium hover:underline truncate"
            onClick={(e) => e.stopPropagation()}
          >
            {trade.buyer_nickname}
          </Link>
        </div>
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', statusColors[trade.status] || 'bg-muted text-muted-foreground')}>
          {trade.status}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {trade.fiat_amount ? `${fmt(trade.fiat_amount)} ${fiatCurrency}` : '--'}
          {trade.payment_method && (
            <> · {SETTLEMENT_METHOD_LABELS[trade.payment_method as SettlementMethod] ?? trade.payment_method}</>
          )}
        </span>
      </div>
      {trade.status === 'offered' && (
        <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="default"
            className="flex-1 h-7 text-xs"
            disabled={acceptTrade.isPending || declineTrade.isPending}
            onClick={() => acceptTrade.mutate(trade.id)}
          >
            <Check className="h-3 w-3 mr-1" />
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-7 text-xs"
            disabled={acceptTrade.isPending || declineTrade.isPending}
            onClick={async () => {
              await declineTrade.mutateAsync(trade.id);
              // Send system message about decline
              const methodLabel = trade.payment_method
                ? (SETTLEMENT_METHOD_LABELS[trade.payment_method as SettlementMethod] ?? trade.payment_method)
                : '';
              const details = trade.fiat_amount
                ? `${fmt(trade.fiat_amount)} ${fiatCurrency} for ${cryptoCurrency}${methodLabel ? ` via ${methodLabel}` : ''}`
                : '';
              const autoMsg = `[SYSTEM] Declined: ${details}`;
              try {
                const thread = await createThread.mutateAsync({
                  recipient_nickname: trade.buyer_nickname,
                  offer_id: offerId,
                });
                const { public_key } = await usersApi.getUserPublicKey(trade.buyer_nickname);
                const encrypted = await encrypt(autoMsg, public_key);
                await messagesApi.sendMessage(thread.id, encrypted);
              } catch { /* non-critical */ }
            }}
          >
            <X className="h-3 w-3 mr-1" />
            Decline
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Make Offer Form ─────────────────────────────────────────────────────────

function MakeOfferForm({
  offer,
  effectivePrice,
  onTradeCreated,
}: {
  offer: {
    id: string;
    min_amount: number;
    max_amount: number;
    fiat_currency: string;
    crypto_currency: string;
    payment_methods: string[];
    seller_nickname: string;
  };
  effectivePrice: number | undefined;
  onTradeCreated: (tradeId: string, threadId: string) => void;
}) {
  const [fiatAmount, setFiatAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const createTrade = useCreateExchangeTrade();
  const createThread = useCreateThread();
  const { encrypt } = useCrypto();

  const minFiat = Number(offer.min_amount) || 0;
  const maxFiat = Number(offer.max_amount) || 0;
  const isFixedAmount = minFiat === maxFiat && minFiat > 0;

  const parsedAmount = parseFloat(fiatAmount);
  const cryptoEquiv = effectivePrice && parsedAmount > 0 ? parsedAmount / effectivePrice : undefined;

  // Live validation — only show error after user has typed something
  const hasInput = fiatAmount.length > 0;
  const isOutOfRange = hasInput && parsedAmount > 0 && (parsedAmount < minFiat || parsedAmount > maxFiat);
  const rangeError = isOutOfRange
    ? `${fmt(minFiat)} – ${fmt(maxFiat)} ${offer.fiat_currency}`
    : null;

  function triggerShake() {
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const amount = isFixedAmount ? minFiat : parsedAmount;
    if (!paymentMethod) {
      setError('Select a settlement method');
      triggerShake();
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      setError('Enter a valid amount');
      triggerShake();
      return;
    }
    if (amount < minFiat || amount > maxFiat) {
      setError(`Amount must be between ${fmt(minFiat)} and ${fmt(maxFiat)} ${offer.fiat_currency}`);
      triggerShake();
      return;
    }

    try {
      const trade = await createTrade.mutateAsync({
        offer_id: offer.id,
        fiat_amount: amount,
        payment_method: paymentMethod,
      });

      const thread = await createThread.mutateAsync({
        recipient_nickname: offer.seller_nickname,
        offer_id: offer.id,
      });

      // Send auto-message announcing the offer
      const methodLabel = SETTLEMENT_METHOD_LABELS[paymentMethod as SettlementMethod] ?? paymentMethod;
      const autoMsg = `[SYSTEM] Offer: ${fmt(amount)} ${offer.fiat_currency} for ${offer.crypto_currency} via ${methodLabel}`;
      try {
        const { public_key } = await usersApi.getUserPublicKey(offer.seller_nickname);
        const encrypted = await encrypt(autoMsg, public_key);
        await messagesApi.sendMessage(thread.id, encrypted);
      } catch {
        // non-critical — offer still created
      }

      onTradeCreated(trade.id, thread.id);
    } catch (err: unknown) {
      const message = err instanceof ApiError && err.body && typeof err.body === 'object' && 'error' in err.body
        ? String((err.body as { error: string }).error)
        : err instanceof Error ? err.message : 'Failed to create trade';
      setError(message);
      triggerShake();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h3 className="font-semibold text-sm">Make an offer</h3>

      {/* Fiat amount */}
      {isFixedAmount ? (
        <div>
          <Label className="text-sm text-muted-foreground">Amount (fixed)</Label>
          <p className="text-lg font-bold mt-1">
            {fmt(minFiat)} {offer.fiat_currency}
            {effectivePrice && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ≃ {fmt(minFiat / effectivePrice, 6)} {offer.crypto_currency}
              </span>
            )}
          </p>
        </div>
      ) : (
        <div className="flex gap-5">
          {/* Left: inputs + button */}
          <div className="shrink-0 space-y-3">
            {/* Row 1: Amount + Settlement */}
            <div className="flex items-end gap-2">
              <div className="min-w-0">
                <Label htmlFor="fiat-amount" className="text-sm text-muted-foreground mb-1">
                  Amount ({offer.fiat_currency})
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="fiat-amount"
                    type="text"
                    inputMode="decimal"
                    placeholder={`${fmt(minFiat)} – ${fmt(maxFiat)}`}
                    value={fiatAmount}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '' || /^[1-9]\d{0,5}(\.\d{0,2})?$/.test(v)) setFiatAmount(v);
                    }}
                    className={cn(
                      'w-32 h-10 text-sm',
                      isOutOfRange && 'border-destructive ring-1 ring-destructive/30 focus-visible:ring-destructive/50',
                    )}
                  />
                  <span className={cn('text-base font-medium text-muted-foreground whitespace-nowrap', cryptoEquiv === undefined && 'invisible')}>
                    ≃ {cryptoEquiv !== undefined ? fmt(cryptoEquiv, 6) : '0.000000'} {offer.crypto_currency}
                  </span>
                </div>
              </div>

              <div className="min-w-0">
                <Label htmlFor="payment-method" className="text-sm text-muted-foreground mb-1">
                  Settlement method
                </Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger id="payment-method" className="h-10 text-sm w-44">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    {offer.payment_methods.map((pm) => (
                      <SelectItem key={pm} value={pm} className="text-sm">
                        {SETTLEMENT_METHOD_LABELS[pm as SettlementMethod] ?? pm}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Make offer button (full width of inputs above) */}
            <Button
              ref={btnRef}
              type="submit"
              className={cn('w-full h-10 text-sm', shaking && 'animate-shake')}
              disabled={createTrade.isPending || createThread.isPending}
            >
              {createTrade.isPending || createThread.isPending ? 'Sending…' : 'Make offer'}
            </Button>

            {/* Error below button */}
            <div className="relative h-4">
              <p className={cn('absolute inset-x-0 top-0 text-xs', (rangeError || error) ? 'text-destructive' : 'invisible')}>
                {rangeError || error || '\u00A0'}
              </p>
            </div>
          </div>

          {/* Right: safety tips spanning both rows */}
          <div className="flex-1 min-w-0 flex items-center">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Trades are peer-to-peer with no escrow. Always verify payment before releasing crypto. Never share your private keys or recovery phrase.{' '}
              <Link href="/tips" className="text-primary hover:underline font-medium">
                Read safety tips
              </Link>
              {' '}— you are solely responsible for your transactions.
            </p>
          </div>
        </div>
      )}

    </form>
  );
}

// ── Selected Trade Detail (owner view) ───────────────────────────────────────

function SelectedTradeDetail({
  trade,
  fiatCurrency,
  cryptoCurrency,
  offerId,
  onBack,
  onTradeUpdated,
}: {
  trade: TradeSummary;
  fiatCurrency: string;
  cryptoCurrency: string;
  offerId: string;
  onBack: () => void;
  onTradeUpdated: () => void;
}) {
  const acceptTrade = useAcceptTrade();
  const declineTrade = useDeclineTrade();
  const createThread = useCreateThread();
  const { encrypt } = useCrypto();

  async function handleAccept() {
    await acceptTrade.mutateAsync(trade.id);
    onTradeUpdated();
    // Send system accept message
    const methodLabel = trade.payment_method
      ? (SETTLEMENT_METHOD_LABELS[trade.payment_method as SettlementMethod] ?? trade.payment_method)
      : '';
    const details = trade.fiat_amount
      ? `${fmt(trade.fiat_amount)} ${fiatCurrency} for ${cryptoCurrency}${methodLabel ? ` via ${methodLabel}` : ''}`
      : '';
    const autoMsg = `[SYSTEM] Accepted: ${details}`;
    try {
      const thread = await createThread.mutateAsync({
        recipient_nickname: trade.buyer_nickname,
        offer_id: offerId,
      });
      const { public_key } = await usersApi.getUserPublicKey(trade.buyer_nickname);
      const encrypted = await encrypt(autoMsg, public_key);
      await messagesApi.sendMessage(thread.id, encrypted);
    } catch { /* non-critical */ }
  }

  async function handleDecline() {
    await declineTrade.mutateAsync(trade.id);
    onTradeUpdated();
    // Send system decline message
    const methodLabel = trade.payment_method
      ? (SETTLEMENT_METHOD_LABELS[trade.payment_method as SettlementMethod] ?? trade.payment_method)
      : '';
    const details = trade.fiat_amount
      ? `${fmt(trade.fiat_amount)} ${fiatCurrency} for ${cryptoCurrency}${methodLabel ? ` via ${methodLabel}` : ''}`
      : '';
    const autoMsg = `[SYSTEM] Declined: ${details}`;
    try {
      const thread = await createThread.mutateAsync({
        recipient_nickname: trade.buyer_nickname,
        offer_id: offerId,
      });
      const { public_key } = await usersApi.getUserPublicKey(trade.buyer_nickname);
      const encrypted = await encrypt(autoMsg, public_key);
      await messagesApi.sendMessage(thread.id, encrypted);
    } catch { /* non-critical */ }
  }

  return (
    <div className="flex flex-col">
      <button
        className="px-4 py-2 text-xs text-muted-foreground hover:text-foreground border-b border-border text-left shrink-0"
        onClick={onBack}
      >
        <ArrowLeft className="h-3 w-3 inline mr-1" />
        Back to proposals
      </button>
      <TradeProfileCard nickname={trade.buyer_nickname} />
      <div className="px-4 pb-4 space-y-2">
        <div className="rounded-lg border border-border p-3 space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-medium">
              {trade.fiat_amount ? `${fmt(trade.fiat_amount)} ${fiatCurrency}` : '--'}
            </span>
          </div>
          {trade.payment_method && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Method</span>
              <span className="font-medium">
                {SETTLEMENT_METHOD_LABELS[trade.payment_method as SettlementMethod] ?? trade.payment_method}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Status</span>
            <Badge variant="outline" className="text-xs">{trade.status}</Badge>
          </div>
        </div>
        {trade.status === 'offered' && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="default"
              className="flex-1 h-8 text-xs"
              disabled={acceptTrade.isPending || declineTrade.isPending}
              onClick={handleAccept}
            >
              <Check className="h-3 w-3 mr-1" />
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs"
              disabled={acceptTrade.isPending || declineTrade.isPending}
              onClick={handleDecline}
            >
              <X className="h-3 w-3 mr-1" />
              Decline
            </Button>
          </div>
        )}
      </div>
      <RatingSection tradeId={trade.id} tradeStatus={trade.status} />
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function OfferDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { isUnlocked } = useCrypto();

  const { data: offer, isLoading, isError } = useOffer(id);
  const { data: sellerProfile } = useUser(offer?.seller_nickname ?? '');
  const { data: priceData } = usePrices();
  const { data: tradesData, refetch: refetchTrades } = useTradesForOffer(id);
  const updateMutation = useUpdateOffer(id);
  const deleteMutation = useDeleteOffer();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPauseDialog, setShowPauseDialog] = useState(false);

  // Selected trade for owner detail view
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);

  const isOwner = user?.id === offer?.user_id;

  // Find buyer's existing active trade on this offer
  const myActiveTrade = useMemo(() => {
    if (!tradesData || isOwner) return null;
    return tradesData.trades.find(
      (t) => t.buyer_id === user?.id && ['offered', 'accepted', 'completed'].includes(t.status),
    ) ?? null;
  }, [tradesData, user?.id, isOwner]);

  // Selected trade (for owner to view detail)
  const selectedTrade = useMemo(() => {
    if (!tradesData || !selectedTradeId) return null;
    return tradesData.trades.find((t) => t.id === selectedTradeId) ?? null;
  }, [tradesData, selectedTradeId]);

  if (isLoading) return <OfferDetailSkeleton />;

  if (isError || !offer) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-3">
        <p className="text-lg font-medium">Offer not found</p>
        <Button asChild variant="outline">
          <Link href="/exchange">Back to exchange</Link>
        </Button>
      </div>
    );
  }

  const isBuy = offer.offer_type === 'buy';
  const stars = sellerProfile ? sellerProfile.reputation.rating_avg : 0;

  // Compute effective price
  let coinPrice: number | undefined;
  if (priceData) {
    const cp = priceData[offer.crypto_currency];
    if (cp && typeof cp !== 'string') coinPrice = cp[offer.fiat_currency];
  }
  const effectivePrice = offer.rate_type === 'fixed'
    ? Number(offer.fixed_price) || undefined
    : coinPrice !== undefined
      ? coinPrice * (1 + (Number(offer.margin_percent) || 0) / 100)
      : undefined;

  const minFiat = Number(offer.min_amount) || 0;
  const maxFiat = Number(offer.max_amount) || 0;
  const minCrypto = effectivePrice ? minFiat / effectivePrice : undefined;
  const maxCrypto = effectivePrice ? maxFiat / effectivePrice : undefined;
  const isFixedAmount = minFiat === maxFiat && minFiat > 0;

  // Trade created callback
  function handleTradeCreated(_tradeId: string, _threadId: string) {
    refetchTrades();
  }

  const trades = tradesData?.trades ?? [];

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* -- Left Panel (lg:w-3/5) -- */}
        <div className="lg:w-3/5 space-y-6">
          {/* Header */}
          <div>
            <Link
              href="/exchange"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to exchange
            </Link>

            <div className="flex items-center gap-3">
              <Badge variant={isBuy ? 'default' : 'secondary'} className="gap-1 text-[13px]">
                {isBuy ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
                {isBuy ? 'Buying' : 'Selling'}
              </Badge>
              <span className="inline-flex items-center gap-2">
                <CoinIcon symbol={offer.crypto_currency} className="h-6 w-6" />
                <h1 className="text-2xl font-bold">
                  {offer.crypto_currency}/{offer.fiat_currency}
                </h1>
              </span>
            </div>

            {/* Seller info */}
            <div className="flex items-center gap-2.5 mt-3">
              <Link href={`/user/${offer.seller_nickname}`} className="shrink-0">
                <MiniIdenticon seed={offer.seller_nickname} size={36} />
              </Link>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/user/${offer.seller_nickname}`}
                    className="text-base font-medium hover:underline truncate"
                  >
                    {offer.seller_nickname}
                  </Link>
                  {sellerProfile && <ReputationBadge tier={sellerProfile.reputation.tier} />}
                </div>
                {sellerProfile && (
                  <div className="flex items-center gap-1" aria-label={`Rating: ${sellerProfile.reputation.rating_avg.toFixed(1)} out of 5`}>
                    <HalfStarPicker value={stars} readOnly size={16} />
                    <span className="text-sm text-muted-foreground ml-1">
                      {sellerProfile.reputation.rating_avg.toFixed(1)}
                    </span>
                    <span className="text-sm text-muted-foreground ml-1.5">
                      · {offer.seller_trade_count} {offer.seller_trade_count === 1 ? 'trade' : 'trades'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Offer details card */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-5">
            {/* Trade amount + Price */}
            <div className="flex flex-col sm:flex-row sm:items-start gap-6">
              {(offer.min_amount || offer.max_amount) && (
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">Trade amount</p>
                  <p className="text-3xl font-bold">
                    {isFixedAmount
                      ? `${fmt(minFiat)} ${offer.fiat_currency}`
                      : `${offer.min_amount ? fmt(minFiat) : '0'} – ${offer.max_amount ? fmt(maxFiat) : '∞'} ${offer.fiat_currency}`}
                  </p>
                  {effectivePrice !== undefined && (
                    <p className="text-base text-muted-foreground mt-1">
                      {isFixedAmount
                        ? `${fmt(minCrypto!, 6)} ${offer.crypto_currency}`
                        : `${fmt(minCrypto!, 6)} – ${fmt(maxCrypto!, 6)} ${offer.crypto_currency}`}
                    </p>
                  )}
                  {isFixedAmount && (
                    <p className="text-xs text-muted-foreground mt-0.5">Fixed amount</p>
                  )}
                </div>
              )}

              <div className="sm:text-right">
                <p className="text-sm text-muted-foreground mb-1">Price per {offer.crypto_currency}</p>
                <p className="text-2xl font-bold">
                  {effectivePrice !== undefined
                    ? `${fmt(effectivePrice)} ${offer.fiat_currency}`
                    : '--'}
                </p>
                {offer.rate_type === 'market' && (
                  <div className="mt-1.5">
                    <span className="inline-block rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 text-sm font-medium">
                      {Number(offer.margin_percent) > 0 ? '+' : ''}{offer.margin_percent}% margin
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">
                      {isBuy ? 'Buyer' : 'Seller'} seeks {Number(offer.margin_percent) === 0 ? 'market price' : `${Math.abs(Number(offer.margin_percent))}% ${Number(offer.margin_percent) > 0 ? 'above' : 'below'} market price`} ({offer.price_source})
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Settlement methods */}
            <div>
              <p className="text-sm text-muted-foreground mb-1.5">Settlement methods</p>
              <div className="flex flex-wrap gap-2">
                {offer.payment_methods.map((pm) => (
                  <Badge key={pm} variant="outline" className="text-[13px] px-2.5 py-0.5">
                    {SETTLEMENT_METHOD_LABELS[pm as SettlementMethod] ?? pm}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Location */}
            {(offer.country_code || offer.city) && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Location</p>
                <p className="font-medium">
                  {offer.country_code && <>{getCountryFlag(offer.country_code)} {getCountryName(offer.country_code)}</>}
                  {offer.country_code && offer.city && ', '}
                  {offer.city}
                </p>
              </div>
            )}

            {/* Terms */}
            {offer.terms && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Trade terms</p>
                <p className="text-[13px] whitespace-pre-wrap break-words">{offer.terms}</p>
              </div>
            )}
          </div>

          {/* Make Offer form — non-owner, no active trade */}
          {isAuthenticated && !isOwner && !myActiveTrade && (
            <MakeOfferForm
              offer={{
                id: offer.id,
                min_amount: offer.min_amount,
                max_amount: offer.max_amount,
                fiat_currency: offer.fiat_currency,
                crypto_currency: offer.crypto_currency,
                payment_methods: offer.payment_methods,
                seller_nickname: offer.seller_nickname,
              }}
              effectivePrice={effectivePrice}
              onTradeCreated={handleTradeCreated}
            />
          )}

          {/* Active trade summary for buyer */}
          {isAuthenticated && !isOwner && myActiveTrade && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-2">
              <h3 className="font-semibold text-sm">Your active trade</h3>
              <div className="flex items-center justify-between text-sm">
                <span>
                  {myActiveTrade.fiat_amount ? `${fmt(myActiveTrade.fiat_amount)} ${offer.fiat_currency}` : '--'}
                  {myActiveTrade.payment_method && (
                    <> · {SETTLEMENT_METHOD_LABELS[myActiveTrade.payment_method as SettlementMethod] ?? myActiveTrade.payment_method}</>
                  )}
                </span>
                <Badge variant="outline" className="text-xs">{myActiveTrade.status}</Badge>
              </div>
            </div>
          )}

          {/* Owner controls */}
          {isOwner && (
            <div className="flex gap-3">
              {offer.status !== 'removed' && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowPauseDialog(true)}
                >
                  {offer.status === 'active' ? (
                    <><Pause className="h-4 w-4 mr-2" />Pause offer</>
                  ) : (
                    <><Play className="h-4 w-4 mr-2" />Resume offer</>
                  )}
                </Button>
              )}
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete offer
              </Button>
            </div>
          )}
        </div>

        {/* -- Right Panel (lg:w-2/5) -- */}
        <div className="lg:w-2/5">
          <div className="lg:sticky lg:top-6">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {/* Not authenticated */}
              {!isAuthenticated && (
                <div className="p-8 text-center space-y-3">
                  <LogIn className="h-8 w-8 mx-auto text-muted-foreground/40" />
                  <p className="text-sm font-medium">Log in to make an offer</p>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/login">Log in</Link>
                  </Button>
                </div>
              )}

              {/* Authenticated but keys not loaded */}
              {isAuthenticated && !isUnlocked && (
                <div className="p-8 text-center space-y-3">
                  <Lock className="h-8 w-8 mx-auto text-muted-foreground/40" />
                  <p className="text-sm font-medium">Unlock keys to trade</p>
                  <p className="text-xs text-muted-foreground">
                    Your encryption keys need to be unlocked before you can trade.
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/auth/unlock?next=/exchange/${id}`}>Unlock keys</Link>
                  </Button>
                </div>
              )}

              {/* Buyer: no trade yet — prompt */}
              {isAuthenticated && isUnlocked && !isOwner && !myActiveTrade && (
                <div className="p-8 text-center space-y-2">
                  <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/40" />
                  <p className="text-sm font-medium">Submit your trade proposal</p>
                  <p className="text-xs text-muted-foreground">
                    Use the form on the left to make an offer.
                  </p>
                </div>
              )}

              {/* Buyer: has active trade — show seller profile + proposal details + rating */}
              {isAuthenticated && isUnlocked && !isOwner && myActiveTrade && (
                <>
                  <TradeProfileCard nickname={offer.seller_nickname} />
                  <div className="px-4 pb-4 space-y-2">
                    <div className="rounded-lg border border-border p-3 space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Amount</span>
                        <span className="font-medium">
                          {myActiveTrade.fiat_amount ? `${fmt(myActiveTrade.fiat_amount)} ${offer.fiat_currency}` : '--'}
                        </span>
                      </div>
                      {myActiveTrade.payment_method && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Method</span>
                          <span className="font-medium">
                            {SETTLEMENT_METHOD_LABELS[myActiveTrade.payment_method as SettlementMethod] ?? myActiveTrade.payment_method}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Status</span>
                        <Badge variant="outline" className="text-xs">{myActiveTrade.status}</Badge>
                      </div>
                    </div>
                  </div>
                  <RatingSection tradeId={myActiveTrade.id} tradeStatus={myActiveTrade.status} />
                </>
              )}

              {/* Owner: trade proposals */}
              {isAuthenticated && isUnlocked && isOwner && (
                <div className="flex flex-col">
                  <div className="px-4 py-3 border-b border-border shrink-0">
                    <h3 className="font-semibold text-sm">
                      Trade proposals {trades.length > 0 && `(${trades.length})`}
                    </h3>
                  </div>

                  {trades.length === 0 ? (
                    <div className="p-6">
                      <p className="text-xs text-muted-foreground text-center">No proposals yet</p>
                    </div>
                  ) : selectedTrade ? (
                    /* Owner: selected trade — show buyer profile + details + rating */
                    <SelectedTradeDetail
                      trade={selectedTrade}
                      fiatCurrency={offer.fiat_currency}
                      cryptoCurrency={offer.crypto_currency}
                      offerId={offer.id}
                      onBack={() => setSelectedTradeId(null)}
                      onTradeUpdated={() => refetchTrades()}
                    />
                  ) : (
                    /* Owner: proposals list */
                    <div className="overflow-y-auto p-3 space-y-2 max-h-[500px]">
                      {trades.map((trade) => (
                        <TradeProposalRow
                          key={trade.id}
                          trade={trade}
                          fiatCurrency={offer.fiat_currency}
                          cryptoCurrency={offer.crypto_currency}
                          offerId={offer.id}
                          onSelect={() => setSelectedTradeId(trade.id)}
                          isSelected={selectedTradeId === trade.id}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Safety reminders — always visible for authenticated users */}
            {isAuthenticated && isUnlocked && (
              <div className="mt-3 flex items-start gap-3 text-sm text-muted-foreground rounded-xl border border-border bg-card p-4">
                <ShieldAlert className="h-5 w-5 shrink-0 text-yellow-500 mt-0.5" />
                <div className="space-y-2">
                  <p className="font-medium text-foreground text-xs">Safety reminders</p>
                  <ul className="space-y-1.5 text-xs list-disc list-inside">
                    <li>Always verify payment before releasing crypto</li>
                    <li>Never share your private keys or recovery phrase</li>
                    <li>Use the messaging system for all trade communication</li>
                    <li>Report suspicious activity immediately</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pause/Resume dialog */}
      <Dialog open={showPauseDialog} onOpenChange={setShowPauseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {offer.status === 'active' ? 'Pause offer?' : 'Resume offer?'}
            </DialogTitle>
            <DialogDescription>
              {offer.status === 'active'
                ? `This will pause your ${offer.offer_type} offer for ${offer.crypto_currency}/${offer.fiat_currency}. It will no longer be visible to other users.`
                : `This will resume your ${offer.offer_type} offer for ${offer.crypto_currency}/${offer.fiat_currency}. It will become visible to other users again.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPauseDialog(false)}>
              Cancel
            </Button>
            <Button
              variant={offer.status === 'active' ? 'destructive' : 'default'}
              disabled={updateMutation.isPending}
              onClick={async () => {
                const newStatus = offer.status === 'active' ? 'paused' : 'active';
                await updateMutation.mutateAsync({ status: newStatus });
                setShowPauseDialog(false);
              }}
            >
              {updateMutation.isPending
                ? (offer.status === 'active' ? 'Pausing…' : 'Resuming…')
                : (offer.status === 'active' ? 'Pause' : 'Resume')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete offer?</DialogTitle>
            <DialogDescription>
              This will permanently remove your {offer.offer_type} offer for {offer.crypto_currency}/{offer.fiat_currency}. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={async () => {
                await deleteMutation.mutateAsync(offer.id);
                setShowDeleteDialog(false);
                router.push('/exchange');
              }}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
