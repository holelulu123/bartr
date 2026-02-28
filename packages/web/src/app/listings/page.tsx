'use client';

import { useCallback, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useInfiniteListings, useCategories } from '@/hooks/use-listings';
import { ListingCard, ListingCardSkeleton } from '@/components/listing-card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { PaymentMethod } from '@bartr/shared';

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'btc', label: 'BTC' },
  { value: 'xmr', label: 'XMR' },
  { value: 'eth', label: 'ETH' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
];

export default function ListingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const q = searchParams.get('q') ?? '';
  const category = searchParams.get('category') ?? '';
  const paymentMethod = (searchParams.get('payment') ?? '') as PaymentMethod | '';

  // Local state for the controlled search input (debounced on change)
  const [searchInput, setSearchInput] = useState(q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, startTransition] = useTransition();

  const { data: categoriesData } = useCategories();

  const filters = {
    ...(q && { q }),
    ...(category && { category }),
    ...(paymentMethod && { payment_method: paymentMethod }),
  };

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
    useInfiniteListings(filters);

  const allListings = data?.pages?.flatMap((p) => p.listings) ?? [];

  // ── URL helpers ────────────────────────────────────────────────────────────

  function buildUrl(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    return `/listings?${params.toString()}`;
  }

  function pushFilter(updates: Record<string, string>) {
    startTransition(() => {
      router.push(buildUrl(updates));
    });
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setSearchInput(val);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => pushFilter({ q: val }), 400);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams],
  );

  function handleCategoryChange(val: string) {
    pushFilter({ category: val === 'all' ? '' : val });
  }

  function handlePaymentChange(val: string) {
    pushFilter({ payment: val === 'all' ? '' : val });
  }

  function clearFilters() {
    setSearchInput('');
    startTransition(() => router.push('/listings'));
  }

  const hasFilters = !!(q || category || paymentMethod);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Browse Listings</h1>
        {!isLoading && (
          <p className="text-sm text-muted-foreground mt-1">
            {allListings.length > 0
              ? `${data?.pages?.[0]?.pagination.total ?? 0} listings`
              : hasFilters
              ? 'No listings match your filters'
              : 'No listings yet'}
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search listings…"
            value={searchInput}
            onChange={handleSearchChange}
            aria-label="Search listings"
          />
        </div>

        <Select
          value={category || 'all'}
          onValueChange={handleCategoryChange}
        >
          <SelectTrigger className="w-full sm:w-44" aria-label="Category">
            <SlidersHorizontal className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categoriesData?.categories.map((cat) => (
              <SelectItem key={cat.slug} value={cat.slug}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={paymentMethod || 'all'}
          onValueChange={handlePaymentChange}
        >
          <SelectTrigger className="w-full sm:w-40" aria-label="Payment method">
            <SelectValue placeholder="Payment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any payment</SelectItem>
            {PAYMENT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="outline" onClick={clearFilters} className="shrink-0">
            Clear
          </Button>
        )}
      </div>

      {/* Active filter pills */}
      {hasFilters && (
        <div className="flex flex-wrap gap-2">
          {q && (
            <Badge variant="secondary">
              Search: {q}
            </Badge>
          )}
          {category && (
            <Badge variant="secondary">
              Category: {categoriesData?.categories.find((c) => c.slug === category)?.name ?? category}
            </Badge>
          )}
          {paymentMethod && (
            <Badge variant="secondary">
              Payment: {PAYMENT_OPTIONS.find((p) => p.value === paymentMethod)?.label ?? paymentMethod}
            </Badge>
          )}
        </div>
      )}

      {/* Grid */}
      {isError ? (
        <div className="py-20 text-center text-muted-foreground">
          Failed to load listings. Please try again.
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <ListingCardSkeleton key={i} />
          ))}
        </div>
      ) : allListings.length === 0 ? (
        <div className="py-20 text-center space-y-2">
          <p className="text-lg font-medium">No listings found</p>
          {hasFilters ? (
            <p className="text-sm text-muted-foreground">
              Try adjusting your filters or{' '}
              <button
                className="underline text-primary hover:no-underline"
                onClick={clearFilters}
              >
                clear them
              </button>
              .
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Be the first to post a listing!
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {allListings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>

          {hasNextPage && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
