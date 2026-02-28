import { cn } from '@/lib/utils';

interface IconProps {
  className?: string;
}

// Bitcoin — official orange circle with B stroke
export function BtcIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn('h-4 w-4', className)}>
      <circle cx="12" cy="12" r="11" fill="#F7931A" />
      <path
        d="M15.5 10.2c.2-1.5-.9-2.3-2.5-2.8l.5-2-1.2-.3-.5 2c-.3-.1-.6-.1-1-.2l.5-2L10.1 5l-.5 2c-.3-.1-.5-.1-.7-.2l-1.7-.4-.3 1.3s.9.2.9.2c.5.1.6.4.6.7l-.6 2.5v.2c0 0 0 .1-.1.1l.1.1c-.1 0-.4-.1-.6-.2l-.9.2.4 1.4 1.6.4c.3.1.6.1.9.2l-.5 2 1.2.3.5-2c.3.1.7.2 1 .2l-.5 2 1.2.3.5-2c2.1.4 3.6.2 4.3-1.6.5-1.5 0-2.3-1.1-2.8.8-.2 1.4-.7 1.5-1.8zm-2.7 3.8c-.4 1.5-2.8.7-3.6.5l.6-2.6c.8.2 3.4.6 3 2.1zm.4-3.8c-.3 1.4-2.4.7-3 .5l.6-2.3c.7.2 2.9.5 2.4 1.8z"
        fill="white"
      />
    </svg>
  );
}

// Ethereum — dark circle with diamond
export function EthIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn('h-4 w-4', className)}>
      <circle cx="12" cy="12" r="11" fill="#627EEA" />
      <path d="M12 4v5.9l5 2.2L12 4z" fill="white" fillOpacity="0.6" />
      <path d="M12 4L7 12.1l5-2.2V4z" fill="white" />
      <path d="M12 16.5v3.8l5-6.9-5 3.1z" fill="white" fillOpacity="0.6" />
      <path d="M12 20.3v-3.8l-5-3.1 5 6.9z" fill="white" />
      <path d="M12 15.4l5-3.3-5-2.2v5.5z" fill="white" fillOpacity="0.2" />
      <path d="M7 12.1l5 3.3V9.9l-5 2.2z" fill="white" fillOpacity="0.6" />
    </svg>
  );
}

// USDT Tether — green circle with T
export function UsdtIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn('h-4 w-4', className)}>
      <circle cx="12" cy="12" r="11" fill="#26A17B" />
      <path
        d="M13.4 12.2v-.1c-.1 0-.5 0-1.4 0s-1.2 0-1.4.1c-2.3.1-4 .6-4 1.1s1.7 1 4 1.1v3.1h2.8v-3.1c2.3-.1 4-.6 4-1.1s-1.7-1-4-1zm0 1.7v-.1c-.2 0-.6.1-1.4.1-.6 0-1.1 0-1.4-.1v.1c-2.1-.1-3.6-.5-3.6-.9 0-.4 1.6-.8 3.6-.9v1.4c.3 0 .8.1 1.4.1.8 0 1.2 0 1.4-.1V12c2.1.1 3.6.5 3.6.9 0 .5-1.6.8-3.6 1zM13.4 7H17V8.7h-8.1V7h3.7v-.5h2.8V7z"
        fill="white"
      />
    </svg>
  );
}

// USDC — blue circle with dollar
export function UsdcIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn('h-4 w-4', className)}>
      <circle cx="12" cy="12" r="11" fill="#2775CA" />
      <path
        d="M12 20.3c-4.6 0-8.3-3.7-8.3-8.3S7.4 3.7 12 3.7s8.3 3.7 8.3 8.3-3.7 8.3-8.3 8.3zm0-15.3C8 5 5 8 5 12s3 7 7 7 7-3 7-7-3-7-7-7z"
        fill="white"
      />
      <path
        d="M13.8 13.8c0-1.2-.8-1.6-2.3-1.8-1.1-.2-1.3-.4-1.3-.8s.4-.7 1.1-.7c.6 0 1 .2 1.2.6l.1.1h.9l-.1-.2c-.2-.8-.9-1.2-1.7-1.3V9h-1.1v.7c-1.1.1-1.8.8-1.8 1.6 0 1.1.7 1.5 2.2 1.7 1 .2 1.4.4 1.4.9s-.5.8-1.2.8c-.8 0-1.2-.3-1.4-.8l-.1-.1h-.9l.1.2c.2.8.9 1.4 1.9 1.5V16h1.1v-.7c1.1-.1 1.9-.8 1.9-1.5z"
        fill="white"
      />
    </svg>
  );
}

