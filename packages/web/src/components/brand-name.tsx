import { APP_NAME } from '@bartr/shared';

export function BrandName({ className }: { className?: string }) {
  return <span className={`font-bold text-primary ${className ?? ''}`}>{APP_NAME}</span>;
}
