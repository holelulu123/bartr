'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Image as ImageIcon, X, Navigation, Monitor, Laptop, Shirt, Home, Wrench, Package, Car, Smartphone, Sofa, Dumbbell, Baby, BookOpen, Hammer, Trophy, Music, PawPrint, Watch, Gamepad2, Gift, Banknote, Bitcoin } from 'lucide-react';
import { ProtectedRoute } from '@/components/protected-route';
import { useCreateListing, useCategories } from '@/hooks/use-listings';
import { moderation as moderationApi, listings as listingsApi } from '@/lib/api';
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
import type { CryptoPaymentMethod, ListingCondition } from '@bartr/shared';
import { LISTING_CONDITION_LABELS, CRYPTO_PAYMENT_METHODS, CRYPTO_PAYMENT_METHOD_LABELS, FIAT_CURRENCIES } from '@bartr/shared';
import type { ElementType } from 'react';

const CRYPTO_OPTIONS: { value: CryptoPaymentMethod; label: string }[] =
  CRYPTO_PAYMENT_METHODS.map((m) => ({ value: m, label: CRYPTO_PAYMENT_METHOD_LABELS[m] }));

const CATEGORY_ICONS: Record<string, ElementType> = {
  electronics: Monitor,
  computers: Laptop,
  clothing: Shirt,
  'home-garden': Home,
  services: Wrench,
  other: Package,
  vehicles: Car,
  'phones-tablets': Smartphone,
  furniture: Sofa,
  'sports-outdoors': Dumbbell,
  'baby-kids': Baby,
  'books-media': BookOpen,
  tools: Hammer,
  collectibles: Trophy,
  'musical-instruments': Music,
  pets: PawPrint,
  'jewelry-watches': Watch,
  gaming: Gamepad2,
  'free-stuff': Gift,
  'cash-currency': Banknote,
  crypto: Bitcoin,
};

const MAX_IMAGES = 5;

const schema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(100, 'Title too long'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(5000, 'Description too long'),
  category_id: z.string().optional(),
  price_indication: z
    .string()
    .min(1, 'Price is required')
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, 'Must be a positive number'),
  currency: z.string().min(1, 'Currency is required'),
});

type FormValues = z.infer<typeof schema>;

// ── Image preview item ─────────────────────────────────────────────────────

interface ImagePreview {
  file: File;
  previewUrl: string;
}

// ── Inner form (rendered inside ProtectedRoute) ────────────────────────────

