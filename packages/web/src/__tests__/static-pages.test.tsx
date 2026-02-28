import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock hooks for home page (uses listings)
vi.mock('@/hooks/use-listings', () => ({
  useListings: () => ({ data: null, isLoading: true }),
  useInfiniteListings: () => ({ data: null, isLoading: true }),
  useCategories: () => ({ data: null, isLoading: false }),
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ isAuthenticated: false, isLoading: false }),
}));

vi.mock('@/components/listing-card', () => ({
  ListingCard: ({ listing }: { listing: { id: string; title: string } }) => (
    <div data-testid="listing-card">{listing.title}</div>
  ),
  ListingCardSkeleton: () => <div data-testid="listing-skeleton" />,
}));

afterEach(() => {
  cleanup();
});

// ── About page ─────────────────────────────────────────────────────────────

describe('About page', () => {
  it('renders the about heading', async () => {
    const { default: AboutPage } = await import('@/app/about/page');
    render(<AboutPage />);
    expect(screen.getByRole('heading', { name: /about bartr/i })).toBeInTheDocument();
  });

  it('renders key sections', async () => {
    const { default: AboutPage } = await import('@/app/about/page');
    render(<AboutPage />);
    expect(screen.getByText(/what is bartr/i)).toBeInTheDocument();
    expect(screen.getByText(/why we built it/i)).toBeInTheDocument();
    expect(screen.getByText(/revenue model/i)).toBeInTheDocument();
  });

  it('links to donate and privacy pages', async () => {
    const { default: AboutPage } = await import('@/app/about/page');
    render(<AboutPage />);
    expect(screen.getByRole('link', { name: /privacy policy/i })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: /support bartr/i })).toHaveAttribute('href', '/donate');
  });
});

// ── Privacy page ───────────────────────────────────────────────────────────

describe('Privacy page', () => {
  it('renders the privacy policy heading', async () => {
    const { default: PrivacyPage } = await import('@/app/privacy/page');
    render(<PrivacyPage />);
    expect(screen.getByRole('heading', { name: /privacy policy/i })).toBeInTheDocument();
  });

  it('shows last-updated date', async () => {
    const { default: PrivacyPage } = await import('@/app/privacy/page');
    render(<PrivacyPage />);
    expect(screen.getAllByText(/last updated/i).length).toBeGreaterThan(0);
  });

  it('renders data collection and security sections', async () => {
    const { default: PrivacyPage } = await import('@/app/privacy/page');
    render(<PrivacyPage />);
    expect(screen.getByText(/what we collect/i)).toBeInTheDocument();
    expect(screen.getByText(/security/i)).toBeInTheDocument();
    expect(screen.getByText(/your rights/i)).toBeInTheDocument();
  });

  it('links back to about page', async () => {
    const { default: PrivacyPage } = await import('@/app/privacy/page');
    render(<PrivacyPage />);
    expect(screen.getByRole('link', { name: /about bartr/i })).toHaveAttribute('href', '/about');
  });
});

// ── Home / Landing page ────────────────────────────────────────────────────

describe('Home / Landing page', () => {
  it('renders the hero heading', async () => {
    const { default: HomePage } = await import('@/app/page');
    render(<HomePage />);
    expect(screen.getByRole('heading', { name: /trade anything/i })).toBeInTheDocument();
  });

  it('renders the feature section', async () => {
    const { default: HomePage } = await import('@/app/page');
    render(<HomePage />);
    expect(screen.getByRole('heading', { name: /built for privacy/i })).toBeInTheDocument();
    expect(screen.getAllByText(/no kyc/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/end-to-end encrypted messages/i)).toBeInTheDocument();
  });

  it('renders the how it works section', async () => {
    const { default: HomePage } = await import('@/app/page');
    render(<HomePage />);
    expect(screen.getByRole('heading', { name: /how it works/i })).toBeInTheDocument();
    expect(screen.getByText(/create an account/i)).toBeInTheDocument();
    // "Post a listing" appears as a heading and a button — check the heading
    expect(screen.getByRole('heading', { name: /^post a listing$/i })).toBeInTheDocument();
  });

  it('shows browse listings and post a listing links', async () => {
    const { default: HomePage } = await import('@/app/page');
    render(<HomePage />);
    expect(screen.getByRole('link', { name: /browse listings/i })).toHaveAttribute('href', '/listings');
    expect(screen.getByRole('link', { name: /post a listing/i })).toHaveAttribute('href', '/listings/new');
  });

  it('renders create account and sell links', async () => {
    const { default: HomePage } = await import('@/app/page');
    render(<HomePage />);
    // Recent listings removed; CTA links should be present
    expect(screen.getByRole('link', { name: /create account/i })).toBeInTheDocument();
  });
});

// ── Donate page ────────────────────────────────────────────────────────────

describe('Donate page', () => {
  it('renders the donate heading', async () => {
    const { default: DonatePage } = await import('@/app/donate/page');
    render(<DonatePage />);
    expect(screen.getByRole('heading', { name: /support bartr/i })).toBeInTheDocument();
  });

  it('shows BTC address only', async () => {
    const { default: DonatePage } = await import('@/app/donate/page');
    render(<DonatePage />);
    expect(screen.getByText(/bitcoin \(btc\)/i)).toBeInTheDocument();
    expect(screen.queryByText(/lightning network/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/monero \(xmr\)/i)).not.toBeInTheDocument();
  });

  it('shows copy address button', async () => {
    const { default: DonatePage } = await import('@/app/donate/page');
    render(<DonatePage />);
    expect(screen.getByRole('button', { name: /copy address/i })).toBeInTheDocument();
  });

  it('shows expense breakdown', async () => {
    const { default: DonatePage } = await import('@/app/donate/page');
    render(<DonatePage />);
    expect(screen.getByText(/where your donation goes/i)).toBeInTheDocument();
    expect(screen.getByText(/vps hosting/i)).toBeInTheDocument();
  });
});
