import { APP_NAME } from '@bartr/shared';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-5xl font-bold tracking-tight">{APP_NAME}</h1>
      <p className="mt-4 text-lg text-neutral-400">P2P marketplace — coming soon</p>
      <a
        href="/donate"
        className="mt-8 text-sm text-orange-400 hover:text-orange-300 transition"
      >
        Support Bartr &rarr;
      </a>
    </main>
  );
}
