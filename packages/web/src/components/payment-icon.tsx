import { BtcIcon, EthIcon, UsdtIcon, UsdcIcon, SolIcon, XrpIcon, TrxIcon, TonIcon, CashIcon, BankIcon, GenericCoinIcon } from '@/components/crypto-icons';
import { PAYMENT_METHOD_LABELS } from '@bartr/shared';
import type { PaymentMethod } from '@bartr/shared';
import { cn } from '@/lib/utils';

const PAYMENT_ICONS: Partial<Record<PaymentMethod, React.FC<{ className?: string }>>> = {
  btc: BtcIcon,
  eth: EthIcon,
  usdt: UsdtIcon,
  usdc: UsdcIcon,
  sol: SolIcon,
  xrp: XrpIcon,
  trx: TrxIcon,
  ton: TonIcon,
  cash: CashIcon,
  bank_transfer: BankIcon,
};

const SHORT_LABELS: Partial<Record<PaymentMethod, string>> = {
  btc: 'BTC',
  eth: 'ETH',
  usdt: 'USDT',
  usdc: 'USDC',
  sol: 'SOL',
  xrp: 'XRP',
  trx: 'TRX',
  ton: 'TON',
  cash: 'Cash',
  bank_transfer: 'Bank',
};

interface PaymentIconProps {
  method: PaymentMethod;
  showLabel?: boolean;
  longLabel?: boolean;
  className?: string;
  iconClassName?: string;
}

export function PaymentIcon({ method, showLabel = true, longLabel = false, className, iconClassName }: PaymentIconProps) {
  const Icon = PAYMENT_ICONS[method];
  const label = longLabel
    ? (PAYMENT_METHOD_LABELS[method] ?? method)
    : (SHORT_LABELS[method] ?? PAYMENT_METHOD_LABELS[method] ?? method);

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      {Icon ? (
        <Icon className={cn('h-5 w-5 shrink-0', iconClassName)} />
      ) : (
        <GenericCoinIcon className={cn('h-5 w-5 shrink-0', iconClassName)} label={method} />
      )}
      {showLabel && <span>{label}</span>}
    </span>
  );
}

export function getPaymentLabel(method: PaymentMethod, long = false): string {
  if (long) return PAYMENT_METHOD_LABELS[method] ?? method;
  return SHORT_LABELS[method] ?? PAYMENT_METHOD_LABELS[method] ?? method;
}
