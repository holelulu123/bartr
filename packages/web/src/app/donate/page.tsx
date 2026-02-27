'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DONATION_ADDRESSES = [
  {
    key: 'btc',
    label: 'Bitcoin (BTC)',
    address: 'bc1qexampleaddresshere',
    icon: '₿',
    colorClass: 'text-orange-400',
    borderClass: 'border-orange-400/30',
    bgClass: 'bg-orange-400/5',
    qrScheme: 'bitcoin',
  },
  {
    key: 'lightning',
    label: 'Lightning Network',
    address: 'lnbc1examplelightninginvoice',
    icon: '⚡',
    colorClass: 'text-yellow-400',
    borderClass: 'border-yellow-400/30',
    bgClass: 'bg-yellow-400/5',
    qrScheme: 'lightning',
  },
];

// Minimal deterministic QR-like placeholder rendered as SVG.
// Replace with a real QR library (e.g. `qrcode`) when real addresses are set.
function QrPlaceholder({ value, size = 120 }: { value: string; size?: number }) {
  // Generate a simple seeded grid pattern from the string so each address looks different.
  const cells = 11;
  const cellSize = size / cells;
  const bits: boolean[] = [];
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  for (let i = 0; i < cells * cells; i++) {
    const h = ((hash * (i + 1) * 2654435761) | 0) >>> 0;
    bits.push((h >>> (i % 32)) % 2 === 0);
  }
  // Mirror left half to right for QR-like symmetry
  const grid: boolean[][] = Array.from({ length: cells }, (_, r) =>
    Array.from({ length: cells }, (_, c) => {
      const mirrored = c > cells / 2 ? bits[r * cells + (cells - 1 - c)] : bits[r * cells + c];
      return mirrored;
    }),
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-label={`QR code for ${value}`}
      className="rounded"
    >
      <rect width={size} height={size} fill="white" />
      {grid.map((row, r) =>
        row.map((on, c) =>
          on ? (
            <rect
              key={`${r}-${c}`}
              x={c * cellSize}
              y={r * cellSize}
              width={cellSize}
              height={cellSize}
              fill="black"
            />
          ) : null,
        ),
      )}
      {/* Finder patterns (corners) */}
      {[
        [0, 0], [0, cells - 7], [cells - 7, 0],
      ].map(([tr, tc]) => (
        <g key={`fp-${tr}-${tc}`}>
          <rect x={tc * cellSize} y={tr * cellSize} width={7 * cellSize} height={7 * cellSize} fill="black" />
          <rect x={(tc + 1) * cellSize} y={(tr + 1) * cellSize} width={5 * cellSize} height={5 * cellSize} fill="white" />
          <rect x={(tc + 2) * cellSize} y={(tr + 2) * cellSize} width={3 * cellSize} height={3 * cellSize} fill="black" />
        </g>
      ))}
    </svg>
  );
}

function DonationCard({
  label,
  address,
  icon,
  colorClass,
  borderClass,
  bgClass,
  qrScheme,
}: {
  label: string;
  address: string;
  icon: string;
  colorClass: string;
  borderClass: string;
  bgClass: string;
  qrScheme: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (non-HTTPS) — silently ignore
    }
  };

  const qrValue = qrScheme === 'lightning' ? address : `${qrScheme}:${address}`;

  return (
    <div className={`rounded-xl border ${borderClass} ${bgClass} p-6`}>
      <div className="flex items-center gap-3 mb-4">
        <span className={`text-3xl ${colorClass}`}>{icon}</span>
        <h2 className={`text-xl font-semibold ${colorClass}`}>{label}</h2>
      </div>

      {/* QR code */}
      <div className="flex justify-center mb-4">
        <QrPlaceholder value={qrValue} size={120} />
      </div>

      <p className="text-xs text-neutral-500 mb-2">Address</p>
      <code className="block text-sm text-neutral-300 bg-neutral-800/60 rounded-lg px-3 py-2 break-all select-all leading-relaxed">
        {address}
      </code>

      <Button
        variant="outline"
        size="sm"
        className="mt-4 w-full gap-2"
        onClick={handleCopy}
      >
        {copied ? (
          <>
            <Check className="h-4 w-4 text-green-400" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" />
            Copy address
          </>
        )}
      </Button>
    </div>
  );
}

function ExpenseRow({ label, amount, percent }: { label: string; amount: string; percent: number }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-neutral-300">{label}</span>
        <span className="text-neutral-500">{amount}</span>
      </div>
      <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
        <div className="h-full bg-orange-400/60 rounded-full" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export default function DonatePage() {
  return (
    <main className="min-h-screen px-4 py-16">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Support Bartr</h1>
          <p className="text-neutral-400 max-w-xl mx-auto">
            Bartr is a free, volunteer-run, privacy-first marketplace with no fees, no KYC, and no ads.
            Donations help cover server costs and keep it running for everyone.
          </p>
        </div>

        {/* Donation cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {DONATION_ADDRESSES.map((addr) => (
            <DonationCard key={addr.key} {...addr} />
          ))}
        </div>

        {/* Expense breakdown */}
        <div className="mt-16 border border-neutral-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Where your donation goes</h2>
          <div className="space-y-3">
            <ExpenseRow label="VPS hosting" amount="~$20/mo" percent={50} />
            <ExpenseRow label="Domain & DNS" amount="~$5/mo" percent={12} />
            <ExpenseRow label="Backups & storage" amount="~$5/mo" percent={12} />
            <ExpenseRow label="Development time" amount="~$10/mo" percent={26} />
          </div>
          <p className="text-xs text-neutral-500 mt-4">
            Total estimated monthly cost: ~$40. Any surplus is saved for infrastructure upgrades.
          </p>
        </div>

        {/* Back link */}
        <div className="text-center mt-12">
          <Link href="/" className="text-neutral-500 hover:text-neutral-300 transition text-sm">
            &larr; Back to Bartr
          </Link>
        </div>
      </div>
    </main>
  );
}
