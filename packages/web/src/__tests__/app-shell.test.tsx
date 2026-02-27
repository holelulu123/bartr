import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Footer } from '@/components/footer';
import { Navbar } from '@/components/navbar';
import { APP_NAME } from '@bartr/shared';

// ── Mock next/navigation ──────────────────────────────────────────────────────
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
  useRouter: vi.fn(() => ({ replace: vi.fn(), push: vi.fn() })),
}));

// ── Mock next/link ────────────────────────────────────────────────────────────
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// ── Mock useAuth ──────────────────────────────────────────────────────────────
const mockLogout = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ── Footer ────────────────────────────────────────────────────────────────────
describe('Footer', () => {
  it('renders app name', () => {
    render(<Footer />);
    expect(screen.getByText(new RegExp(APP_NAME))).toBeInTheDocument();
  });

  it('renders nav links', () => {
    render(<Footer />);
    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about');
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: 'Donate' })).toHaveAttribute('href', '/donate');
  });

  it('renders tagline', () => {
    render(<Footer />);
    expect(screen.getByText(/No escrow, no KYC/)).toBeInTheDocument();
  });
});

// ── Navbar — logged out ───────────────────────────────────────────────────────
describe('Navbar — unauthenticated', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: null, isAuthenticated: false, isLoading: false, logout: mockLogout });
  });

  it('renders the app name as a link', () => {
    render(<Navbar />);
    const logo = screen.getByRole('link', { name: APP_NAME });
    expect(logo).toHaveAttribute('href', '/');
  });

  it('renders nav links', () => {
    render(<Navbar />);
    expect(screen.getByRole('link', { name: 'Browse' })).toHaveAttribute('href', '/listings');
    expect(screen.getByRole('link', { name: 'Messages' })).toHaveAttribute('href', '/messages');
    expect(screen.getByRole('link', { name: 'Donate' })).toHaveAttribute('href', '/donate');
  });

  it('shows Sign in button', () => {
    render(<Navbar />);
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });

  it('does not show Sell button when logged out', () => {
    render(<Navbar />);
    const sellLinks = screen.queryAllByRole('link', { name: /sell/i });
    // On desktop, no sell button shown when unauthenticated
    expect(sellLinks.filter(l => l.getAttribute('href') === '/listings/new')).toHaveLength(0);
  });
});

// ── Navbar — logged in ────────────────────────────────────────────────────────
describe('Navbar — authenticated', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', nickname: 'alice', created_at: '', last_active: '' },
      isAuthenticated: true,
      isLoading: false,
      logout: mockLogout,
    });
  });

  it('shows the Sell button', () => {
    render(<Navbar />);
    const sellLink = screen.getAllByRole('link', { name: /sell/i }).find(l => l.getAttribute('href') === '/listings/new');
    expect(sellLink).toBeDefined();
  });

  it('shows identicon avatar for authenticated user', () => {
    render(<Navbar />);
    // NavIdenticon renders an SVG (aria-hidden), dropdown trigger has aria-label = nickname
    const trigger = screen.getByRole('button', { hidden: true, name: /alice/i });
    expect(trigger).toBeInTheDocument();
  });

  it('does not show Sign in button', () => {
    render(<Navbar />);
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
  });

  it('renders an avatar dropdown trigger', () => {
    render(<Navbar />);
    // Radix DropdownMenuTrigger renders with aria-haspopup="menu"
    const buttons = screen.getAllByRole('button', { hidden: true });
    const dropdownTrigger = buttons.find(b => b.getAttribute('aria-haspopup') === 'menu');
    expect(dropdownTrigger).toBeDefined();
  });

  it('shows identicon SVG in dropdown trigger', () => {
    render(<Navbar />);
    // Identicon SVG is aria-hidden; the trigger button has aria-label=nickname
    const buttons = screen.getAllByRole('button', { hidden: true });
    const trigger = buttons.find(b => b.getAttribute('aria-haspopup') === 'menu');
    expect(trigger).toBeDefined();
    // SVG should be inside the trigger
    const svg = trigger?.querySelector('svg');
    expect(svg).not.toBeNull();
  });
});

// ── Navbar — mobile menu ──────────────────────────────────────────────────────
describe('Navbar — mobile menu', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: null, isAuthenticated: false, isLoading: false, logout: mockLogout });
  });

  it('toggles mobile menu on hamburger click', () => {
    render(<Navbar />);

    // Mobile nav not visible initially (content not in DOM until toggled)
    const menuBtn = screen.getByRole('button', { name: 'Toggle menu' });
    expect(menuBtn).toBeInTheDocument();

    // Open
    fireEvent.click(menuBtn);
    const mobileLinks = screen.getAllByRole('link', { name: 'Browse' });
    expect(mobileLinks.length).toBeGreaterThan(0);

    // Close
    fireEvent.click(menuBtn);
    // The toggle button still exists, but hamburger changes to X
  });
});
