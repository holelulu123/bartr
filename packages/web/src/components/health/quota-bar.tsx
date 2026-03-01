'use client';

interface QuotaBarProps {
  sent: number;
  limit: number;
  resets_at: string;
}

export function QuotaBar({ sent, limit, resets_at }: QuotaBarProps) {
  const pct = limit > 0 ? Math.min((sent / limit) * 100, 100) : 0;
  const resetDate = new Date(resets_at);
  const resetStr = resetDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium">Resend Email Quota</p>
        <p className="text-xs text-neutral-500">Resets {resetStr}</p>
      </div>
      <div className="h-3 rounded-full bg-neutral-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-neutral-500 mt-1">
        {sent.toLocaleString()} / {limit.toLocaleString()} emails sent
      </p>
    </div>
  );
}
