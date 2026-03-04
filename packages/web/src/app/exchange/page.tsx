'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useInfiniteOffers } from '@/hooks/use-exchange';
import { useSupportedCoins, getFiatFlag } from '@/hooks/use-prices';
import { useAuth } from '@/contexts/auth-context';
import { OfferRow } from '@/components/offer-row';
import { CoinIcon } from '@/components/crypto-icons';
import { COUNTRIES, getCountryFlag } from '@/lib/countries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { SETTLEMENT_METHOD_LABELS, CRYPTO_PAYMENT_METHODS } from '@bartr/shared';
import type { OfferType, SettlementMethod } from '@bartr/shared';

const CRYPTO_KEYS = new Set<string>(CRYPTO_PAYMENT_METHODS);
const SETTLEMENT_OPTIONS = (Object.entries(SETTLEMENT_METHOD_LABELS) as [SettlementMethod, string][])
  .filter(([key]) => !CRYPTO_KEYS.has(key));

export default function ExchangePage() {
  const { isAuthenticated } = useAuth();
  const [offerType, setOfferType] = useState<OfferType | ''>('');
  const [crypto, setCrypto] = useState<string>('');
  const [fiat, setFiat] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [country, setCountry] = useState<string>('');
  const [countrySearch, setCountrySearch] = useState('');

  const { data: coinsData } = useSupportedCoins();

  const cryptoCoins = useMemo(
    () => coinsData?.coins.filter((c) => c.coin_type === 'crypto') ?? [],
    [coinsData],
  );
  const fiatCoins = useMemo(
    () => coinsData?.coins.filter((c) => c.coin_type === 'fiat') ?? [],
    [coinsData],
  );

  const filteredCountries = useMemo(() => {
    if (!countrySearch) return COUNTRIES;
    const lower = countrySearch.toLowerCase();
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(lower) || c.code.toLowerCase().includes(lower),
    );
  }, [countrySearch]);

  const filters = {
    ...(offerType && { offer_type: offerType as OfferType }),
    ...(crypto && { crypto_currency: crypto }),
    ...(fiat && { fiat_currency: fiat }),
    ...(paymentMethod && { payment_method: paymentMethod as SettlementMethod }),
    ...(country && { country_code: country }),
  };

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteOffers(filters);
  const offers = data?.pages?.flatMap((p) => p.offers) ?? [];

  return (
    <div className="max-w-[1500px] mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">P2P Exchange</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Buy and sell crypto peer-to-peer
          </p>
        </div>
        {isAuthenticated && (
          <Button asChild>
            <Link href="/exchange/new">
              <Plus className="h-4 w-4 mr-2" />
              Create Offer
            </Link>
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Buy/Sell toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setOfferType('')}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors',
              !offerType ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-accent',
            )}
          >
            All
          </button>
          <button
            onClick={() => setOfferType('buy')}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors',
              offerType === 'buy' ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-accent',
            )}
          >
            Buy
          </button>
          <button
            onClick={() => setOfferType('sell')}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors',
              offerType === 'sell' ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-accent',
            )}
          >
            Sell
          </button>
        </div>

        {/* Crypto selector */}
        <Select value={crypto || 'all'} onValueChange={(v) => setCrypto(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Crypto">
            <SelectValue placeholder="Crypto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All crypto</SelectItem>
            {cryptoCoins.map((c) => (
              <SelectItem key={c.symbol} value={c.symbol}>
                <span className="inline-flex items-center gap-2">
                  <CoinIcon symbol={c.symbol} className="h-5 w-5" />
                  {c.symbol} <span className="text-muted-foreground">{c.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Fiat selector */}
        <Select value={fiat || 'all'} onValueChange={(v) => setFiat(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Fiat">
            <SelectValue placeholder="Fiat" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All fiat</SelectItem>
            {fiatCoins.map((c) => (
              <SelectItem key={c.symbol} value={c.symbol}>
                {getFiatFlag(c.symbol)} {c.symbol}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Settlement method */}
        <Select value={paymentMethod || 'all'} onValueChange={(v) => setPaymentMethod(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-full sm:w-56" aria-label="Settlement method">
            <SelectValue placeholder="Settlement" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All payment methods</SelectItem>
            {SETTLEMENT_OPTIONS.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Country */}
        <Select value={country || 'all'} onValueChange={(v) => { setCountrySearch(''); setCountry(v === 'all' ? '' : v); }}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Country">
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
                {getCountryFlag(c.code)} {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Column headers */}
      <div className="hidden md:grid items-center gap-3 px-4 py-2 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider grid-cols-[90px_1.2fr_1fr_180px_140px_1fr_90px]">
        <span>{offerType === 'buy' ? 'Buyer' : offerType === 'sell' ? 'Seller' : 'Type'}</span>
        <span>Trader</span>
        <span>Limit</span>
        <span>Price</span>
        <span>Payment</span>
        <span>Offer Details</span>
        <span />
      </div>

      {/* Offers list */}
      {isError ? (
        <div className="py-20 text-center text-muted-foreground">
          Failed to load offers. Please try again.
        </div>
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : offers.length === 0 ? (
        <div className="py-20 text-center space-y-3">
          <p className="text-lg font-medium">No offers found</p>
          <p className="text-sm text-muted-foreground">
            {Object.keys(filters).length > 0
              ? 'Try adjusting your filters.'
              : 'Be the first to create an exchange offer!'}
          </p>
          {isAuthenticated && (
            <Button asChild>
              <Link href="/exchange/new">Create Offer</Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {offers.map((offer) => (
              <OfferRow key={offer.id} offer={offer} />
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
