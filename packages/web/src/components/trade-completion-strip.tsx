'use client';

import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { useTradeCompletions, useCompleteTrade } from '@/hooks/use-trades';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const CRYPTO_COLORS: Record<string, string> = {
  BTC: 'text-orange-500',
  ETH: 'text-violet-500',
  USDT: 'text-emerald-500',
  USDC: 'text-blue-400',
  SOL: 'text-fuchsia-500',
  XRP: 'text-blue-600',
  TRX: 'text-red-500',
  TON: 'text-sky-500',
};

const CRYPTO_FILL: Record<string, string> = {
  BTC: 'fill-orange-500',
  ETH: 'fill-violet-500',
  USDT: 'fill-emerald-500',
  USDC: 'fill-blue-400',
  SOL: 'fill-fuchsia-500',
  XRP: 'fill-blue-600',
  TRX: 'fill-red-500',
  TON: 'fill-sky-500',
};

const MIN_WAIT_MS = 90 * 60 * 1000; // 90 minutes

function formatCountdown(ms: number): string {
  return `${Math.ceil(ms / 60_000)}m`;
}

export interface TradeCompletionStripProps {
  tradeId: string;
  tradeStatus: string;
  buyerId: string;
  sellerId: string;
  cryptoCurrency: string;
  /** compact mode for chat strip — hides button after confirmation */
  compact?: boolean;
  /** Called after successfully confirming completion */
  onCompleted?: () => void;
}

export function TradeCompletionStrip({
  tradeId,
  tradeStatus,
  buyerId,
  sellerId,
  cryptoCurrency,
  compact,
  onCompleted,
}: TradeCompletionStripProps) {
  const { user } = useAuth();
  const { data: completions, isLoading } = useTradeCompletions(
    tradeStatus === 'accepted' || tradeStatus === 'completed' ? tradeId : '',
  );
  const completeTrade = useCompleteTrade();
  const [now, setNow] = useState(Date.now());

  // Tick every second for countdown
  useEffect(() => {
    if (tradeStatus !== 'accepted') return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [tradeStatus]);

  if (!user || (tradeStatus !== 'accepted' && tradeStatus !== 'completed')) return null;
  if (isLoading || !completions) return null;

  const isBuyer = user.id === buyerId;
  const isSeller = user.id === sellerId;
  if (!isBuyer && !isSeller) return null;

  const myConfirmed = isBuyer ? completions.buyer_confirmed : completions.seller_confirmed;

  // In compact mode (chat), hide strip after user has confirmed
  if (compact && myConfirmed) return null;
  const partnerConfirmed = isBuyer ? completions.seller_confirmed : completions.buyer_confirmed;
  const bothConfirmed = completions.buyer_confirmed && completions.seller_confirmed;

  const acceptedAt = new Date(completions.accepted_at).getTime();
  const unlockAt = acceptedAt + MIN_WAIT_MS;
  const remaining = unlockAt - now;
  const timerActive = remaining > 0 && tradeStatus === 'accepted';

  const cryptoColor = CRYPTO_COLORS[cryptoCurrency] ?? 'text-primary';
  const cryptoFill = CRYPTO_FILL[cryptoCurrency] ?? 'fill-primary';

  async function handleComplete() {
    await completeTrade.mutateAsync(tradeId);
    onCompleted?.();
  }

  // Checkmark classes
  const check1Active = completions.buyer_confirmed || completions.seller_confirmed;
  const check2Active = bothConfirmed;

  return (
    <div className={cn(
      'flex items-center gap-3 border-border',
      compact
        ? 'px-3 py-2.5 border-t'
        : 'rounded-lg border p-3.5',
    )}>
      {/* Dual checkmarks */}
      <div className="flex items-center gap-0.5 shrink-0">
        <Check
          className={cn(
            'transition-colors',
            compact ? 'h-5 w-5' : 'h-7 w-7',
            check1Active ? `${cryptoColor} ${cryptoFill}` : 'text-muted-foreground/40',
          )}
          strokeWidth={3}
        />
        <Check
          className={cn(
            'transition-colors',
            compact ? 'h-5 w-5 -ml-2' : 'h-7 w-7 -ml-1',
            check2Active ? `${cryptoColor} ${cryptoFill}` : 'text-muted-foreground/40',
          )}
          strokeWidth={3}
        />
      </div>

      {/* Status text */}
      <div className="flex-1 min-w-0">
        {bothConfirmed || tradeStatus === 'completed' ? (
          <p className={cn('text-sm font-medium', cryptoColor)}>Trade completed</p>
        ) : myConfirmed ? (
          <p className="text-sm text-muted-foreground">Waiting for partner to confirm...</p>
        ) : timerActive ? (
          <p className="text-sm text-muted-foreground">
            Available in <span className="font-mono font-medium">{formatCountdown(remaining)}</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Confirm trade completion</p>
        )}
      </div>

      {/* Action button */}
      {tradeStatus === 'accepted' && !myConfirmed && (
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-sm shrink-0"
          disabled={timerActive || completeTrade.isPending}
          onClick={handleComplete}
        >
          {completeTrade.isPending ? 'Confirming...' : 'Complete'}
        </Button>
      )}
    </div>
  );
}
