import { cn } from '@/lib/utils';
import type { ReputationTier } from '@bartr/shared';

const TIER_CONFIG: Record<ReputationTier, { label: string; className: string }> = {
  new:      { label: 'New',      className: 'bg-secondary text-secondary-foreground' },
  verified: { label: 'Verified', className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  trusted:  { label: 'Trusted',  className: 'bg-green-500/15 text-green-400 border-green-500/30' },
  elite:    { label: 'Elite',    className: 'bg-primary/15 text-primary border-primary/30' },
};

interface ReputationBadgeProps {
  tier: ReputationTier;
  className?: string;
}

export function ReputationBadge({ tier, className }: ReputationBadgeProps) {
  const config = TIER_CONFIG[tier] ?? TIER_CONFIG.new;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
