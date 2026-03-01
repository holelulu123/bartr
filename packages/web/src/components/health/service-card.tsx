'use client';

interface ServiceCardProps {
  name: string;
  ok: boolean;
  latency_ms: number;
}

export function ServiceCard({ name, ok, latency_ms }: ServiceCardProps) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 flex items-center gap-3">
      <span
        className={`inline-block h-3 w-3 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`}
        aria-label={ok ? 'healthy' : 'unhealthy'}
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{name}</p>
        <p className="text-xs text-neutral-500">{ok ? `${latency_ms} ms` : 'down'}</p>
      </div>
    </div>
  );
}
