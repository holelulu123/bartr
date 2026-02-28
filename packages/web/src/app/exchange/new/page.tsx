'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft } from 'lucide-react';
import { ProtectedRoute } from '@/components/protected-route';
import { useCreateOffer } from '@/hooks/use-exchange';
import { useSupportedCoins, getFiatFlag } from '@/hooks/use-prices';
import { PaymentIcon } from '@/components/payment-icon';
import { PriceTicker } from '@/components/price-ticker';
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
import type { PaymentMethod, OfferType, RateType } from '@bartr/shared';

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'btc', label: 'BTC' },
  { value: 'eth', label: 'ETH' },
  { value: 'usdt', label: 'USDT' },
  { value: 'usdc', label: 'USDC' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank transfer' },
];

const schema = z.object({
  min_amount: z.string().optional(),
  max_amount: z.string().optional(),
  margin_percent: z.string().optional(),
  fixed_price: z.string().optional(),
  terms: z.string().max(2000, 'Terms too long').optional(),
});

type FormValues = z.infer<typeof schema>;

function CreateOfferForm() {
  const router = useRouter();
  const { data: coinsData } = useSupportedCoins();
  const createOffer = useCreateOffer();

  const [offerType, setOfferType] = useState<OfferType>('sell');
  const [cryptoCurrency, setCryptoCurrency] = useState<string>('BTC');
  const [fiatCurrency, setFiatCurrency] = useState<string>('USD');
  const [rateType, setRateType] = useState<RateType>('market');
  const [selectedPayments, setSelectedPayments] = useState<PaymentMethod[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [countrySearch, setCountrySearch] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);

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
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

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

    try {
      const offer = await createOffer.mutateAsync({
        offer_type: offerType,
        crypto_currency: cryptoCurrency,
        fiat_currency: fiatCurrency,
        rate_type: rateType,
        payment_methods: selectedPayments,
        ...(values.min_amount && { min_amount: parseFloat(values.min_amount) }),
        ...(values.max_amount && { max_amount: parseFloat(values.max_amount) }),
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

        {/* Live price preview */}
        <div className="rounded-lg border border-border bg-muted/50 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Current market price: <PriceTicker crypto={cryptoCurrency} fiat={fiatCurrency} className="font-medium text-foreground" />
          </p>
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

        {/* Margin or fixed price */}
        {rateType === 'market' ? (
          <div className="space-y-1.5">
            <Label htmlFor="margin_percent">Margin % (optional)</Label>
            <Input
              id="margin_percent"
              type="number"
              step="0.01"
              placeholder="e.g. 2.5 for +2.5% above market"
              {...register('margin_percent')}
            />
            <p className="text-xs text-muted-foreground">
              Positive = above market, negative = below market
            </p>
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

        {/* Amount limits */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="min_amount">Min amount ({fiatCurrency}, optional)</Label>
            <Input
              id="min_amount"
              type="number"
              step="0.01"
              placeholder="e.g. 50"
              {...register('min_amount')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="max_amount">Max amount ({fiatCurrency}, optional)</Label>
            <Input
              id="max_amount"
              type="number"
              step="0.01"
              placeholder="e.g. 10000"
              {...register('max_amount')}
            />
          </div>
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
        {serverError && serverError !== 'Select at least one payment method.' && (
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
