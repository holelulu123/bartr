'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Image as ImageIcon, X, Monitor, Laptop, Shirt, Home, Wrench, Package, Car, Smartphone, Sofa, Dumbbell, Baby, BookOpen, Hammer, Trophy, Music, PawPrint, Watch, Gamepad2, Gift, Banknote, Bitcoin } from 'lucide-react';
import { useListing, useUpdateListing, useDeleteListingImage, useCategories } from '@/hooks/use-listings';
import { useAuth } from '@/contexts/auth-context';
import { listings as listingsApi } from '@/lib/api';
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
import type { CryptoPaymentMethod, ListingStatus, ListingCondition } from '@bartr/shared';
import { LISTING_CONDITION_LABELS, CRYPTO_PAYMENT_METHODS, CRYPTO_PAYMENT_METHOD_LABELS, FIAT_CURRENCIES, getFiatFlag } from '@bartr/shared';
import type { ListingImage } from '@/lib/api';
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

const STATUS_OPTIONS: { value: ListingStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'sold', label: 'Sold' },
];

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
  status: z.string(),
});

type FormValues = z.infer<typeof schema>;

interface NewImagePreview {
  file: File;
  previewUrl: string;
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function EditListingSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6" aria-label="Loading">
      <div className="h-5 w-32 bg-muted animate-pulse rounded" />
      <div className="h-7 w-48 bg-muted animate-pulse rounded" />
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-4 w-20 bg-muted animate-pulse rounded" />
            <div className="h-10 bg-muted animate-pulse rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Edit form ──────────────────────────────────────────────────────────────

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const { data: listing, isLoading, isError } = useListing(id);
  const { data: categoriesData } = useCategories();
  const updateListing = useUpdateListing(id);
  const deleteImage = useDeleteListingImage(id);

