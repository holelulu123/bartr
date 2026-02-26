'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Image as ImageIcon, X } from 'lucide-react';
import { ProtectedRoute } from '@/components/protected-route';
import { useCreateListing, useCategories } from '@/hooks/use-listings';
import { moderation as moderationApi, listings as listingsApi } from '@/lib/api';
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
import type { PaymentMethod } from '@bartr/shared';

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'btc', label: 'BTC' },
  { value: 'xmr', label: 'XMR' },
  { value: 'eth', label: 'ETH' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
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

  const [selectedPayments, setSelectedPayments] = useState<PaymentMethod[]>([]);
  const [images, setImages] = useState<ImagePreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const createListing = useCreateListing();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  // ── Payment method toggles ─────────────────────────────────────────────

  function togglePayment(method: PaymentMethod) {
    setSelectedPayments((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method],
    );
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

    if (selectedPayments.length === 0) {
      setServerError('Select at least one payment method.');
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
        payment_methods: selectedPayments,
        ...(values.category_id && { category_id: Number(values.category_id) }),
        ...(values.price_indication && { price_indication: values.price_indication }),
        ...(values.currency && { currency: values.currency }),
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
          <Select
            onValueChange={(val) => setValue('category_id', val === 'none' ? undefined : val)}
            defaultValue="none"
          >
            <SelectTrigger id="category" aria-label="Category">
              <SelectValue placeholder="Select a category" />
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
              aria-describedby={errors.price_indication ? 'price-error' : undefined}
            />
            {errors.price_indication && (
              <p id="price-error" className="text-sm text-destructive">
                {errors.price_indication.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="currency">Currency (optional)</Label>
            <Input
              id="currency"
              placeholder="e.g. BTC, USD"
              {...register('currency')}
              aria-describedby={errors.currency ? 'currency-error' : undefined}
            />
            {errors.currency && (
              <p id="currency-error" className="text-sm text-destructive">
                {errors.currency.message}
              </p>
            )}
          </div>
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
        {serverError && serverError !== 'Select at least one payment method.' && (
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
