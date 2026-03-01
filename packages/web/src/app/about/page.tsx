import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About — Bartr',
  description: 'Learn what Bartr is, how it works, and why we built it.',
};

export default function AboutPage() {
  return (
    <div className="px-4 py-16">
      <div className="mx-auto max-w-2xl prose prose-invert prose-neutral">
        <h1 className="text-3xl font-bold tracking-tight mb-2">About Bartr</h1>
        <p className="text-neutral-400 text-lg mb-10">
          A free, privacy-first P2P marketplace. No company. No fees. No surveillance.
        </p>

        <Section title="What is Bartr?">
          <p>
            Bartr is a bulletin-board-style marketplace where people can buy, sell, and trade
            goods, services, and crypto without an intermediary. There is no escrow, no
            centrally-held funds, and no mandatory ID verification.
          </p>
          <p>
            Think of it like Craigslist — but with end-to-end encrypted messages, crypto-native
            payments, and a reputation system that actually means something.
          </p>
        </Section>

        <Section title="Why we built it">
          <p>
            Most online marketplaces are surveillance engines. They collect your name, address,
            payment details, browsing history, and location — then sell that data or hand it over
            to authorities on request.
          </p>
          <p>
            We believe commerce should be private by default. Bartr was built to give people a
            space to trade freely, without leaving a dossier behind.
          </p>
        </Section>

        <Section title="How it works">
          <ol className="list-decimal list-inside space-y-2 text-neutral-300">
            <li>Create an account with email — no real name required.</li>
            <li>Your private key is encrypted with your password and stored only on our servers as an opaque blob.</li>
            <li>Post listings for anything you want to sell or trade.</li>
            <li>Buyers message you — all messages are end-to-end encrypted between you and them.</li>
            <li>You agree on payment and terms off-platform or in chat.</li>
            <li>After the trade, both parties leave a rating to build the community reputation graph.</li>
          </ol>
        </Section>

        <Section title="What we store — and what we don't">
          <p>We keep the minimum necessary to run the platform:</p>
          <ul className="list-disc list-inside space-y-1 text-neutral-300">
            <li>A one-way HMAC of your email (not the email itself)</li>
            <li>Your nickname (auto-generated, random by default)</li>
            <li>Your encrypted private key blob (we cannot read it)</li>
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
            There is none. Bartr is a community project funded entirely by{' '}
            <Link href="/donate" className="text-orange-400 hover:text-orange-300">
              voluntary donations
            </Link>
            . We take no percentage of trades, charge no listing fees, and show no ads.
          </p>
        </Section>

        <Section title="Open source">
          <p>
            Bartr&apos;s source code is publicly available. We welcome contributions, audits, and forks.
            If you find a security issue, please disclose it responsibly.
          </p>
        </Section>

        <div className="mt-12 flex gap-4">
          <Link href="/privacy" className="text-orange-400 hover:text-orange-300 text-sm">
            Privacy policy &rarr;
          </Link>
          <Link href="/donate" className="text-orange-400 hover:text-orange-300 text-sm">
            Support Bartr &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      <div className="text-neutral-300 space-y-3">{children}</div>
    </section>
  );
}
