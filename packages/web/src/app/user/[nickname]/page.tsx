'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Star, Calendar, Clock, Package, ArrowUpDown } from 'lucide-react';
import { useUser, useUserRatings } from '@/hooks/use-users';
import { useListings } from '@/hooks/use-listings';
import { useOffers } from '@/hooks/use-exchange';
import { useAuth } from '@/contexts/auth-context';
import { OfferRow } from '@/components/offer-row';
import { ReputationBadge } from '@/components/reputation-badge';
import { Badge } from '@/components/ui/badge';
// Clock is used inside ActiveStatus component
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

// Coloured identicon — deterministic geometric pattern from nickname string.
// Pure SVG, no external dependencies, no network requests.
function Identicon({ seed, size = 80 }: { seed: string; size?: number }) {
  const cells = 5;
  const cellSize = size / cells;

  // Generate a numeric hash from the seed string
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = Math.imul(31, hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const h = ((hash >>> 0) * 2654435761) >>> 0;

  // Pick two colours from the hash
  const hue1 = (h % 360);
  const hue2 = (hue1 + 150) % 360;
  const fg = `hsl(${hue1},65%,55%)`;
  const bg = `hsl(${hue2},30%,18%)`;

  // Build symmetric 5×5 grid — only left half + centre is random, right mirrors left
  const grid: boolean[][] = Array.from({ length: cells }, (_, r) =>
    Array.from({ length: cells }, (_, c) => {
      const col = c < Math.ceil(cells / 2) ? c : cells - 1 - c;
      const bit = (h >>> (r * Math.ceil(cells / 2) + col)) & 1;
      return bit === 1;
    }),
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ borderRadius: '50%' }}
    >
      <rect width={size} height={size} fill={bg} />
      {grid.map((row, r) =>
        row.map((on, c) =>
          on ? (
            <rect
              key={`${r}-${c}`}
              x={c * cellSize}
              y={r * cellSize}
              width={cellSize}
              height={cellSize}
              fill={fg}
            />
          ) : null,
        ),
      )}
    </svg>
  );
}

// Active status — green dot if active within 5 minutes, else "X ago"
function ActiveStatus({ lastActive }: { lastActive: string }) {
  const diffMs = Date.now() - new Date(lastActive).getTime();
  const isOnline = diffMs < 5 * 60_000;

  if (isOnline) {
    return (
      <span className="flex items-center gap-1 text-xs text-green-500">
        <span className="h-2 w-2 rounded-full bg-green-500 inline-block" aria-hidden="true" />
        Active now
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Clock className="h-3 w-3" />
      Active {timeAgo(lastActive)}
    </span>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

const PAYMENT_LABELS: Record<string, string> = {
  btc: 'BTC', eth: 'ETH', usdt: 'USDT', usdc: 'USDC', cash: 'Cash', bank_transfer: 'Bank',
};

export default function UserProfilePage() {
  const { nickname } = useParams<{ nickname: string }>();
  const { user: me } = useAuth();
  const { data: profile, isLoading, isError } = useUser(nickname);
  const { data: ratingsData } = useUserRatings(nickname);
  const { data: listingsData } = useListings(
    profile?.id ? { user_id: profile.id, status: 'active', limit: 6 } : {},
  );
  const { data: offersData } = useOffers(
    profile?.id ? { user_id: profile.id, limit: 6 } : {},
  );

  const isOwnProfile = me?.nickname === nickname;

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-16 text-center">
        <p className="text-muted-foreground text-lg">User not found.</p>
        <Link href="/listings" className="mt-4 inline-block text-sm text-primary hover:underline">
          Browse listings
        </Link>
      </div>
    );
  }

  const stars = Math.round(profile.reputation.rating_avg);

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">

      {/* Profile header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start">
            <Identicon seed={profile.nickname} size={80} />

            <div className="flex-1 text-center sm:text-left space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <h1 className="text-2xl font-bold">{profile.nickname}</h1>
                <ReputationBadge tier={profile.reputation.tier} />
              </div>

              {/* Star rating */}
              <div className="flex items-center justify-center sm:justify-start gap-1" aria-label={`Rating: ${profile.reputation.rating_avg.toFixed(1)} out of 5`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={cn('h-4 w-4', n <= stars ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground')}
                  />
                ))}
                <span className="text-sm text-muted-foreground ml-1">
                  {profile.reputation.rating_avg.toFixed(1)} · score {profile.reputation.composite_score.toFixed(0)}
                </span>
              </div>

              {profile.bio && (
                <p className="text-sm text-muted-foreground max-w-md">{profile.bio}</p>
              )}

              <div className="flex flex-wrap justify-center sm:justify-start gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Joined {formatDate(profile.created_at)}
                </span>
                <ActiveStatus lastActive={profile.last_active} />
              </div>
            </div>

            {isOwnProfile && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/settings/profile">Edit profile</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Active listings */}
      {listingsData && listingsData.listings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Active listings
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {listingsData.listings.map((listing) => (
              <Link
                key={listing.id}
                href={`/listings/${listing.id}`}
                className="block rounded-lg border border-border p-3 hover:border-primary/50 transition-colors"
              >
                <p className="font-medium text-sm truncate">{listing.title}</p>
                <div className="mt-1 flex items-center gap-2">
                  {listing.price_indication && (
                    <span className="text-xs text-muted-foreground">
                      {listing.price_indication} {listing.currency?.toUpperCase()}
                    </span>
                  )}
                  <div className="flex gap-1 flex-wrap">
                    {listing.payment_methods.slice(0, 2).map((pm) => (
                      <Badge key={pm} variant="secondary" className="text-xs px-1 py-0 h-auto">
                        {PAYMENT_LABELS[pm] ?? pm}
                      </Badge>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Exchange offers */}
      {offersData && offersData.offers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4" />
              Exchange offers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {offersData.offers.map((offer) => (
              <OfferRow key={offer.id} offer={offer} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent ratings */}
      {ratingsData && ratingsData.ratings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4" />
              Recent ratings
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {ratingsData.ratings.slice(0, 5).map((rating) => (
              <div key={rating.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={cn(
                          'h-3 w-3',
                          n <= rating.score ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground',
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">{timeAgo(rating.created_at)}</span>
                </div>
                {rating.comment && (
                  <p className="mt-1 text-sm text-muted-foreground">{rating.comment}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
