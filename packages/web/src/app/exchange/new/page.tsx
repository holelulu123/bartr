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
import { PaymentIcon } from '@/components/payment-icon';
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
import type { PaymentMethod, OfferType, RateType, PriceSource } from '@bartr/shared';

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'btc', label: 'BTC' },
  { value: 'eth', label: 'ETH' },
  { value: 'usdt', label: 'USDT' },
  { value: 'usdc', label: 'USDC' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank transfer' },
];

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
  return price >= 1
    ? price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });
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
  const [selectedPayments, setSelectedPayments] = useState<PaymentMethod[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [countrySearch, setCountrySearch] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);

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

  function togglePayment(method: PaymentMethod) {
    setSelectedPayments((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method],
    );
  }

  async function onSubmit(values: FormValues) {
    setServerError(null);

    if (selectedPayments.length === 0) {
      setServerError('Select at least one payment method.');
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
    if (minAmount >= maxAmount) {
      setServerError('Min amount must be less than max amount.');
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
    } catch (err) {
      setServerError('Failed to create offer. Please try again.');
      console.error(err);
    }
  }

  const isProcessing = isSubmitting || createOffer.isPending;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/exchange"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to exchange
        </Link>
        <h1 className="text-2xl font-bold">Create Exchange Offer</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Set your terms for buying or selling crypto.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        {/* Offer type toggle */}
        <div className="space-y-1.5">
          <Label>I want to</Label>
          <div className="flex rounded-lg border border-border overflow-hidden w-fit">
            <button
              type="button"
              onClick={() => setOfferType('buy')}
              className={cn(
                'px-6 py-2 text-sm font-medium transition-colors',
                offerType === 'buy' ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-accent',
              )}
            >
              Buy crypto
            </button>
            <button
              type="button"
              onClick={() => setOfferType('sell')}
              className={cn(
                'px-6 py-2 text-sm font-medium transition-colors',
                offerType === 'sell' ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-accent',
              )}
            >
              Sell crypto
            </button>
          </div>
        </div>

        {/* Crypto / Fiat pair */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="crypto">Cryptocurrency</Label>
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
          <div className="space-y-1.5">
            <Label htmlFor="fiat">Fiat currency</Label>
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
            Current market price:{' '}
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

        {/* Dual min/max: fiat + crypto linked */}
        <div className="space-y-3">
          <Label>Trade limits</Label>
          {/* Fiat row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fiat_min" className="text-xs text-muted-foreground inline-flex items-center gap-1">
                {getFiatFlag(fiatCurrency)} Min ({fiatCurrency})
              </Label>
              <Input
                id="fiat_min"
                type="number"
                step="0.01"
                placeholder="e.g. 50"
                value={fiatMin}
                onChange={(e) => updateLinkedAmounts('fiat', 'min', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fiat_max" className="text-xs text-muted-foreground inline-flex items-center gap-1">
                {getFiatFlag(fiatCurrency)} Max ({fiatCurrency})
              </Label>
              <Input
                id="fiat_max"
                type="number"
                step="0.01"
                placeholder="e.g. 10000"
                value={fiatMax}
                onChange={(e) => updateLinkedAmounts('fiat', 'max', e.target.value)}
              />
            </div>
          </div>
          {/* Crypto row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="crypto_min" className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <CoinIcon symbol={cryptoCurrency} className="h-4 w-4" /> Min ({cryptoCurrency})
              </Label>
              <Input
                id="crypto_min"
                type="number"
                step="0.00000001"
                placeholder="e.g. 0.001"
                value={cryptoMin}
                onChange={(e) => updateLinkedAmounts('crypto', 'min', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="crypto_max" className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <CoinIcon symbol={cryptoCurrency} className="h-4 w-4" /> Max ({cryptoCurrency})
              </Label>
              <Input
                id="crypto_max"
                type="number"
                step="0.00000001"
                placeholder="e.g. 0.5"
                value={cryptoMax}
                onChange={(e) => updateLinkedAmounts('crypto', 'max', e.target.value)}
              />
            </div>
          </div>
          {effectivePrice !== undefined && (
            <p className="text-xs text-muted-foreground">
              Amounts are linked at {formatPrice(effectivePrice)} {fiatCurrency}/{cryptoCurrency}
            </p>
          )}
        </div>

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
                  placeholder="Search countries…"
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

        {/* Payment methods */}
        <div className="space-y-2">
          <Label>Accepted payment methods</Label>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Payment methods">
            {PAYMENT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => togglePayment(opt.value)}
                aria-pressed={selectedPayments.includes(opt.value)}
                className={cn(
                  'px-3 py-1.5 rounded-full border text-sm font-medium transition-colors',
                  selectedPayments.includes(opt.value)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent border-border text-foreground hover:border-primary/50',
                )}
              >
                <PaymentIcon method={opt.value} longLabel />
              </button>
            ))}
          </div>
          {selectedPayments.length === 0 && serverError === 'Select at least one payment method.' && (
            <p className="text-sm text-destructive">Select at least one payment method.</p>
          )}
        </div>

        {/* Terms */}
        <div className="space-y-1.5">
          <Label htmlFor="terms">Trade terms (optional)</Label>
          <Textarea
            id="terms"
            placeholder="Any conditions or instructions for traders…"
            rows={3}
            {...register('terms')}
          />
          {errors.terms && (
            <p className="text-sm text-destructive">{errors.terms.message}</p>
          )}
        </div>

        {/* Server error */}
        {serverError
          && serverError !== 'Select at least one payment method.'
          && (
            <p className="text-sm text-destructive" role="alert">
              {serverError}
            </p>
          )}

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isProcessing} className="flex-1">
            {isProcessing ? 'Creating…' : 'Create offer'}
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
