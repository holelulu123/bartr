'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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

const CRYPTO_HEX: Record<string, string> = {
  BTC: '#f97316',
  ETH: '#8b5cf6',
  USDT: '#10b981',
  USDC: '#60a5fa',
  SOL: '#d946ef',
  XRP: '#2563eb',
  TRX: '#ef4444',
  TON: '#0ea5e9',
};

const MIN_WAIT_MS = 0; // TODO: restore to 90 * 60 * 1000 (90 minutes) after testing

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
  /** Called after confirming completion. `bothDone` is true when trade is fully completed. */
  onCompleted?: (bothDone: boolean) => void;
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
  const [glowing, setGlowing] = useState(false);
  const glowTimer = useRef<ReturnType<typeof setTimeout>>();
  const stripRef = useRef<HTMLDivElement>(null);

  // Tick every second for countdown
  useEffect(() => {
    if (tradeStatus !== 'accepted') return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [tradeStatus]);

  // Glow trigger — works for both same-page (event) and cross-page (sessionStorage)
  const triggerGlow = useCallback(() => {
    sessionStorage.removeItem('glow-completion');
    clearTimeout(glowTimer.current);
    setGlowing(true);
    stripRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    glowTimer.current = setTimeout(() => setGlowing(false), 3000);
  }, []);

  // Listen for custom event (same-page clicks)
  useEffect(() => {
    if (compact) return;
    window.addEventListener('glow-completion', triggerGlow);
    return () => window.removeEventListener('glow-completion', triggerGlow);
  }, [compact, triggerGlow]);

  // Check sessionStorage on mount (cross-page navigation)
  useEffect(() => {
    if (compact) return;
    if (sessionStorage.getItem('glow-completion')) {
      triggerGlow();
    }
  }, [compact, triggerGlow]);

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

  async function handleComplete() {
    const res = await completeTrade.mutateAsync(tradeId);
    onCompleted?.(res.status === 'completed');
  }

  // Checkmark classes
  const check1Active = completions.buyer_confirmed || completions.seller_confirmed;
  const check2Active = bothConfirmed;

  const glowHex = CRYPTO_HEX[cryptoCurrency] ?? '#6366f1';

  return (
    <div ref={stripRef} className="relative">
      {/* Rotating border effect */}
      {glowing && (
        <div
          className="absolute -inset-[2px] rounded-lg overflow-hidden pointer-events-none"
          style={{
            background: `conic-gradient(from var(--glow-angle, 0deg), transparent 0%, ${glowHex} 25%, transparent 50%, ${glowHex} 75%, transparent 100%)`,
            animation: 'completion-glow-spin 1s linear infinite',
          }}
        >
          <div className="absolute inset-[2px] rounded-[6px] bg-background" />
        </div>
      )}
      <div
        className={cn(
          'relative flex items-center gap-3 border-border',
          compact
            ? 'px-3 py-2.5 border-t'
            : 'rounded-lg border p-3.5',
          glowing && 'border-transparent',
        )}
      >
      {/* Dual checkmarks */}
      <div className="group relative flex items-center gap-0.5 shrink-0">
        {timerActive && (
          <span className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-popover border border-border px-2 py-1 text-sm text-popover-foreground shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-75 pointer-events-none z-[100]">
            The trade could be completed in {Math.ceil(remaining / 60_000)} minutes
          </span>
        )}
        <Check
          className={cn(
            'transition-colors',
            compact ? 'h-5 w-5' : 'h-7 w-7',
            check1Active ? cryptoColor : 'text-muted-foreground/40',
          )}
          strokeWidth={3}
        />
        <Check
          className={cn(
            'transition-colors',
            compact ? 'h-5 w-5 -ml-2' : 'h-7 w-7 -ml-1',
            check2Active ? cryptoColor : 'text-muted-foreground/40',
          )}
          strokeWidth={3}
        />
      </div>

      {/* Status text */}
      <div className="flex-1 min-w-0">
        {bothConfirmed || tradeStatus === 'completed' ? (
          <p className={cn('text-base font-medium', cryptoColor)}>Trade completed</p>
        ) : myConfirmed ? (
          <p className="text-base text-muted-foreground">Waiting for partner to confirm...</p>
        ) : timerActive ? (
          <p className="text-base text-muted-foreground">
            Available in <span className="font-mono font-medium">{formatCountdown(remaining)}</span>
          </p>
        ) : (
          <p className="text-base text-muted-foreground">Confirm trade completion</p>
        )}
      </div>

      {/* Action button */}
      {tradeStatus === 'accepted' && !myConfirmed && (
        <div className="group relative shrink-0">
          <Button
            size="sm"
            className="h-9 px-4 text-sm font-medium bg-green-600 hover:bg-green-700 text-white"
            disabled={timerActive || completeTrade.isPending}
            onClick={handleComplete}
          >
            <Check className="h-4 w-4 mr-1.5" />
            {completeTrade.isPending ? 'Confirming...' : 'Complete'}
          </Button>
          {timerActive && (
            <span className="absolute -top-9 right-0 whitespace-nowrap rounded bg-popover border border-border px-2 py-1 text-sm text-popover-foreground shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-75 pointer-events-none z-[100]">
              The trade could be completed in {Math.ceil(remaining / 60_000)} minutes
            </span>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
