import { BtcIcon, EthIcon, UsdtIcon, UsdcIcon, CashIcon, BankIcon } from '@/components/crypto-icons';
import type { PaymentMethod } from '@bartr/shared';
import { cn } from '@/lib/utils';

const PAYMENT_CONFIG: Record<PaymentMethod, { icon: React.FC<{ className?: string }>; label: string }> = {
  btc: { icon: BtcIcon, label: 'BTC' },
  eth: { icon: EthIcon, label: 'ETH' },
  usdt: { icon: UsdtIcon, label: 'USDT' },
  usdc: { icon: UsdcIcon, label: 'USDC' },
  cash: { icon: CashIcon, label: 'Cash' },
  bank_transfer: { icon: BankIcon, label: 'Bank' },
};

const PAYMENT_CONFIG_LONG: Record<PaymentMethod, string> = {
  btc: 'Bitcoin',
  eth: 'Ethereum',
  usdt: 'USDT',
  usdc: 'USDC',
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
};

interface PaymentIconProps {
  method: PaymentMethod;
  showLabel?: boolean;
  longLabel?: boolean;
  className?: string;
  iconClassName?: string;
}

export function PaymentIcon({ method, showLabel = true, longLabel = false, className, iconClassName }: PaymentIconProps) {
  const config = PAYMENT_CONFIG[method];
  if (!config) return <span>{method}</span>;

  const Icon = config.icon;
  const label = longLabel ? PAYMENT_CONFIG_LONG[method] : config.label;

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <Icon className={cn('h-5 w-5 shrink-0', iconClassName)} />
      {showLabel && <span>{label}</span>}
    </span>
  );
}

export function getPaymentLabel(method: PaymentMethod, long = false): string {
  if (long) return PAYMENT_CONFIG_LONG[method] ?? method;
  return PAYMENT_CONFIG[method]?.label ?? method;
}