function CreateListingForm() {
  const router = useRouter();
  const { data: categoriesData } = useCategories();

  const [acceptsCrypto, setAcceptsCrypto] = useState(false);
  const [selectedCryptos, setSelectedCryptos] = useState<CryptoPaymentMethod[]>([]);
  const [selectedCondition, setSelectedCondition] = useState<string>('');
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [city, setCity] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [currencySearch, setCurrencySearch] = useState('');
  const [images, setImages] = useState<ImagePreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const filteredCountries = useMemo(() => {
    if (!countrySearch) return COUNTRIES;
    const lower = countrySearch.toLowerCase();
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(lower) || c.code.toLowerCase().includes(lower),
    );
  }, [countrySearch]);

  const filteredCurrencies = useMemo(() => {
    if (!currencySearch) return FIAT_CURRENCIES;
    const lower = currencySearch.toLowerCase();
    return FIAT_CURRENCIES.filter(
      (c) => c.name.toLowerCase().includes(lower) || c.code.toLowerCase().includes(lower),
    );
  }, [currencySearch]);

  const createListing = useCreateListing();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      currency: 'USD',
    },
  });

  const selectedCurrency = watch('currency');

  // ── Crypto toggles ─────────────────────────────────────────────────────

  function toggleCrypto(method: CryptoPaymentMethod) {
    setSelectedCryptos((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method],
    );
  }

  function handleCategoryChange(val: string) {
    setValue('category_id', val === 'none' ? undefined : val);
  }

  const isValidCity = (value: string) => !/\d/.test(value);

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

  // ── Image handling ─────────────────────────────────────────────────────

  function addFiles(files: File[]) {
    const imageFiles = files.filter((f) => f.type.startsWith('image/'));
    const remaining = MAX_IMAGES - images.length;
    const toAdd = imageFiles.slice(0, remaining);
    const previews = toAdd.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setImages((prev) => [...prev, ...previews]);
  }

  function removeImage(idx: number) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[idx].previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  // ── Submit ─────────────────────────────────────────────────────────────

  async function onSubmit(values: FormValues) {
    setServerError(null);

    if (!selectedCountry) {
      setServerError('Please select a country.');
      return;
    }

    if (images.length === 0) {
      setServerError('Please add at least one image.');
      return;
    }

    if (acceptsCrypto && selectedCryptos.length === 0) {
      setServerError('Select at least one cryptocurrency.');
      return;
    }

    // Moderation pre-check
    try {
      const textToCheck = `${values.title} ${values.description}`;
      const check = await moderationApi.checkText(textToCheck);
      if (!check.allowed) {
        setServerError(
          `Your listing contains a blocked keyword: "${check.blocked_keyword}". Please edit and try again.`,
        );
        return;
      }
    } catch {
      // If moderation check fails, proceed anyway — server will re-check
    }

    try {
      const listing = await createListing.mutateAsync({
        title: values.title,
        description: values.description,
        payment_methods: acceptsCrypto ? selectedCryptos : [],
        price_indication: values.price_indication,
        currency: values.currency,
        country_code: selectedCountry,
        ...(city && { city }),
        ...(values.category_id && { category_id: Number(values.category_id) }),
        ...(selectedCondition && { condition: selectedCondition as ListingCondition }),
      });

      // Upload images sequentially
      for (const img of images) {
        await listingsApi.uploadListingImage(listing.id, img.file).catch(() => {
          // ignore individual image failures — listing was created successfully
        });
      }

      router.push(`/listings/${listing.id}`);
    } catch (err) {
      setServerError('Failed to create listing. Please try again.');
      console.error(err);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  const isProcessing = isSubmitting || createListing.isPending;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/listings"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to listings
        </Link>
        <h1 className="text-2xl font-bold">Post a listing</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fill in the details below. Your listing will be visible to all buyers.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            placeholder="What are you selling?"
            {...register('title')}
            aria-describedby={errors.title ? 'title-error' : undefined}
          />
          {errors.title && (
            <p id="title-error" className="text-sm text-destructive">
              {errors.title.message}
            </p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="Describe the item, its condition, and any relevant details…"
            rows={5}
            {...register('description')}
            aria-describedby={errors.description ? 'description-error' : undefined}
          />
          {errors.description && (
            <p id="description-error" className="text-sm text-destructive">
              {errors.description.message}
            </p>
          )}
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <Label htmlFor="category">Category</Label>
          <Select onValueChange={handleCategoryChange} defaultValue="none">
            <SelectTrigger id="category" aria-label="Category">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No category</SelectItem>
              {categoriesData?.categories.map((cat) => {
                const CatIcon = CATEGORY_ICONS[cat.slug];
                return (
                  <SelectItem key={cat.id} value={String(cat.id)}>
                    <span className="inline-flex items-center gap-1.5">
                      {CatIcon && <CatIcon className="h-3.5 w-3.5" />}
                      {cat.name}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Condition */}
        <div className="space-y-1.5">
          <Label htmlFor="condition">Condition (optional)</Label>
          <Select
            value={selectedCondition || 'none'}
            onValueChange={(val) => setSelectedCondition(val === 'none' ? '' : val)}
          >
            <SelectTrigger id="condition" aria-label="Condition">
              <SelectValue placeholder="Select condition" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not specified</SelectItem>
              {(Object.entries(LISTING_CONDITION_LABELS) as [ListingCondition, string][]).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Price */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="price_indication">Price</Label>
            <Input
              id="price_indication"
              type="number"
              step="any"
              min="0"
              placeholder="e.g. 100"
              {...register('price_indication')}
              aria-required="true"
              aria-describedby={errors.price_indication ? 'price-error' : undefined}
            />
            {errors.price_indication && (
              <p id="price-error" className="text-sm text-destructive">
                {errors.price_indication.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="currency">Currency</Label>
            <Select
              value={selectedCurrency}
              onValueChange={(val) => {
                setCurrencySearch('');
                setValue('currency', val);
              }}
            >
              <SelectTrigger id="currency" aria-label="Currency" aria-required="true">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 py-1.5">
                  <Input
                    placeholder="Search currencies…"
                    value={currencySearch}
                    onChange={(e) => setCurrencySearch(e.target.value)}
                    className="h-8"
                    aria-label="Search currencies"
                  />
                </div>
                {filteredCurrencies.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.flag} {c.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.currency && (
              <p id="currency-error" className="text-sm text-destructive">
                {errors.currency.message}
              </p>
            )}
          </div>
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
                      placeholder="Search countries…"
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

        {/* Cryptocurrency */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="accepts-crypto"
              checked={acceptsCrypto}
              onChange={(e) => {
                setAcceptsCrypto(e.target.checked);
                if (!e.target.checked) setSelectedCryptos([]);
              }}
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="accepts-crypto" className="cursor-pointer">
              Also accept cryptocurrency?
            </Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Fiat payment is implied by your price &amp; currency fields above. Toggle this to also accept crypto.
          </p>
          {acceptsCrypto && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Cryptocurrencies">
              {CRYPTO_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleCrypto(opt.value)}
                  aria-pressed={selectedCryptos.includes(opt.value)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors',
                    selectedCryptos.includes(opt.value)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-transparent border-border text-foreground hover:border-primary/50',
                  )}
                >
                  <CoinIcon symbol={opt.value.toUpperCase()} className="h-4 w-4" />
                  {opt.label}
                </button>
              ))}
            </div>
          )}
          {acceptsCrypto && selectedCryptos.length === 0 && serverError === 'Select at least one cryptocurrency.' && (
            <p className="text-sm text-destructive">Select at least one cryptocurrency.</p>
          )}
        </div>

        {/* Image upload */}
        <div className="space-y-2">
          <Label>Images (up to {MAX_IMAGES})</Label>

          {/* Drop zone */}
          {images.length < MAX_IMAGES && (
            <label
              className={cn(
                'flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors',
                isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
              )}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              aria-label="Upload images"
            >
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Drag & drop images here, or click to browse
              </span>
              <span className="text-xs text-muted-foreground">
                {images.length}/{MAX_IMAGES} images
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={handleFileInput}
                aria-label="Choose image files"
              />
            </label>
          )}

          {/* Previews */}
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {images.map((img, i) => (
                <div
                  key={img.previewUrl}
                  className="relative w-20 h-20 rounded-lg overflow-hidden border border-border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.previewUrl}
                    alt={`Preview ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-background/80 flex items-center justify-center hover:bg-background transition-colors"
                    aria-label={`Remove image ${i + 1}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Server error */}
        {serverError && serverError !== 'Select at least one cryptocurrency.' && (
          <p className="text-sm text-destructive" role="alert">
            {serverError}
          </p>
        )}

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isProcessing} className="flex-1">
            {isProcessing ? 'Posting…' : 'Post listing'}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/listings">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}

// ── Page export — wrapped in ProtectedRoute ────────────────────────────────

export default function CreateListingPage() {
  return (
    <ProtectedRoute>
      <CreateListingForm />
    </ProtectedRoute>
  );
}
