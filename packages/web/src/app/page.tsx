'use client';

import Link from 'next/link';
import { Shield, Zap, Lock, ArrowRight, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useListings } from '@/hooks/use-listings';
import { ListingCard, ListingCardSkeleton } from '@/components/listing-card';

const FEATURES = [
  {
    icon: Shield,
    title: 'No KYC, no surveillance',
    description: 'Sign up with Google. No government ID, no address, no phone number required.',
  },
  {
    icon: Lock,
    title: 'End-to-end encrypted messages',
    description: 'Every conversation is encrypted with keys that only you hold.',
  },
  {
    icon: Zap,
    title: 'Crypto-native payments',
    description: 'Accept BTC, XMR, ETH, cash, or bank transfer — you choose, you negotiate.',
  },
  {
    icon: Globe,
    title: 'Bulletin-board model',
    description: 'No escrow, no middleman. Buyers and sellers connect directly.',
  },
];

const HOW_IT_WORKS = [
  { step: '01', title: 'Create an account', body: 'Sign in with Google and choose a password to protect your encrypted keys.' },
  { step: '02', title: 'Post a listing', body: 'Describe what you\'re selling or trading. Set your price and accepted payment methods.' },
  { step: '03', title: 'Connect with buyers', body: 'Encrypted messages keep your conversation private from day one.' },
  { step: '04', title: 'Close the deal', body: 'Agree on terms, exchange payment, and leave a rating for the community.' },
];

function RecentListings() {
  const { data, isLoading } = useListings({ limit: 6 });

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ListingCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const listings = data?.listings ?? [];
  if (listings.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative px-4 py-24 sm:py-32 text-center">
        <div className="mx-auto max-w-3xl">
          <Badge variant="outline" className="mb-6 text-orange-400 border-orange-400/40">
            Free &middot; Open source &middot; Privacy-first
          </Badge>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-6">
            Trade anything,{' '}
            <span className="text-orange-400">privately</span>
          </h1>
          <p className="text-lg sm:text-xl text-neutral-400 max-w-2xl mx-auto mb-10">
            Bartr is a peer-to-peer marketplace for crypto, goods, and skills.
            No fees, no KYC, no surveillance — just people trading with people.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-orange-500 hover:bg-orange-600 text-white">
              <Link href="/listings">Browse listings <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/listings/create">Post a listing</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-16 border-t border-neutral-800">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">
            Built for privacy
          </h2>
          <div className="grid gap-8 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex gap-4">
                <div className="flex-shrink-0 mt-1">
                  <div className="h-10 w-10 rounded-lg bg-orange-400/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-orange-400" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{title}</h3>
                  <p className="text-sm text-neutral-400">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-16 border-t border-neutral-800 bg-neutral-900/30">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">
            How it works
          </h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map(({ step, title, body }) => (
              <div key={step} className="text-center">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-orange-400/10 text-orange-400 font-bold text-lg mb-4">
                  {step}
                </div>
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-sm text-neutral-400">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent listings */}
      <section className="px-4 py-16 border-t border-neutral-800">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold">Recent listings</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/listings">View all <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </div>
          <RecentListings />
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-16 border-t border-neutral-800 text-center">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">Start trading today</h2>
          <p className="text-neutral-400 mb-8">
            Join the community. No credit card, no ID, no hassle.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-orange-500 hover:bg-orange-600 text-white">
              <Link href="/register">Create account</Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link href="/about">Learn more</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
