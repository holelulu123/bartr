import Link from 'next/link';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PriceTicker } from '@/components/price-ticker';
import { CoinIcon } from '@/components/crypto-icons';
import { Button } from '@/components/ui/button';
import { getCountryFlag } from '@/lib/countries';
import type { ExchangeOffer } from '@/lib/api';
import { SETTLEMENT_METHOD_LABELS } from '@bartr/shared';
import type { SettlementMethod } from '@bartr/shared';

interface OfferRowProps {
  offer: ExchangeOffer;
}

export function OfferRow({ offer }: OfferRowProps) {
  const isBuy = offer.offer_type === 'buy';

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3">
      {/* Type indicator */}
      <div className="shrink-0">
        <Badge variant={isBuy ? 'default' : 'secondary'} className="gap-1">
          {isBuy ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
          {isBuy ? 'Buy' : 'Sell'}
        </Badge>
      </div>

      {/* Crypto pair */}
      <div className="min-w-0">
        <p className="text-sm font-medium inline-flex items-center gap-1.5">
          <CoinIcon symbol={offer.crypto_currency} className="h-5 w-5" />
          {offer.crypto_currency}/{offer.fiat_currency}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {offer.country_code && (
            <span className="mr-1">{getCountryFlag(offer.country_code)}</span>
          )}
          {offer.seller_nickname}
        </p>
      </div>

      {/* Price */}
      <div className="text-sm text-right min-w-0 flex-1">
        {offer.rate_type === 'fixed' ? (
          <p className="font-medium">
            {offer.fixed_price?.toLocaleString()} {offer.fiat_currency}
          </p>
        ) : (
          <div>
            <PriceTicker
              crypto={offer.crypto_currency}
              fiat={offer.fiat_currency}
              className="font-medium"
            />
            {offer.margin_percent !== 0 && (
              <p className="text-xs text-muted-foreground">
                {offer.margin_percent > 0 ? '+' : ''}{offer.margin_percent}%
              </p>
            )}
          </div>
        )}
      </div>

      {/* Limits */}
      <div className="hidden sm:block text-xs text-muted-foreground text-right shrink-0">
        {offer.min_amount || offer.max_amount ? (
          <>
            {offer.min_amount && <span>{offer.min_amount.toLocaleString()}</span>}
            {offer.min_amount && offer.max_amount && <span> - </span>}
            {offer.max_amount && <span>{offer.max_amount.toLocaleString()}</span>}
            <span className="ml-0.5">{offer.fiat_currency}</span>
          </>
        ) : (
          <span>Any amount</span>
        )}
      </div>

      {/* Settlement methods */}
      <div className="hidden md:flex flex-wrap gap-1 shrink-0 max-w-[160px]">
        {offer.payment_methods.slice(0, 2).map((pm) => (
          <Badge key={pm} variant="outline" className="text-xs px-1.5 py-0">
            {SETTLEMENT_METHOD_LABELS[pm as SettlementMethod] ?? pm}
          </Badge>
        ))}
        {offer.payment_methods.length > 2 && (
          <Badge variant="outline" className="text-xs px-1.5 py-0">
            +{offer.payment_methods.length - 2}
          </Badge>
        )}
      </div>

      {/* Action */}
      <div className="shrink-0">
        <Button asChild size="sm" variant="outline">
          <Link href={`/exchange/${offer.id}`}>
            {isBuy ? 'Sell' : 'Buy'}
          </Link>
        </Button>
      </div>
    </div>
  );
}
