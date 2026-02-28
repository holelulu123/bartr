'use client';

import { useState } from 'react';
import Link from 'next/link';
import QRCode from 'react-qr-code';
import { Copy, Check } from 'lucide-react';
import { BtcIcon } from '@/components/crypto-icons';
import { Button } from '@/components/ui/button';

const BTC_ADDRESS = 'bc1qexampleaddresshere';

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
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(BTC_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (non-HTTPS) — silently ignore
    }
  };

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

        {/* Bitcoin donation card */}
        <div className="max-w-md mx-auto rounded-xl border border-orange-400/30 bg-orange-400/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <BtcIcon className="h-8 w-8" />
            <h2 className="text-xl font-semibold text-orange-400">Bitcoin (BTC)</h2>
          </div>

          {/* QR code */}
          <div className="flex justify-center mb-4">
            <div className="bg-white p-3 rounded-lg">
              <QRCode
                value={`bitcoin:${BTC_ADDRESS}`}
                size={160}
                level="M"
              />
            </div>
          </div>

          <p className="text-xs text-neutral-500 mb-2">Address</p>
          <code className="block text-sm text-neutral-300 bg-neutral-800/60 rounded-lg px-3 py-2 break-all select-all leading-relaxed">
            {BTC_ADDRESS}
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
