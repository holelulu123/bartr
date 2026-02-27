'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Image as ImageIcon, X } from 'lucide-react';
import { useListing, useUpdateListing, useDeleteListingImage, useCategories } from '@/hooks/use-listings';
import { useAuth } from '@/contexts/auth-context';
import { listings as listingsApi } from '@/lib/api';
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
import type { PaymentMethod, ListingStatus } from '@bartr/shared';
import type { ListingImage } from '@/lib/api';

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'btc', label: 'BTC' },
  { value: 'eth', label: 'ETH' },
  { value: 'usdt', label: 'USDT' },
  { value: 'usdc', label: 'USDC' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank transfer' },
];

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
  price_indication: z.string().max(50, 'Price too long').optional(),
  currency: z.string().max(10, 'Currency too long').optional(),
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

  const [selectedPayments, setSelectedPayments] = useState<PaymentMethod[]>([]);
  const [existingImages, setExistingImages] = useState<ListingImage[]>([]);
  const [newImages, setNewImages] = useState<NewImagePreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [initialised, setInitialised] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  // Pre-fill form once listing loads
  useEffect(() => {
    if (listing && !initialised) {
      reset({
        title: listing.title,
        description: listing.description,
        category_id: listing.category_id ? String(listing.category_id) : undefined,
        price_indication: listing.price_indication ?? '',
        currency: listing.currency ?? '',
        status: listing.status,
      });
      setSelectedPayments(listing.payment_methods);
      setExistingImages(listing.images ?? []);
      setInitialised(true);
    }
  }, [listing, initialised, reset]);

  // Owner guard — redirect non-owners
  useEffect(() => {
    if (!isLoading && listing && user && user.nickname !== listing.seller_nickname) {
      router.replace(`/listings/${id}`);
    }
  }, [isLoading, listing, user, id, router]);

  // ── Payment toggles ────────────────────────────────────────────────────

  function togglePayment(method: PaymentMethod) {
    setSelectedPayments((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method],
    );
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

    if (selectedPayments.length === 0) {
      setServerError('Select at least one payment method.');
      return;
    }

    try {
      await updateListing.mutateAsync({
        title: values.title,
        description: values.description,
        payment_methods: selectedPayments,
        status: values.status as ListingStatus,
        ...(values.category_id ? { category_id: Number(values.category_id) } : {}),
        ...(values.price_indication ? { price_indication: values.price_indication } : {}),
        ...(values.currency ? { currency: values.currency } : {}),
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
            onValueChange={(val) => setValue('category_id', val === 'none' ? undefined : val)}
          >
            <SelectTrigger id="category" aria-label="Category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No category</SelectItem>
              {categoriesData?.categories.map((cat) => (
                <SelectItem key={cat.id} value={String(cat.id)}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Price */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="price_indication">Price (optional)</Label>
            <Input
              id="price_indication"
              placeholder="e.g. 0.005"
              {...register('price_indication')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="currency">Currency (optional)</Label>
            <Input
              id="currency"
              placeholder="e.g. BTC, USD"
              {...register('currency')}
            />
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
                    : 'bg-transparent border-border text-muted-foreground hover:border-primary/50',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {selectedPayments.length === 0 && serverError === 'Select at least one payment method.' && (
            <p className="text-sm text-destructive">Select at least one payment method.</p>
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
        {serverError && serverError !== 'Select at least one payment method.' && (
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
