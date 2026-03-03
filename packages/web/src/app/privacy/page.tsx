import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandName } from '@/components/brand-name';

export const metadata: Metadata = {
  title: 'Privacy Policy — Bartr',
  description: 'How Bartr handles your data.',
};

const LAST_UPDATED = '2026-02-27';

export default function PrivacyPage() {
  return (
    <div className="px-4 py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-neutral-500 text-sm mb-10">Last updated: {LAST_UPDATED}</p>

        <div className="space-y-10 text-neutral-300">
          <Section title="1. What we collect">
            <p>We collect only what is necessary to operate the platform:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>
                <strong>Identifier:</strong> A one-way HMAC of your email address. We never
                store your email in plaintext.
              </li>
              <li>
                <strong>Nickname:</strong> A random alias assigned at registration. You may
                display this publicly.
              </li>
              <li>
                <strong>Encrypted key blob:</strong> Your private key, encrypted with your
                password, stored as an opaque binary blob. We cannot decrypt it.
              </li>
              <li>
                <strong>Listings:</strong> Content you post, including title, description,
                images, and payment preferences.
              </li>
              <li>
                <strong>Messages:</strong> Encrypted with your keypair. The server stores
                ciphertext only and cannot read the contents.
              </li>
              <li>
                <strong>Reputation data:</strong> Trade counts and aggregated ratings.
              </li>
            </ul>
          </Section>

          <Section title="2. What we do not collect">
            <ul className="list-disc list-inside space-y-1">
              <li>Your real name or government-issued ID</li>
              <li>Your postal or physical address</li>
              <li>Your payment card or bank details</li>
              <li>Persistent IP address logs or device fingerprints</li>
              <li>Third-party tracking cookies or analytics beacons</li>
            </ul>
          </Section>

          <Section title="3. How we use your data">
            <p>Your data is used solely to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Authenticate you and maintain your session</li>
              <li>Display your listings to other users</li>
              <li>Deliver encrypted messages between participants</li>
              <li>Calculate and display reputation scores</li>
              <li>Respond to your support requests</li>
            </ul>
            <p className="mt-3">
              We do not sell your data. We do not use it for advertising. We do not share it
              with third parties except as required by law.
            </p>
          </Section>

          <Section title="4. Data retention">
            <p>
              We retain your account data for as long as your account is active. Listings,
              messages, and trade records are deleted when you delete them or close your account.
              Reputation aggregates may persist in anonymised form.
            </p>
          </Section>

          <Section title="5. Security">
            <p>
              Messages are end-to-end encrypted using asymmetric keys that never leave your
              device in plaintext. Images are stripped of EXIF metadata before storage.
              Passwords are hashed with Argon2id. Access tokens expire after one hour.
            </p>
          </Section>

          <Section title="6. Cookies">
            <p>
              We use a single session cookie for authentication. No tracking, advertising, or
              analytics cookies are set.
            </p>
          </Section>

          <Section title="7. Your rights">
            <p>You may request at any time:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>A copy of all data we hold about you</li>
              <li>Deletion of your account and associated data</li>
              <li>Correction of incorrect account information</li>
            </ul>
            <p className="mt-3">
              To exercise these rights, delete your account from the settings page or contact us
              via the GitHub issue tracker.
            </p>
          </Section>

          <Section title="8. Changes to this policy">
            <p>
              We may update this policy. When we do, we will update the &quot;Last updated&quot; date
              at the top. Continued use of <BrandName /> after changes constitutes acceptance of the
              updated policy.
            </p>
          </Section>

          <Section title="9. Contact">
            <p>
              Questions about this policy can be raised on our public GitHub repository. We do
              not provide a private email address to reduce spam and maintain transparency.
            </p>
          </Section>
        </div>

        <div className="mt-12 flex gap-4">
          <Link href="/about" className="text-orange-400 hover:text-orange-300 text-sm">
            About <BrandName /> &rarr;
          </Link>
          <Link href="/" className="text-neutral-500 hover:text-neutral-300 text-sm">
            &larr; Home
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-white mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
