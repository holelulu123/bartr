import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandName } from '@/components/brand-name';

export const metadata: Metadata = {
  title: 'About — Bartr',
  description: 'Learn what Bartr is, how it works, and why we built it.',
};

export default function AboutPage() {
  return (
    <div className="px-4 py-16">
      <div className="mx-auto max-w-2xl prose prose-invert prose-neutral">
        <h1 className="text-3xl font-bold tracking-tight mb-2">About <BrandName /></h1>
        <p className="text-neutral-400 text-lg mb-10">
          A free, privacy-first P2P marketplace and crypto exchange. No company. No fees. No surveillance.
        </p>

        <Section title={<>What is <BrandName />?</>}>
          <p>
            <BrandName /> is a bulletin-board-style marketplace and peer-to-peer crypto exchange where
            people can buy, sell, and trade goods, services, and cryptocurrencies without an
            intermediary. There is no escrow, no centrally-held funds, and no mandatory ID
            verification.
          </p>
          <p>
            Think of it like Craigslist meets a P2P exchange — with end-to-end encrypted messages,
            crypto-native payments, and a reputation system that actually means something.
          </p>
        </Section>

        <Section title="Why we built it">
          <p>
            Most online marketplaces are surveillance engines. They collect your name, address,
            payment details, browsing history, and location — then sell that data or hand it over
            to authorities on request.
          </p>
          <p>
            We believe commerce should be private by default. <BrandName /> was built to give people a
            space to trade freely, without leaving a dossier behind.
          </p>
          <p>
            We also truly believe that cryptographic currencies have the potential to make the
            monetary system more efficient, transparent, and accessible to everyone. <BrandName /> exists
            to bring real utility to crypto — not just speculation, but actual peer-to-peer
            commerce and exchange.
          </p>
        </Section>

        <Section title="What we store — and what we don't">
          <p>We keep the minimum necessary to run the platform:</p>
          <ul className="list-disc list-inside space-y-1 text-neutral-300">
            <li>Your email (encrypted, we cannot read it)</li>
            <li>Your nickname (auto-generated, random by default)</li>
            <li>Your listings and messages (messages are E2E encrypted)</li>
            <li>Your reputation score and trade history</li>
          </ul>
          <p className="mt-4">
            We do <strong>not</strong> store your real name, postal address, payment details,
            browsing fingerprint, or IP address logs.
          </p>
        </Section>

        <Section title="Revenue model">
          <p>
            There is none. <BrandName /> is a community project funded entirely by{' '}
            <Link href="/donate" className="text-orange-400 hover:text-orange-300">
              voluntary donations
            </Link>
            . We take no percentage of trades, charge no listing fees, and show no ads.
          </p>
        </Section>

        <div className="mt-12 flex gap-4">
          <Link href="/privacy" className="text-orange-400 hover:text-orange-300 text-sm">
            Privacy policy &rarr;
          </Link>
          <Link href="/donate" className="text-orange-400 hover:text-orange-300 text-sm">
            Support <BrandName /> &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      <div className="text-neutral-300 space-y-3">{children}</div>
    </section>
  );
}
