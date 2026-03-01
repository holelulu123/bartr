'use client';

import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft } from 'lucide-react';
import { ProtectedRoute } from '@/components/protected-route';
import { useCreateOffer } from '@/hooks/use-exchange';
import { useSupportedCoins, getFiatFlag, useExchangePrices, getExchangePrice } from '@/hooks/use-prices';
import { CoinIcon } from '@/components/crypto-icons';
import { COUNTRIES } from '@/lib/countries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { SETTLEMENT_METHOD_LABELS } from '@bartr/shared';
import type { SettlementMethod, OfferType, RateType, PriceSource } from '@bartr/shared';

const SETTLEMENT_OPTIONS = Object.entries(SETTLEMENT_METHOD_LABELS) as [SettlementMethod, string][];

const PRICE_SOURCES: { value: PriceSource; label: string }[] = [
  { value: 'coingecko', label: 'CoinGecko' },
  { value: 'binance', label: 'Binance' },
  { value: 'kraken', label: 'Kraken' },
];

const schema = z.object({
  margin_percent: z.string().optional(),
  fixed_price: z.string().optional(),
  terms: z.string().max(2000, 'Terms too long').optional(),
});

type FormValues = z.infer<typeof schema>;

function formatPrice(price: number | undefined): string {
  if (price === undefined) return '--';
  return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function CreateOfferForm() {
  const router = useRouter();
  const { data: coinsData } = useSupportedCoins();
  const { data: exchangePrices } = useExchangePrices();
  const createOffer = useCreateOffer();

  const [offerType, setOfferType] = useState<OfferType>('sell');
  const [cryptoCurrency, setCryptoCurrency] = useState<string>('BTC');
  const [fiatCurrency, setFiatCurrency] = useState<string>('USD');
  const [rateType, setRateType] = useState<RateType>('market');
  const [priceSource, setPriceSource] = useState<PriceSource>('coingecko');
  const [selectedPayments, setSelectedPayments] = useState<SettlementMethod[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [countrySearch, setCountrySearch] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const [limitsView, setLimitsView] = useState<'fiat' | 'crypto'>('fiat');

  // Controlled amount fields (not in react-hook-form)
  const [fiatMin, setFiatMin] = useState('');
  const [fiatMax, setFiatMax] = useState('');
  const [cryptoMin, setCryptoMin] = useState('');
  const [cryptoMax, setCryptoMax] = useState('');

  // Track which side was last edited to avoid infinite loops
  const lastEditedSide = useRef<'fiat' | 'crypto'>('fiat');

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

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { margin_percent: '0' },
  });

  const watchedMargin = watch('margin_percent');

  // Compute current exchange price for selected source/pair
  const selectedPrice = getExchangePrice(exchangePrices, priceSource, cryptoCurrency, fiatCurrency);

  // Compute effective price = exchangePrice * (1 + margin/100)
  const effectivePrice = useMemo(() => {
    if (selectedPrice === undefined) return undefined;
    if (rateType === 'fixed') return undefined;
    const margin = parseFloat(watchedMargin || '0') || 0;
    return selectedPrice * (1 + margin / 100);
  }, [selectedPrice, watchedMargin, rateType]);

  // Helper to update linked amounts
  const updateLinkedAmounts = useCallback((side: 'fiat' | 'crypto', field: 'min' | 'max', value: string) => {
    lastEditedSide.current = side;

    if (side === 'fiat') {
      if (field === 'min') setFiatMin(value);
      else setFiatMax(value);

      const numVal = parseFloat(value);
      if (!value || isNaN(numVal) || !effectivePrice) {
        if (field === 'min') setCryptoMin('');
        else setCryptoMax('');
        return;
      }
      const cryptoVal = (numVal / effectivePrice).toFixed(8);
      if (field === 'min') setCryptoMin(cryptoVal);
      else setCryptoMax(cryptoVal);
    } else {
      if (field === 'min') setCryptoMin(value);
      else setCryptoMax(value);

      const numVal = parseFloat(value);
      if (!value || isNaN(numVal) || !effectivePrice) {
        if (field === 'min') setFiatMin('');
        else setFiatMax('');
        return;
      }
      const fiatVal = (numVal * effectivePrice).toFixed(2);
      if (field === 'min') setFiatMin(fiatVal);
      else setFiatMax(fiatVal);
    }
  }, [effectivePrice]);

  // When effective price changes, recalculate the derived side
  useEffect(() => {
    if (!effectivePrice) return;

    if (lastEditedSide.current === 'fiat') {
      // Recalculate crypto from fiat
      const minVal = parseFloat(fiatMin);
      const maxVal = parseFloat(fiatMax);
      if (!isNaN(minVal) && fiatMin) setCryptoMin((minVal / effectivePrice).toFixed(8));
      if (!isNaN(maxVal) && fiatMax) setCryptoMax((maxVal / effectivePrice).toFixed(8));
    } else {
      // Recalculate fiat from crypto
      const minVal = parseFloat(cryptoMin);
      const maxVal = parseFloat(cryptoMax);
      if (!isNaN(minVal) && cryptoMin) setFiatMin((minVal * effectivePrice).toFixed(2));
      if (!isNaN(maxVal) && cryptoMax) setFiatMax((maxVal * effectivePrice).toFixed(2));
    }
    // Only react to effectivePrice changes, not the values themselves
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectivePrice]);

  function togglePayment(method: SettlementMethod) {
    setSelectedPayments((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method],
    );
  }

  async function onSubmit(values: FormValues) {
    setServerError(null);

    if (selectedPayments.length === 0) {
      setServerError('Select at least one settlement method.');
      return;
    }

    if (rateType === 'fixed' && !values.fixed_price) {
      setServerError('Fixed price is required for fixed rate type.');
      return;
    }

    const minAmount = parseFloat(fiatMin);
    const maxAmount = parseFloat(fiatMax);

    if (!fiatMin || isNaN(minAmount) || minAmount < 0) {
      setServerError('Min amount is required.');
      return;
    }
    if (!fiatMax || isNaN(maxAmount) || maxAmount <= 0) {
      setServerError('Max amount is required and must be greater than 0.');
      return;
    }
    if (minAmount > maxAmount) {
      setServerError('Min amount must be less than or equal to max amount.');
      return;
    }

    try {
      const offer = await createOffer.mutateAsync({
        offer_type: offerType,
        crypto_currency: cryptoCurrency,
        fiat_currency: fiatCurrency,
        rate_type: rateType,
        payment_methods: selectedPayments,
        min_amount: minAmount,
        max_amount: maxAmount,
        ...(rateType === 'market' && { price_source: priceSource }),
        ...(rateType === 'market' && values.margin_percent && { margin_percent: parseFloat(values.margin_percent) }),
        ...(rateType === 'fixed' && values.fixed_price && { fixed_price: parseFloat(values.fixed_price) }),
        ...(selectedCountry && { country_code: selectedCountry }),
        ...(values.terms && { terms: values.terms }),
      });

      router.push(`/exchange/${offer.id}`);
    } catch (err: unknown) {
      const apiBody = err && typeof err === 'object' && 'body' in err ? (err as { body: unknown }).body : null;
      const apiMsg = apiBody && typeof apiBody === 'object' && apiBody !== null && 'error' in apiBody
        ? String((apiBody as { error: string }).error)
        : null;
      setServerError(apiMsg || 'Failed to create offer. Please try again.');
      console.error(err);
    }
  }

  const isProcessing = isSubmitting || createOffer.isPending;

  // Derive helper text for limits toggle
  const otherSideMin = limitsView === 'fiat' ? cryptoMin : fiatMin;
  const otherSideMax = limitsView === 'fiat' ? cryptoMax : fiatMax;
  const otherSideSymbol = limitsView === 'fiat' ? cryptoCurrency : fiatCurrency;

  // Interactive validation for min/max fields
  const activeMin = limitsView === 'fiat' ? fiatMin : cryptoMin;
  const activeMax = limitsView === 'fiat' ? fiatMax : cryptoMax;
  const minNum = parseFloat(activeMin);
  const maxNum = parseFloat(activeMax);
  const minError = activeMin !== '' && (isNaN(minNum) || minNum < 0) ? 'Must be a valid number' : null;
  const maxError = activeMax !== '' && (isNaN(maxNum) || maxNum <= 0) ? 'Must be a number greater than 0' : null;
  const rangeError = !minError && !maxError && activeMin !== '' && activeMax !== '' && !isNaN(minNum) && !isNaN(maxNum) && minNum > maxNum
    ? 'Max must be greater than or equal to min'
    : null;
  const hasLimitErrors = !!minError || !!maxError || !!rangeError;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div>
        <Link
          href="/exchange"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to exchange
        </Link>
        <h1 className="text-2xl font-bold">Create Exchange Offer</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        {/* Offer type + crypto/fiat selectors — single row on desktop */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="space-y-1.5">
            <Label>I want to</Label>
            <div className="flex rounded-lg border border-border overflow-hidden w-fit">
              <button
                type="button"
                onClick={() => setOfferType('buy')}
                className={cn(
                  'px-5 py-2 text-sm font-medium transition-colors',
                  offerType === 'buy' ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-accent',
                )}
              >
                Buy
              </button>
              <button
                type="button"
                onClick={() => setOfferType('sell')}
                className={cn(
                  'px-5 py-2 text-sm font-medium transition-colors',
                  offerType === 'sell' ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-accent',
                )}
              >
                Sell
              </button>
            </div>
          </div>
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="crypto">Crypto</Label>
            <Select value={cryptoCurrency} onValueChange={setCryptoCurrency}>
              <SelectTrigger id="crypto" aria-label="Cryptocurrency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
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
          </div>
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="fiat">Fiat</Label>
            <Select value={fiatCurrency} onValueChange={setFiatCurrency}>
              <SelectTrigger id="fiat" aria-label="Fiat currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fiatCoins.map((c) => (
                  <SelectItem key={c.symbol} value={c.symbol}>
                    {getFiatFlag(c.symbol)} {c.symbol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Live price preview + source selector */}
        <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Market price:{' '}
            <span className="font-medium text-foreground">
              {selectedPrice !== undefined ? `${formatPrice(selectedPrice)} ${fiatCurrency}` : '--'}
            </span>
            {' '}
            <span className="text-muted-foreground">
              ({PRICE_SOURCES.find((s) => s.value === priceSource)?.label})
            </span>
          </p>
          <Select value={priceSource} onValueChange={(v) => setPriceSource(v as PriceSource)}>
            <SelectTrigger className="w-36 h-8 text-xs" aria-label="Price source">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRICE_SOURCES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Rate type */}
        <div className="space-y-1.5">
          <Label>Price type</Label>
          <div className="flex rounded-lg border border-border overflow-hidden w-fit">
            <button
              type="button"
              onClick={() => setRateType('market')}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors',
                rateType === 'market' ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-accent',
              )}
            >
              Market rate
            </button>
            <button
              type="button"
              onClick={() => setRateType('fixed')}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors',
                rateType === 'fixed' ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-accent',
              )}
            >
              Fixed price
            </button>
          </div>
        </div>

        {/* Margin + effective price (side-by-side) or fixed price */}
        {rateType === 'market' ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="margin_percent">Margin %</Label>
              <Input
                id="margin_percent"
                type="number"
                step="0.01"
                placeholder="e.g. 2.5"
                {...register('margin_percent')}
              />
              <p className="text-xs text-muted-foreground">
                Positive = above market, negative = below
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Effective price</Label>
              <div className="flex items-center h-10 rounded-md border border-border bg-muted/50 px-3">
                <span className="text-sm font-medium">
                  {effectivePrice !== undefined
                    ? `${formatPrice(effectivePrice)} ${fiatCurrency}`
                    : '--'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Price per 1 {cryptoCurrency}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="fixed_price">Fixed price ({fiatCurrency})</Label>
            <Input
              id="fixed_price"
              type="number"
              step="0.01"
              placeholder={`Price per 1 ${cryptoCurrency}`}
              {...register('fixed_price')}
            />
          </div>
        )}

        {/* Trade limits — single row with fiat/crypto toggle */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Trade limits ({limitsView === 'fiat' ? fiatCurrency : cryptoCurrency})</Label>
            <button
              type="button"
              onClick={() => setLimitsView((v) => v === 'fiat' ? 'crypto' : 'fiat')}
              className="text-xs text-primary hover:underline"
            >
              Switch to {limitsView === 'fiat' ? cryptoCurrency : fiatCurrency}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {limitsView === 'fiat' ? (
              <>
                <div className="space-y-1">
                  <Label htmlFor="fiat_min" className="text-sm text-muted-foreground inline-flex items-center gap-1">
                    {getFiatFlag(fiatCurrency)} Min
                  </Label>
                  <Input
                    id="fiat_min"
                    type="number"
                    step="0.01"
                    placeholder="e.g. 50"
                    value={fiatMin}
                    onChange={(e) => updateLinkedAmounts('fiat', 'min', e.target.value)}
                    className={cn(minError && 'border-destructive')}
                  />
                  {minError && <p className="text-xs text-destructive">{minError}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="fiat_max" className="text-sm text-muted-foreground inline-flex items-center gap-1">
                    {getFiatFlag(fiatCurrency)} Max
                  </Label>
                  <Input
                    id="fiat_max"
                    type="number"
                    step="0.01"
                    placeholder="e.g. 10000"
                    value={fiatMax}
                    onChange={(e) => updateLinkedAmounts('fiat', 'max', e.target.value)}
                    className={cn((maxError || rangeError) && 'border-destructive')}
                  />
                  {maxError && <p className="text-xs text-destructive">{maxError}</p>}
                  {rangeError && <p className="text-xs text-destructive">{rangeError}</p>}
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <Label htmlFor="crypto_min" className="text-sm text-muted-foreground inline-flex items-center gap-1">
                    <CoinIcon symbol={cryptoCurrency} className="h-4 w-4" /> Min
                  </Label>
                  <Input
                    id="crypto_min"
                    type="number"
                    step="0.00000001"
                    placeholder="e.g. 0.001"
                    value={cryptoMin}
                    onChange={(e) => updateLinkedAmounts('crypto', 'min', e.target.value)}
                    className={cn(minError && 'border-destructive')}
                  />
                  {minError && <p className="text-xs text-destructive">{minError}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="crypto_max" className="text-sm text-muted-foreground inline-flex items-center gap-1">
                    <CoinIcon symbol={cryptoCurrency} className="h-4 w-4" /> Max
                  </Label>
                  <Input
                    id="crypto_max"
                    type="number"
                    step="0.00000001"
                    placeholder="e.g. 0.5"
                    value={cryptoMax}
                    onChange={(e) => updateLinkedAmounts('crypto', 'max', e.target.value)}
                    className={cn((maxError || rangeError) && 'border-destructive')}
                  />
                  {maxError && <p className="text-xs text-destructive">{maxError}</p>}
                  {rangeError && <p className="text-xs text-destructive">{rangeError}</p>}
                </div>
              </>
            )}
          </div>
          {effectivePrice !== undefined && otherSideMin && otherSideMax && (
            <p className="text-xs text-muted-foreground">
              {otherSideMin} – {otherSideMax} {otherSideSymbol}
            </p>
          )}
        </div>

        {/* Settlement methods */}
        <div className="space-y-2">
          <Label>Settlement methods</Label>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Settlement methods">
            {SETTLEMENT_OPTIONS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => togglePayment(value)}
                aria-pressed={selectedPayments.includes(value)}
                className={cn(
                  'px-3 py-1.5 rounded-full border text-sm font-medium transition-colors',
                  selectedPayments.includes(value)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent border-border text-foreground hover:border-primary/50',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {selectedPayments.length === 0 && serverError === 'Select at least one settlement method.' && (
            <p className="text-sm text-destructive">Select at least one settlement method.</p>
          )}
        </div>

        {/* Additional options (Country + Terms) */}
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors select-none list-none flex items-center gap-1.5">
            <span className="text-xs transition-transform group-open:rotate-90">&#9654;</span>
            Additional options
          </summary>
          <div className="mt-3 space-y-4">
            {/* Country */}
            <div className="space-y-1.5">
              <Label htmlFor="country">Country (optional)</Label>
              <Select
                value={selectedCountry || 'none'}
                onValueChange={(val) => {
                  setCountrySearch('');
                  setSelectedCountry(val === 'none' ? '' : val);
                }}
              >
                <SelectTrigger id="country" aria-label="Country">
                  <SelectValue placeholder="Select a country" />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1.5">
                    <Input
                      placeholder="Search countries..."
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      className="h-8"
                      aria-label="Search countries"
                    />
                  </div>
                  <SelectItem value="none">No country</SelectItem>
                  {filteredCountries.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Terms */}
            <div className="space-y-1.5">
              <Label htmlFor="terms">Trade terms (optional)</Label>
              <Textarea
                id="terms"
                placeholder="Any conditions or instructions for traders..."
                rows={3}
                {...register('terms')}
              />
              {errors.terms && (
                <p className="text-sm text-destructive">{errors.terms.message}</p>
              )}
            </div>
          </div>
        </details>

        {/* Server error */}
        {serverError
          && serverError !== 'Select at least one settlement method.'
          && (
            <p className="text-sm text-destructive" role="alert">
              {serverError}
            </p>
          )}

        {/* Submit */}
        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={isProcessing || hasLimitErrors} className="flex-1">
            {isProcessing ? 'Creating...' : 'Create offer'}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/exchange">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function CreateOfferPage() {
  return (
    <ProtectedRoute>
      <CreateOfferForm />
    </ProtectedRoute>
  );
}
