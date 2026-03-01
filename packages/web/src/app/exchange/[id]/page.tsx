'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowUp, ArrowDown, MessageSquare } from 'lucide-react';
import { useOffer } from '@/hooks/use-exchange';
import { useAuth } from '@/contexts/auth-context';
import { PaymentIcon } from '@/components/payment-icon';
import { PriceTicker } from '@/components/price-ticker';
import { CoinIcon } from '@/components/crypto-icons';
import { getCountryFlag, getCountryName } from '@/lib/countries';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { PaymentMethod } from '@bartr/shared';

function OfferDetailSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6" aria-label="Loading">
      <div className="h-5 w-32 bg-muted animate-pulse rounded" />
      <div className="h-8 w-64 bg-muted animate-pulse rounded" />
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function OfferDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  const { data: offer, isLoading, isError } = useOffer(id);

  if (isLoading) return <OfferDetailSkeleton />;

  if (isError || !offer) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-3">
        <p className="text-lg font-medium">Offer not found</p>
        <Button asChild variant="outline">
          <Link href="/exchange">Back to exchange</Link>
        </Button>
      </div>
    );
  }

  const isBuy = offer.offer_type === 'buy';
  const isOwner = user?.id === offer.user_id;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/exchange"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to exchange
        </Link>

        <div className="flex items-center gap-3">
          <Badge variant={isBuy ? 'default' : 'secondary'} className="gap-1 text-sm">
            {isBuy ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
            {isBuy ? 'Buying' : 'Selling'}
          </Badge>
          <span className="inline-flex items-center gap-2">
            <CoinIcon symbol={offer.crypto_currency} className="h-6 w-6" />
            <h1 className="text-2xl font-bold">
              {offer.crypto_currency}/{offer.fiat_currency}
            </h1>
          </span>
        </div>
      </div>

      {/* Offer details card */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        {/* Price */}
        <div>
          <p className="text-sm text-muted-foreground mb-1">Price</p>
          {offer.rate_type === 'fixed' ? (
            <p className="text-2xl font-bold">
              {offer.fixed_price?.toLocaleString()} {offer.fiat_currency}
            </p>
          ) : (
            <div>
              <PriceTicker
                crypto={offer.crypto_currency}
                fiat={offer.fiat_currency}
                source={offer.price_source}
                className="text-2xl font-bold"
              />
              {offer.margin_percent !== 0 && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {offer.margin_percent > 0 ? '+' : ''}{offer.margin_percent}% margin
                </p>
              )}
            </div>
          )}
        </div>

        {/* Limits */}
        {(offer.min_amount || offer.max_amount) && (
          <div>
            <p className="text-sm text-muted-foreground mb-1">Trade limits</p>
            <p className="font-medium">
              {offer.min_amount ? `${offer.min_amount.toLocaleString()} ${offer.fiat_currency}` : 'No min'}
              {' — '}
              {offer.max_amount ? `${offer.max_amount.toLocaleString()} ${offer.fiat_currency}` : 'No max'}
            </p>
          </div>
        )}

        {/* Payment methods */}
        <div>
          <p className="text-sm text-muted-foreground mb-1.5">Payment methods</p>
          <div className="flex flex-wrap gap-2">
            {offer.payment_methods.map((pm) => (
              <Badge key={pm} variant="outline" className="text-sm px-2.5 py-0.5">
                <PaymentIcon method={pm as PaymentMethod} longLabel />
              </Badge>
            ))}
          </div>
        </div>

        {/* Country */}
        {offer.country_code && (
          <div>
            <p className="text-sm text-muted-foreground mb-1">Location</p>
            <p className="font-medium">
              {getCountryFlag(offer.country_code)} {getCountryName(offer.country_code)}
            </p>
          </div>
        )}

        {/* Terms */}
        {offer.terms && (
          <div>
            <p className="text-sm text-muted-foreground mb-1">Trade terms</p>
            <p className="text-sm whitespace-pre-wrap">{offer.terms}</p>
          </div>
        )}
      </div>

      {/* Seller info */}
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground mb-2">
          {isBuy ? 'Buyer' : 'Seller'}
        </p>
        <Link
          href={`/user/${offer.seller_nickname}`}
          className="text-lg font-medium hover:underline"
        >
          {offer.seller_nickname}
        </Link>
      </div>

      {/* Actions */}
      {isAuthenticated && !isOwner && (
        <div className="flex gap-3">
          <Button asChild className="flex-1">
            <Link href={`/messages?contact=${offer.seller_nickname}&offer=${offer.id}`}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Contact {isBuy ? 'buyer' : 'seller'}
            </Link>
          </Button>
        </div>
      )}

      {isOwner && (
        <div className="text-sm text-muted-foreground text-center">
          This is your offer. You can manage it from{' '}
          <Link href="/dashboard/offers" className="text-primary hover:underline">
            My Offers
          </Link>
          .
        </div>
      )}
    </div>
  );
}
