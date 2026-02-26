import Link from 'next/link';
import Image from 'next/image';
import { Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ReputationBadge } from '@/components/reputation-badge';
import { cn } from '@/lib/utils';
import type { ListingSummary } from '@/lib/api';

const PAYMENT_LABELS: Record<string, string> = {
  btc: 'BTC',
  xmr: 'XMR',
  eth: 'ETH',
  cash: 'Cash',
  bank: 'Bank',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

interface ListingCardProps {
  listing: ListingSummary;
  className?: string;
}

export function ListingCard({ listing, className }: ListingCardProps) {
  return (
    <Link
      href={`/listings/${listing.id}`}
      className={cn(
        'group flex flex-col rounded-xl border border-border bg-card overflow-hidden',
        'hover:border-primary/50 hover:shadow-md transition-all duration-200',
        className,
      )}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        {listing.thumbnail ? (
          <Image
            src={listing.thumbnail}
            alt={listing.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
            No image
          </div>
        )}
        {listing.category_name && (
          <div className="absolute top-2 left-2">
            <Badge variant="secondary" className="text-xs backdrop-blur-sm bg-background/70">
              {listing.category_name}
            </Badge>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2 p-3 flex-1">
        <h3 className="font-medium text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {listing.title}
        </h3>

        {/* Price */}
        {listing.price_indication && (
          <p className="text-base font-semibold text-primary">
            {listing.price_indication}
            {listing.currency && (
              <span className="text-xs font-normal text-muted-foreground ml-1">
                {listing.currency}
              </span>
            )}
          </p>
        )}

        {/* Payment methods */}
        <div className="flex flex-wrap gap-1">
          {listing.payment_methods.slice(0, 3).map((method) => (
            <Badge key={method} variant="outline" className="text-xs px-1.5 py-0">
              {PAYMENT_LABELS[method] ?? method}
            </Badge>
          ))}
          {listing.payment_methods.length > 3 && (
            <Badge variant="outline" className="text-xs px-1.5 py-0">
              +{listing.payment_methods.length - 3}
            </Badge>
          )}
        </div>

        {/* Footer: seller + time */}
        <div className="flex items-center justify-between mt-auto pt-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs text-muted-foreground truncate">
              {listing.seller_nickname}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <Clock className="h-3 w-3" />
            {timeAgo(listing.created_at)}
          </div>
        </div>
      </div>
    </Link>
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="aspect-[4/3] bg-muted animate-pulse" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
        <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
        <div className="flex gap-1">
          <div className="h-5 w-10 bg-muted animate-pulse rounded-full" />
          <div className="h-5 w-10 bg-muted animate-pulse rounded-full" />
        </div>
        <div className="h-3 bg-muted animate-pulse rounded w-2/3" />
      </div>
    </div>
  );
}
