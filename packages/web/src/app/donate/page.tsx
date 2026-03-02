'use client';

import { useState } from 'react';
import Link from 'next/link';
import QRCode from 'react-qr-code';
import Image from 'next/image';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CoinOption {
  id: string;
  dropdownLabel: string;
  cardTitle: string;
  accepts: string;
  iconPath: string;
  address: string;
  qrPrefix: string;
  borderColor: string;
  bgColor: string;
  textColor: string;
}

const COINS: CoinOption[] = [
  {
    id: 'btc',
    dropdownLabel: 'Bitcoin (BTC)',
    cardTitle: 'Bitcoin (BTC)',
    accepts: 'BTC',
    iconPath: '/icons/btc.svg',
    address: process.env.NEXT_PUBLIC_BTC_ADDRESS ?? '',
    qrPrefix: 'bitcoin:',
    borderColor: 'border-orange-400/30',
    bgColor: 'bg-orange-400/5',
    textColor: 'text-orange-400',
  },
  {
    id: 'eth',
    dropdownLabel: 'Ethereum / USDT (ERC-20) / USDC (ERC-20)',
    cardTitle: 'Ethereum',
    accepts: 'ETH / USDT / USDC (ERC-20)',
    iconPath: '/icons/eth.svg',
    address: process.env.NEXT_PUBLIC_ETH_ADDRESS ?? '',
    qrPrefix: 'ethereum:',
    borderColor: 'border-indigo-400/30',
    bgColor: 'bg-indigo-400/5',
    textColor: 'text-indigo-400',
  },
  {
    id: 'sol',
    dropdownLabel: 'Solana / USDT (SPL) / USDC (SPL)',
    cardTitle: 'Solana',
    accepts: 'SOL / USDT / USDC (SPL)',
    iconPath: '/icons/sol.svg',
    address: process.env.NEXT_PUBLIC_SOL_ADDRESS ?? '',
    qrPrefix: 'solana:',
    borderColor: 'border-fuchsia-400/30',
    bgColor: 'bg-fuchsia-400/5',
    textColor: 'text-fuchsia-400',
  },
  {
    id: 'tron',
    dropdownLabel: 'TRON / USDT (TRC-20) / USDC (TRC-20)',
    cardTitle: 'TRON',
    accepts: 'TRX / USDT / USDC (TRC-20)',
    iconPath: '/icons/trx.svg',
    address: process.env.NEXT_PUBLIC_TRON_ADDRESS ?? '',
    qrPrefix: '',
    borderColor: 'border-red-400/30',
    bgColor: 'bg-red-400/5',
    textColor: 'text-red-400',
  },
  {
    id: 'ton',
    dropdownLabel: 'TON / USDT (Jetton)',
    cardTitle: 'TON',
    accepts: 'TON / USDT (Jetton)',
    iconPath: '/icons/ton.svg',
    address: process.env.NEXT_PUBLIC_TON_ADDRESS ?? '',
    qrPrefix: 'ton://transfer/',
    borderColor: 'border-sky-400/30',
    bgColor: 'bg-sky-400/5',
    textColor: 'text-sky-400',
  },
];

export default function DonatePage() {
  const [selectedId, setSelectedId] = useState('btc');
  const [copied, setCopied] = useState(false);

  const coin = COINS.find((c) => c.id === selectedId) ?? COINS[0];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(coin.address);
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
          <p className="text-neutral-400 text-lg max-w-xl mx-auto">
            Bartr is a free, volunteer-run, privacy-first marketplace and P2P crypto exchange with no
            fees, no KYC, and no ads.
          </p>
          <p className="text-neutral-400 text-lg max-w-xl mx-auto mt-3">
            We don&apos;t charge money and have no revenue — the project runs entirely on donations.
            Please help and donate so we can keep it running and support the crypto community.
          </p>
        </div>

        {/* Coin selector */}
        <div className="max-w-md mx-auto mb-4">
          <Select value={selectedId} onValueChange={(v) => { setSelectedId(v); setCopied(false); }}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COINS.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.dropdownLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Donation card */}
        <div className={`max-w-md mx-auto rounded-xl border ${coin.borderColor} ${coin.bgColor} p-6`}>
          <div className="flex items-center gap-3 mb-1">
            <Image src={coin.iconPath} alt={coin.cardTitle} width={32} height={32} />
            <h2 className={`text-xl font-semibold ${coin.textColor}`}>{coin.cardTitle}</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Accepts: {coin.accepts}
          </p>

          {coin.address ? (
            <>
              {/* QR code */}
              <div className="flex justify-center mb-4">
                <div className="bg-white p-3 rounded-lg">
                  <QRCode
                    value={`${coin.qrPrefix}${coin.address}`}
                    size={160}
                    level="M"
                  />
                </div>
              </div>

              <p className="text-xs text-neutral-500 mb-2">Address</p>
              <code className="block text-sm text-neutral-300 bg-neutral-800/60 rounded-lg px-3 py-2 break-all select-all leading-relaxed">
                {coin.address}
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
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Address not configured yet. Check back soon.
            </p>
          )}
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
