import type { Metadata } from 'next';
import { BrandName } from '@/components/brand-name';

export const metadata: Metadata = {
  title: 'Safety Tips — Bartr',
  description: 'Stay safe when trading on Bartr. Tips for in-person deals, crypto trades, and avoiding scams.',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      <div className="space-y-3 text-neutral-300 leading-relaxed">{children}</div>
    </section>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return <li className="pl-1">{children}</li>;
}

export default function TipsPage() {
  return (
    <div className="px-4 py-16">
      <div className="mx-auto max-w-2xl prose prose-invert prose-neutral">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Safety Tips</h1>
        <p className="text-neutral-400 text-lg mb-10">
          <BrandName /> is a peer-to-peer platform with no escrow. Your safety is your responsibility.
          Follow these tips to protect yourself.
        </p>

        <Section title="General safety">
          <ul className="list-disc pl-5 space-y-2">
            <Tip>Never share your password, recovery key, or private keys with anyone.</Tip>
            <Tip>Use the in-app encrypted messaging. Be wary of anyone who asks to move the conversation to another platform.</Tip>
            <Tip>If a deal sounds too good to be true, it&apos;s probably a scam. Trust your instincts.</Tip>
            <Tip>Check the seller or buyer&apos;s reputation and trade history before committing to a deal.</Tip>
            <Tip>Start with smaller trades to build trust before doing large ones.</Tip>
          </ul>
        </Section>

        <Section title="Cash trades (in-person)">
          <ul className="list-disc pl-5 space-y-2">
            <Tip>Meet in a public, well-lit place — a bank lobby, a coffee shop, or near security cameras.</Tip>
            <Tip>Tell a friend or family member where you&apos;re going, who you&apos;re meeting, and when you expect to be back.</Tip>
            <Tip>Bring a friend if possible, especially for high-value trades.</Tip>
            <Tip>Verify cash carefully. Use a counterfeit detection pen or UV light for large amounts.</Tip>
            <Tip>Don&apos;t flash large amounts of cash. Count privately, not in the open.</Tip>
            <Tip>Avoid meeting at your home or the other party&apos;s home.</Tip>
            <Tip>Trust your gut — if something feels off, leave. No deal is worth your safety.</Tip>
          </ul>
        </Section>

        <Section title="Crypto trades">
          <ul className="list-disc pl-5 space-y-2">
            <Tip>Always double-check wallet addresses before sending. Copy-paste and verify the first and last few characters.</Tip>
            <Tip>For large amounts, send a small test transaction first and wait for confirmation.</Tip>
            <Tip>Wait for sufficient blockchain confirmations before considering a transaction complete (e.g. 3 for Bitcoin, 12 for Ethereum).</Tip>
            <Tip>Never send crypto first in an unverified trade. Use the platform&apos;s trade flow to document the agreement.</Tip>
            <Tip>Be cautious of anyone pressuring you to rush a transaction.</Tip>
          </ul>
        </Section>

        <Section title="Avoiding scams">
          <ul className="list-disc pl-5 space-y-2">
            <Tip><strong>Fake urgency:</strong> &quot;Deal expires in 10 minutes!&quot; — legitimate sellers don&apos;t pressure you like this.</Tip>
            <Tip><strong>Off-platform communication:</strong> If someone insists on moving to Telegram, WhatsApp, or email, be cautious. It removes accountability.</Tip>
            <Tip><strong>Overpayment scams:</strong> Someone &quot;accidentally&quot; pays too much and asks you to refund the difference. The original payment is often fraudulent.</Tip>
            <Tip><strong>Fake payment proofs:</strong> Screenshots of payments can be fabricated. Always verify funds have actually arrived in your account or wallet.</Tip>
            <Tip><strong>Impersonation:</strong> Verify you&apos;re talking to the right person. Check nicknames carefully — scammers use similar-looking names.</Tip>
          </ul>
        </Section>

        <Section title="If something goes wrong">
          <ul className="list-disc pl-5 space-y-2">
            <Tip>Use the Report button on any listing or user profile to flag suspicious behavior.</Tip>
            <Tip>Document everything: keep screenshots of messages, transaction hashes, and any agreements.</Tip>
            <Tip>If you&apos;ve been scammed for a significant amount, consider filing a police report.</Tip>
            <Tip>Learn from the experience and share what happened (without personal details) to help others.</Tip>
          </ul>
        </Section>
      </div>
    </div>
  );
}
