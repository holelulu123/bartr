import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number, stripping trailing .00 (e.g. 555.00 → "555", 12.50 → "12.5") */
export function fmtAmount(val: number | string | null | undefined, decimals = 2): string {
  if (val === null || val === undefined) return '0';
  const n = Number(val);
  const formatted = n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  if (decimals <= 2) return formatted.replace(/\.00$/, '');
  return formatted;
}
