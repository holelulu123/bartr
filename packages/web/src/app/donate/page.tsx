import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Donate — Bartr',
  description: 'Support Bartr with BTC, XMR, or Lightning',
};

const DONATION_ADDRESSES = {
  btc: {
    label: 'Bitcoin (BTC)',
    address: 'bc1qexampleaddresshere',
    icon: '₿',
    color: 'text-orange-400',
    bgColor: 'bg-orange-400/10',
    borderColor: 'border-orange-400/30',
  },
  lightning: {
    label: 'Lightning Network',
    address: 'lnbc1examplelightninginvoice',
    icon: '⚡',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/10',
    borderColor: 'border-yellow-400/30',
  },
  xmr: {
    label: 'Monero (XMR)',
    address: '4ExampleMoneroAddressHere',
    icon: 'ɱ',
    color: 'text-orange-300',
    bgColor: 'bg-orange-300/10',
    borderColor: 'border-orange-300/30',
  },
};

function DonationCard({
  label,
  address,
  icon,
  color,
  bgColor,
  borderColor,
}: {
  label: string;
  address: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
}) {
  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} p-6`}>
      <div className="flex items-center gap-3 mb-4">
        <span className={`text-3xl ${color}`}>{icon}</span>
        <h2 className={`text-xl font-semibold ${color}`}>{label}</h2>
      </div>

      {/* QR Code */}
      <div className="flex justify-center mb-4">
        <div className="bg-white p-3 rounded-lg">
          {/* Using a simple SVG placeholder for QR — replace with real QR generation in production */}
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(address)}`}
            alt={`${label} QR code`}
            width={180}
            height={180}
            className="block"
          />
        </div>
      </div>

      {/* Address */}
      <div className="mt-3">
        <p className="text-xs text-neutral-500 mb-1">Address</p>
        <code className="block text-sm text-neutral-300 bg-neutral-800/50 rounded-lg px-3 py-2 break-all select-all">
          {address}
        </code>
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
            Bartr is a free, privacy-first marketplace with no fees, no KYC, and no ads.
            Donations help cover server costs and fund development.
          </p>
        </div>

        {/* Donation cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Object.values(DONATION_ADDRESSES).map((addr) => (
            <DonationCard key={addr.label} {...addr} />
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
          <a href="/" className="text-neutral-500 hover:text-neutral-300 transition">
            &larr; Back to Bartr
          </a>
        </div>
      </div>
    </main>
  );
}

function ExpenseRow({
  label,
  amount,
  percent,
}: {
  label: string;
  amount: string;
  percent: number;
}) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-neutral-300">{label}</span>
        <span className="text-neutral-500">{amount}</span>
      </div>
      <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-orange-400/60 rounded-full"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