  const [acceptsCrypto, setAcceptsCrypto] = useState(false);
  const [selectedCryptos, setSelectedCryptos] = useState<CryptoPaymentMethod[]>([]);
  const [selectedCondition, setSelectedCondition] = useState<string>('');
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [countrySearch, setCountrySearch] = useState('');
  const [currencySearch, setCurrencySearch] = useState('');
  const [existingImages, setExistingImages] = useState<ListingImage[]>([]);
  const [newImages, setNewImages] = useState<NewImagePreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [initialised, setInitialised] = useState(false);

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

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      currency: 'USD',
      price_indication: '',
    },
  });

  const selectedCurrency = watch('currency');

  // Pre-fill form once listing loads
  useEffect(() => {
    if (listing && !initialised) {
      reset({
        title: listing.title,
        description: listing.description,
        category_id: listing.category_id ? String(listing.category_id) : undefined,
        price_indication: listing.price_indication ?? '',
        currency: listing.currency ?? 'USD',
        status: listing.status,
      });
      const cryptoMethods = listing.payment_methods.filter(
        (m) => (CRYPTO_PAYMENT_METHODS as readonly string[]).includes(m),
      ) as CryptoPaymentMethod[];
      setSelectedCryptos(cryptoMethods);
      setAcceptsCrypto(cryptoMethods.length > 0);
      setSelectedCondition(listing.condition ?? '');
      setSelectedCountry(listing.country_code ?? '');
      setExistingImages(listing.images ?? []);
      setInitialised(true);
    }
  }, [listing, initialised, reset, categoriesData]);

  // Owner guard — redirect non-owners or sold listings
  useEffect(() => {
    if (!isLoading && listing) {
      if ((user && user.nickname !== listing.seller_nickname) || listing.status === 'sold') {
        router.replace(`/listings/${id}`);
      }
    }
  }, [isLoading, listing, user, id, router]);

  // ── Crypto toggles ─────────────────────────────────────────────────────

  function toggleCrypto(method: CryptoPaymentMethod) {
    setSelectedCryptos((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method],
    );
  }

  function handleCategoryChange(val: string) {
    setValue('category_id', val === 'none' ? undefined : val);
  }

  // ── Existing image removal ─────────────────────────────────────────────

  async function handleRemoveExisting(imageId: string) {
    await deleteImage.mutateAsync(imageId);
    setExistingImages((prev) => prev.filter((img) => img.id !== imageId));
  }

  // ── New image handling ─────────────────────────────────────────────────

  const totalImages = existingImages.length + newImages.length;

  function addFiles(files: File[]) {
    const imageFiles = files.filter((f) => f.type.startsWith('image/'));
    const remaining = MAX_IMAGES - totalImages;
    const toAdd = imageFiles.slice(0, remaining);
    const previews = toAdd.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setNewImages((prev) => [...prev, ...previews]);
  }

  function removeNewImage(idx: number) {
    setNewImages((prev) => {
      URL.revokeObjectURL(prev[idx].previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      addFiles(Array.from(e.dataTransfer.files));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [existingImages.length, newImages.length],
  );

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

    if (acceptsCrypto && selectedCryptos.length === 0) {
      setServerError('Select at least one cryptocurrency.');
      return;
    }

    try {
      await updateListing.mutateAsync({
        title: values.title,
        description: values.description,
        payment_methods: acceptsCrypto ? selectedCryptos : [],
        price_indication: values.price_indication,
        currency: values.currency,
        status: values.status as ListingStatus,
        country_code: selectedCountry,
        condition: (selectedCondition as ListingCondition) || null,
        ...(values.category_id ? { category_id: Number(values.category_id) } : {}),
      });

      // Upload new images
      for (const img of newImages) {
        await listingsApi.uploadListingImage(id, img.file).catch(() => {
          // non-fatal
        });
      }

      router.push(`/listings/${id}`);
    } catch (err) {
      setServerError('Failed to save changes. Please try again.');
      console.error(err);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  if (isLoading) return <EditListingSkeleton />;

  if (isError || !listing) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-2">
        <p className="text-lg font-medium">Listing not found</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/listings">Browse listings</Link>
        </Button>
      </div>
    );
  }

  const isProcessing = isSubmitting || updateListing.isPending;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/listings/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to listing
        </Link>
        <h1 className="text-2xl font-bold">Edit listing</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
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
          <Select
            value={listing.category_id ? String(listing.category_id) : 'none'}
            onValueChange={handleCategoryChange}
          >
            <SelectTrigger id="category" aria-label="Category">
              <SelectValue />
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

        {/* Status */}
        <div className="space-y-1.5">
          <Label htmlFor="status">Status</Label>
          <Select
            defaultValue={listing.status}
            onValueChange={(val) => setValue('status', val)}
          >
            <SelectTrigger id="status" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Country */}
        <div className="space-y-1.5">
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

        {/* Images */}
        <div className="space-y-2">
          <Label>Images ({totalImages}/{MAX_IMAGES})</Label>

          {/* Existing images */}
          {existingImages.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {existingImages.map((img) => (
                <div
                  key={img.id}
                  className="relative w-20 h-20 rounded-lg overflow-hidden border border-border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/images/${img.storage_key}`}
                    alt="Listing image"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveExisting(img.id)}
                    disabled={deleteImage.isPending}
                    className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-background/80 flex items-center justify-center hover:bg-background transition-colors"
                    aria-label={`Remove existing image`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* New image previews */}
          {newImages.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {newImages.map((img, i) => (
                <div
                  key={img.previewUrl}
                  className="relative w-20 h-20 rounded-lg overflow-hidden border border-border border-dashed"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.previewUrl}
                    alt={`New image ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeNewImage(i)}
                    className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-background/80 flex items-center justify-center hover:bg-background transition-colors"
                    aria-label={`Remove new image ${i + 1}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Drop zone — only shown when under limit */}
          {totalImages < MAX_IMAGES && (
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
                Drag & drop to add more images
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
        </div>

        {/* Server error */}
        {serverError && serverError !== 'Select at least one cryptocurrency.' && (
          <p className="text-sm text-destructive" role="alert">
            {serverError}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isProcessing} className="flex-1">
            {isProcessing ? 'Saving…' : 'Save changes'}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href={`/listings/${id}`}>Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
