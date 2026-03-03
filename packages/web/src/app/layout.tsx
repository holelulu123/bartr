import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/theme-provider';
import { QueryProvider } from '@/components/query-provider';
import { AuthProvider } from '@/contexts/auth-context';
import { CryptoProvider } from '@/contexts/crypto-context';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { GlobalAuthGuard } from '@/components/global-auth-guard';
import { Toaster } from '@/components/toaster';
import { IdleLogout } from '@/components/idle-logout';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bartr — P2P Marketplace',
  description: 'A peer-to-peer crypto and barter marketplace. No KYC, no escrow.',
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <QueryProvider>
            <AuthProvider>
              <CryptoProvider>
              <GlobalAuthGuard>
                <Navbar />
                <main className="flex-1">
                  {children}
                </main>
                <Footer />
                <Toaster />
                <IdleLogout />
              </GlobalAuthGuard>
              </CryptoProvider>
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
