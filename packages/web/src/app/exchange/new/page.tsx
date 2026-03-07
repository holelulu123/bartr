'use client';

import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Navigation } from 'lucide-react';
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
import { SETTLEMENT_METHOD_LABELS, CRYPTO_PAYMENT_METHODS } from '@bartr/shared';
import type { SettlementMethod, OfferType, RateType, PriceSource } from '@bartr/shared';

const CRYPTO_KEYS = new Set<string>(CRYPTO_PAYMENT_METHODS);
const SETTLEMENT_OPTIONS = (Object.entries(SETTLEMENT_METHOD_LABELS) as [SettlementMethod, string][])
  .filter(([key]) => !CRYPTO_KEYS.has(key));

const PRICE_SOURCES: { value: PriceSource; label: string }[] = [
  { value: 'coingecko', label: 'CoinGecko' },
  { value: 'binance', label: 'Binance' },
  { value: 'kraken', label: 'Kraken' },
];

const schema = z.object({
  margin_percent: z.string().optional(),
  fixed_price: z.string().optional(),
  terms: z.string().max(100, 'Terms too long (max 100 characters)').optional(),
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
  const [city, setCity] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [shake, setShake] = useState(false);
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
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { margin_percent: '0' },
  });

  const watchedMargin = watch('margin_percent');
  const watchedFixedPrice = watch('fixed_price');

  // Margin: max 2 digits before decimal, 2 after, optional leading minus, block invalid input
  const isValidMargin = (value: string) => value === '' || value === '-' || /^-?\d{0,2}(\.\d{0,2})?$/.test(value);

  // Live validation for fixed price
  const fixedPriceError = watchedFixedPrice !== undefined && watchedFixedPrice !== '' && (!/^\d*\.?\d*$/.test(watchedFixedPrice) || (watchedFixedPrice.trim() !== '' && parseFloat(watchedFixedPrice) <= 0))
    ? 'Price must be a positive number'
    : null;

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
      prev.includes(method) ? prev.filter((m) => m !== method) : prev.length >= 10 ? prev : [...prev, method],
    );
  }

  const isValidCity = (value: string) => !/\d/.test(value);

  // Validate fiat trade limits: max 6 digits before decimal, no leading zero, optional 2 decimals (allow empty)
  const isValidFiatLimit = (value: string) => value === '' || /^[1-9]\d{0,5}(\.\d{0,2})?$/.test(value);

  // Validate crypto trade limits: positive decimal (allow empty)
  const isValidCryptoLimit = (value: string) => value === '' || /^\d*\.?\d*$/.test(value);

  async function handleFindLocation() {
    setGeoError('');
    setGeoLoading(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 }),
      );
      const { latitude, longitude } = pos.coords;
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=en`,
        { headers: { 'User-Agent': 'Bartr/1.0' } },
      );
      const data = await res.json();
      const countryCode = data.address?.country_code?.toUpperCase();
      const cityName = data.address?.city || data.address?.town || data.address?.village || '';

      if (!countryCode || !COUNTRIES.find((c) => c.code === countryCode)) {
        setGeoError('Your country is not in our supported list');
        return;
      }
      setSelectedCountry(countryCode);
      if (cityName && isValidCity(cityName)) {
        setCity(cityName);
      }
    } catch (err) {
      if (err instanceof GeolocationPositionError) {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setGeoError('Location access denied. Please allow location permission in your browser settings.');
            break;
          case err.POSITION_UNAVAILABLE:
            setGeoError('Location unavailable. Your device could not determine your position.');
            break;
          case err.TIMEOUT:
            setGeoError('Location request timed out. Please try again.');
            break;
          default:
            setGeoError('Could not detect location. Please try again.');
        }
      } else {
        setGeoError('Failed to look up your location. The geocoding service may be temporarily unavailable.');
      }
    } finally {
      setGeoLoading(false);
    }
  }

  async function onSubmit(values: FormValues) {
    setServerError(null);
    setSubmitted(true);

    const minAmount = parseFloat(fiatMin);
    const maxAmount = parseFloat(fiatMax);

    const hasCountryErr = !selectedCountry;
    const hasSettlementErr = selectedPayments.length === 0;
    const hasFixedPriceErr = rateType === 'fixed' && !values.fixed_price;
    const hasMinErr = !fiatMin || isNaN(minAmount) || minAmount < 0;
    const hasMaxErr = !fiatMax || isNaN(maxAmount) || maxAmount <= 0;
    const hasRangeErr = !hasMinErr && !hasMaxErr && minAmount > maxAmount;

    if (hasCountryErr || hasSettlementErr || hasFixedPriceErr || hasMinErr || hasMaxErr || hasRangeErr || hasPriceErrors || hasLimitErrors) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
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
        country_code: selectedCountry,
        ...(city && { city }),
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
  const minError = activeMin !== '' && (isNaN(minNum) || minNum < 0)
    ? 'Must be a valid number'
    : (submitted && !fiatMin) ? 'Min amount is required' : null;
  const maxError = activeMax !== '' && (isNaN(maxNum) || maxNum <= 0)
    ? 'Must be a number greater than 0'
    : (submitted && !fiatMax) ? 'Max amount is required' : null;
  const rangeError = !minError && !maxError && activeMin !== '' && activeMax !== '' && !isNaN(minNum) && !isNaN(maxNum) && minNum > maxNum
    ? 'Max must be greater than or equal to min'
    : null;
  const hasPriceErrors = (rateType === 'fixed' && !!fixedPriceError);
  const hasLimitErrors = !!minError || !!maxError || !!rangeError;

  // Field-level errors shown after first submit attempt
  const countryError = submitted && !selectedCountry ? 'Please select a country' : null;
  const settlementError = submitted && selectedPayments.length === 0 ? 'Select at least one settlement method' : null;
  const fixedPriceRequired = submitted && rateType === 'fixed' && !watchedFixedPrice ? 'Fixed price is required' : null;

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
          <div className="w-44 space-y-1.5">
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
          <span className="hidden sm:flex items-end pb-2.5 text-sm font-medium w-8 justify-center shrink-0">
            {offerType === 'buy' ? 'with' : 'for'}
          </span>
          <div className="w-32 space-y-1.5">
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
              <Label htmlFor="margin_percent" className="inline-flex items-center gap-1">
                Margin %
                <span className="group relative">
                  <span className="inline-flex items-center justify-center h-5 w-5 rounded-full border border-border text-xs text-muted-foreground cursor-help">?</span>
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-52 rounded bg-popover border border-border px-2.5 py-1.5 text-xs text-popover-foreground shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-75 pointer-events-none z-[100]">
                    How much above or below the market price you want to trade. E.g. +2% means 2% above market.
                  </span>
                </span>
              </Label>
              <Input
                id="margin_percent"
                type="text"
                inputMode="decimal"
                placeholder="e.g. 2.5"
                value={watchedMargin ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (isValidMargin(val)) setValue('margin_percent', val);
                }}
              />
              <p className="text-xs text-muted-foreground">Positive = above market, negative = below</p>
            </div>
            <div className="space-y-1.5">
              <Label className="inline-flex items-center gap-1">
                Effective price
                <span className="group relative">
                  <span className="inline-flex items-center justify-center h-5 w-5 rounded-full border border-border text-xs text-muted-foreground cursor-help">?</span>
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-52 rounded bg-popover border border-border px-2.5 py-1.5 text-xs text-popover-foreground shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-75 pointer-events-none z-[100]">
                    The actual price per coin after applying your margin to the market price.
                  </span>
                </span>
              </Label>
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
          <div className="grid grid-cols-[1fr_80px] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fixed_price">Fixed price ({fiatCurrency})</Label>
              <Input
                id="fixed_price"
                type="text"
                inputMode="decimal"
                placeholder={`Price per 1 ${cryptoCurrency}`}
                {...register('fixed_price')}
                className={cn((fixedPriceError || fixedPriceRequired) && 'border-destructive')}
              />
              {(fixedPriceError || fixedPriceRequired) && <p className="text-xs text-destructive">{fixedPriceError || fixedPriceRequired}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Margin</Label>
              <div className="h-10 flex items-center justify-center">
                {(() => {
                  const fixedNum = parseFloat(watchedFixedPrice || '');
                  const pct = selectedPrice && !isNaN(fixedNum) && fixedNum > 0
                    ? ((fixedNum / selectedPrice - 1) * 100)
                    : 0;
                  const sign = pct >= 0 ? '+' : '';
                  return (
                    <span className={cn(
                      'rounded px-2 py-1 text-sm font-medium whitespace-nowrap',
                      pct >= 0
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-red-500/15 text-red-600 dark:text-red-400',
                    )}>
                      {sign}{pct.toFixed(2)}%
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Trade limits — single row with fiat/crypto toggle */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm inline-flex items-center gap-1">
              Trade limits ({limitsView === 'fiat' ? fiatCurrency : cryptoCurrency})
              <span className="group relative">
                <span className="inline-flex items-center justify-center h-5 w-5 rounded-full border border-border text-xs text-muted-foreground cursor-help">?</span>
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-52 rounded bg-popover border border-border px-2.5 py-1.5 text-xs text-popover-foreground shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-75 pointer-events-none z-[100]">
                  The minimum and maximum trade amount you&apos;re willing to accept per transaction.
                </span>
              </span>
            </Label>
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
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 50"
                    value={fiatMin}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (isValidFiatLimit(val)) updateLinkedAmounts('fiat', 'min', val);
                    }}
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
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 10000"
                    value={fiatMax}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (isValidFiatLimit(val)) updateLinkedAmounts('fiat', 'max', val);
                    }}
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
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 0.001"
                    value={cryptoMin}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (isValidCryptoLimit(val)) updateLinkedAmounts('crypto', 'min', val);
                    }}
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
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 0.5"
                    value={cryptoMax}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (isValidCryptoLimit(val)) updateLinkedAmounts('crypto', 'max', val);
                    }}
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
          <Label className="inline-flex items-center gap-1">
            Settlement methods
            <span className="group relative">
              <span className="inline-flex items-center justify-center h-5 w-5 rounded-full border border-border text-xs text-muted-foreground cursor-help">?</span>
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-52 rounded bg-popover border border-border px-2.5 py-1.5 text-xs text-popover-foreground shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-75 pointer-events-none z-[100]">
                How you want to send or receive payment. Select all methods you accept.
              </span>
            </span>
          </Label>
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
          <p className={cn('text-xs text-destructive', !settlementError && 'invisible')}>
            {settlementError || 'placeholder'}
          </p>
          <p className={cn('text-xs text-destructive -mt-1', selectedPayments.length < 10 && 'invisible')}>
            Maximum 10 settlement methods allowed
          </p>
        </div>

        {/* Location */}
        <div className="space-y-3">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="country">Country</Label>
              <Select
                value={selectedCountry || undefined}
                onValueChange={(val) => {
                  setCountrySearch('');
                  setSelectedCountry(val);
                }}
              >
                <SelectTrigger id="country" aria-label="Country" aria-required="true">
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
                  {filteredCountries.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="city">City (optional)</Label>
              <Input
                id="city"
                type="text"
                placeholder="e.g. Berlin"
                value={city}
                onChange={(e) => {
                  const val = e.target.value;
                  if (isValidCity(val)) setCity(val);
                }}
                maxLength={30}
              />
            </div>
          </div>
          {countryError && <p className="text-xs text-destructive">{countryError}</p>}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={geoLoading}
            onClick={handleFindLocation}
            className="text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
          >
            <Navigation className="h-4 w-4 mr-1.5" />
            {geoLoading ? 'Detecting...' : 'Find My Location'}
          </Button>
          {geoError && (
            <p className="text-xs text-destructive">{geoError}</p>
          )}
        </div>

        {/* Terms */}
        <div className="space-y-1.5">
          <Label htmlFor="terms">Trade terms (optional)</Label>
          <Textarea
            id="terms"
            placeholder="Any conditions or instructions for traders..."
            rows={3}
            maxLength={100}
            {...register('terms')}
          />
          {errors.terms && (
            <p className="text-sm text-destructive">{errors.terms.message}</p>
          )}
        </div>

        {/* Server error */}
        {serverError && (
          <p className="text-sm text-destructive" role="alert">
            {serverError}
          </p>
        )}

        {/* Submit */}
        <div className="flex gap-3 pt-1">
          <Button
            type="submit"
            disabled={isProcessing}
            className={cn('flex-1', shake && 'animate-shake')}
          >
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
