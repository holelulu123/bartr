import { cn } from '@/lib/utils';

interface IconProps {
  className?: string;
}

// ── Crypto icons using official SVG logos from /icons/ ─────────────────────

function CryptoImg({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return <img src={src} alt={alt} className={cn('h-4 w-4', className)} />;
}

export function BtcIcon({ className }: IconProps) {
  return <CryptoImg src="/icons/btc.svg" alt="BTC" className={className} />;
}

export function EthIcon({ className }: IconProps) {
  return <CryptoImg src="/icons/eth.svg" alt="ETH" className={className} />;
}

export function UsdtIcon({ className }: IconProps) {
  return <CryptoImg src="/icons/usdt.svg" alt="USDT" className={className} />;
}

export function UsdcIcon({ className }: IconProps) {
  return <CryptoImg src="/icons/usdc.svg" alt="USDC" className={className} />;
}

export function SolIcon({ className }: IconProps) {
  return <CryptoImg src="/icons/sol.svg" alt="SOL" className={className} />;
}

export function XrpIcon({ className }: IconProps) {
  return <CryptoImg src="/icons/xrp.svg" alt="XRP" className={className} />;
}

export function TrxIcon({ className }: IconProps) {
  return <CryptoImg src="/icons/trx.svg" alt="TRX" className={className} />;
}

export function TonIcon({ className }: IconProps) {
  return <CryptoImg src="/icons/ton.svg" alt="TON" className={className} />;
}

// ── Non-crypto icons (keep as inline SVG) ─────────────────────────────────

// Cash — green circle with $ symbol
export function CashIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn('h-4 w-4', className)}>
      <circle cx="12" cy="12" r="11" fill="#16a34a" />
      <path
        d="M12.5 7v1.2c1.3.2 2.2 1 2.3 2h-1.5c-.1-.5-.5-.8-1.1-.8-.7 0-1.1.3-1.1.8 0 .4.3.6 1.1.8l.6.2c1.5.3 2.2.9 2.2 2 0 1.1-.8 1.8-2.2 2V17h-1v-1.8c-1.4-.2-2.3-1-2.4-2.1h1.5c.1.6.5.9 1.2.9.7 0 1.2-.3 1.2-.8 0-.4-.3-.7-1.2-.9l-.6-.1c-1.3-.3-2.1-.9-2.1-1.9 0-1 .8-1.8 2.1-2V7h1z"
        fill="white"
      />
    </svg>
  );
}

// Bank — blue circle with building
export function BankIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn('h-4 w-4', className)}>
      <circle cx="12" cy="12" r="11" fill="#3b82f6" />
      <path d="M12 5.5l-6 3.5h12l-6-3.5z" fill="white" />
      <rect x="7.5" y="10" width="1.5" height="4" fill="white" />
      <rect x="11.25" y="10" width="1.5" height="4" fill="white" />
      <rect x="15" y="10" width="1.5" height="4" fill="white" />
      <rect x="6.5" y="14.5" width="11" height="1.5" rx="0.3" fill="white" />
    </svg>
  );
}

// Generic crypto fallback — grey circle with abbreviation
export function GenericCoinIcon({ className, label }: IconProps & { label?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn('h-4 w-4', className)}>
      <circle cx="12" cy="12" r="11" fill="#6b7280" />
      {label ? (
        <text x="12" y="15" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">
          {label.slice(0, 3)}
        </text>
      ) : (
        <circle cx="12" cy="12" r="4" stroke="white" strokeWidth="1.5" fill="none" />
      )}
    </svg>
  );
}

// Map symbol → icon component
export const CRYPTO_ICONS: Record<string, React.FC<IconProps>> = {
  BTC: BtcIcon,
  ETH: EthIcon,
  USDT: UsdtIcon,
  USDC: UsdcIcon,
  SOL: SolIcon,
  XRP: XrpIcon,
  TRX: TrxIcon,
  TON: TonIcon,
};

export function CoinIcon({ symbol, className }: { symbol: string; className?: string }) {
  const Icon = CRYPTO_ICONS[symbol];
  if (Icon) return <Icon className={className} />;
  return <GenericCoinIcon className={className} label={symbol} />;
}
