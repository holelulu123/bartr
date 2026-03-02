import Link from 'next/link';
import { APP_NAME } from '@bartr/shared';

export function Footer() {
  return (
    <footer className="border-t border-border mt-auto">
      <div className="container py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <p>
          &copy; {new Date().getFullYear()} {APP_NAME} — P2P marketplace and exchange. No escrow, no KYC.
        </p>
        <nav className="flex gap-4">
          <Link href="/about" className="hover:text-foreground transition-colors">About</Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <Link href="/donate" className="hover:text-foreground transition-colors">Donate</Link>
        </nav>
      </div>
    </footer>
  );
}
