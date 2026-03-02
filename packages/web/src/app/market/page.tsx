'use client';

import { useCallback, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, SlidersHorizontal, Monitor, Laptop, Shirt, Home, Wrench, Package, Plus } from 'lucide-react';
import { useInfiniteListings, useCategories } from '@/hooks/use-listings';
import { ListingCard, ListingCardSkeleton } from '@/components/listing-card';
import { getPaymentLabel } from '@/components/payment-icon';
import { COUNTRIES, getCountryFlag, getCountryName } from '@/lib/countries';
import { useAuth } from '@/contexts/auth-context';
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
import type { ElementType } from 'react';

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'btc', label: 'BTC' },
  { value: 'eth', label: 'ETH' },
  { value: 'usdt', label: 'USDT' },
  { value: 'usdc', label: 'USDC' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank transfer' },
];

const CATEGORY_ICONS: Record<string, ElementType> = {
  electronics: Monitor,
  computers: Laptop,
  clothing: Shirt,
  'home-garden': Home,
  services: Wrench,
  other: Package,
};

export default function MarketPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();

  const q = searchParams.get('q') ?? '';
  const category = searchParams.get('category') ?? '';
  const paymentMethod = (searchParams.get('payment') ?? '') as PaymentMethod | '';
  const country = searchParams.get('country') ?? '';

  const [searchInput, setSearchInput] = useState(q);
  const [countrySearch, setCountrySearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, startTransition] = useTransition();

  const { data: categoriesData } = useCategories();

  const filteredCountries = useMemo(() => {
    if (!countrySearch) return COUNTRIES;
    const lower = countrySearch.toLowerCase();
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(lower) || c.code.toLowerCase().includes(lower),
    );
  }, [countrySearch]);

  const filters = {
    ...(q && { q }),
    ...(category && { category }),
    ...(paymentMethod && { payment_method: paymentMethod }),
    ...(country && { country_code: country }),
  };

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
    useInfiniteListings(filters);

  const allListings = data?.pages?.flatMap((p) => p.listings) ?? [];

  function buildUrl(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    return `/market?${params.toString()}`;
  }

  function pushFilter(updates: Record<string, string>) {
    startTransition(() => {
      router.push(buildUrl(updates));
    });
  }

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

  function handleCountryChange(val: string) {
    setCountrySearch('');
    pushFilter({ country: val === 'all' ? '' : val });
  }

  function clearFilters() {
    setSearchInput('');
    setCountrySearch('');
    startTransition(() => router.push('/market'));
  }

  const hasFilters = !!(q || category || paymentMethod || country);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Marketplace</h1>
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
        {isAuthenticated && (
          <Button asChild>
            <Link href="/market/new">
              <Plus className="h-4 w-4 mr-2" />
              Sell
            </Link>
          </Button>
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

        <Select value={category || 'all'} onValueChange={handleCategoryChange}>
          <SelectTrigger className="w-full sm:w-48" aria-label="Category">
            <SlidersHorizontal className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categoriesData?.categories.map((cat) => {
              const CatIcon = CATEGORY_ICONS[cat.slug];
              return (
                <SelectItem key={cat.slug} value={cat.slug}>
                  <span className="inline-flex items-center gap-1.5">
                    {CatIcon && <CatIcon className="h-3.5 w-3.5" />}
                    {cat.name}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        <Select value={paymentMethod || 'all'} onValueChange={handlePaymentChange}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Payment method">
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

        <Select value={country || 'all'} onValueChange={handleCountryChange}>
          <SelectTrigger className="w-full sm:w-48" aria-label="Country">
            <SelectValue placeholder="Country" />
          </SelectTrigger>
          <SelectContent>
            <div className="px-2 py-1.5">
              <Input
                placeholder="Search countries…"
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
                className="h-8"
                aria-label="Search countries"
              />
            </div>
            <SelectItem value="all">All countries</SelectItem>
            {filteredCountries.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.flag} {c.name}
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
          {q && <Badge variant="secondary">Search: {q}</Badge>}
          {category && (
            <Badge variant="secondary">
              Category: {categoriesData?.categories.find((c) => c.slug === category)?.name ?? category}
            </Badge>
          )}
          {paymentMethod && (
            <Badge variant="secondary">
              Payment: {getPaymentLabel(paymentMethod as PaymentMethod, true)}
            </Badge>
          )}
          {country && (
            <Badge variant="secondary">
              Country: {getCountryFlag(country)} {getCountryName(country) || country}
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
              <button className="underline text-primary hover:no-underline" onClick={clearFilters}>
                clear them
              </button>
              .
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Be the first to post a listing!</p>
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