// Solana — purple gradient circle with S shape
export function SolIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn('h-4 w-4', className)}>
      <circle cx="12" cy="12" r="11" fill="#9945FF" />
      <path d="M8 15.5h7.3l1.2-1.3H8l-1.2 1.3H8z" fill="white" />
      <path d="M8 8.5l-1.2 1.3h8.5L16.5 8.5H8z" fill="white" />
      <path d="M8 12l-1.2 1.3h8.5l1.2-1.3H8z" fill="white" fillOpacity="0.8" />
    </svg>
  );
}

// Dogecoin — yellow circle with D
export function DogeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn('h-4 w-4', className)}>
      <circle cx="12" cy="12" r="11" fill="#C2A633" />
      <path
        d="M10.5 7.5H13c2.2 0 4 1.8 4 4s-1.8 4-4 4h-2.5v-8zm1.5 6.5h1c1.4 0 2.5-1.1 2.5-2.5S14.4 9 13 9h-1v5zm-2-3h4.5v1.2H10V11z"
        fill="white"
      />
    </svg>
  );
}

// Litecoin — silver/grey circle with L
export function LtcIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn('h-4 w-4', className)}>
      <circle cx="12" cy="12" r="11" fill="#BFBBBB" />
      <path
        d="M10.5 7.5h2l-1.5 5.5h3.5l-.5 1.5H9l.5-2 1.5-1-.5 1.5L10.5 7.5z"
        fill="white"
      />
      <path d="M8.5 13l3-2-.3 1-3 2 .3-1z" fill="white" />
    </svg>
  );
}

// XRP — dark circle with X
export function XrpIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn('h-4 w-4', className)}>
      <circle cx="12" cy="12" r="11" fill="#23292F" />
      <path
        d="M8 8l2.5 2.8L12 9.3l1.5 1.5L16 8h1.5l-3.8 4.1L17.5 16H16l-2.5-2.8-1.5 1.5-1.5-1.5L8 16H6.5l3.8-3.9L6.5 8H8z"
        fill="white"
      />
    </svg>
  );
}

// BNB — yellow circle with diamond shapes
export function BnbIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn('h-4 w-4', className)}>
      <circle cx="12" cy="12" r="11" fill="#F3BA2F" />
      <path
        d="M12 7l1.8 1.8L12 10.5l-1.8-1.7L12 7zm-3.5 3.5L10.3 12l-1.8 1.5L6.7 12l1.8-1.5zm7 0L17.3 12l-1.8 1.5L13.7 12l1.8-1.5zM12 13.5l1.8 1.7L12 17l-1.8-1.8L12 13.5z"
        fill="white"
      />
    </svg>
  );
}

// Cardano ADA — blue circle with star-like shape
export function AdaIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn('h-4 w-4', className)}>
      <circle cx="12" cy="12" r="11" fill="#0033AD" />
      <circle cx="12" cy="8" r="1" fill="white" />
      <circle cx="12" cy="16" r="1" fill="white" />
      <circle cx="8.5" cy="10" r="1" fill="white" />
      <circle cx="15.5" cy="10" r="1" fill="white" />
      <circle cx="8.5" cy="14" r="1" fill="white" />
      <circle cx="15.5" cy="14" r="1" fill="white" />
      <circle cx="12" cy="12" r="1.2" fill="white" />
    </svg>
  );
}

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

// Generic crypto fallback — grey circle with hex
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
  DOGE: DogeIcon,
  LTC: LtcIcon,
  XRP: XrpIcon,
  BNB: BnbIcon,
  ADA: AdaIcon,
};

export function CoinIcon({ symbol, className }: { symbol: string; className?: string }) {
  const Icon = CRYPTO_ICONS[symbol];
  if (Icon) return <Icon className={className} />;
  return <GenericCoinIcon className={className} label={symbol} />;
}
