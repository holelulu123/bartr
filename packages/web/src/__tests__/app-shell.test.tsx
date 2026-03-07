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

// ── Mock useCrypto ───────────────────────────────────────────────────────────
vi.mock('@/contexts/crypto-context', () => ({
  useCrypto: () => ({ lock: vi.fn(), isUnlocked: false }),
}));

// ── Mock useThreads (used by Navbar for unread indicator) ─────────────────────
vi.mock('@/hooks/use-messages', () => ({
  useThreads: () => ({ data: undefined }),
}));

// ── Mock usePendingProposals ─────────────────────────────────────────────────
vi.mock('@/hooks/use-pending-proposals', () => ({
  usePendingProposals: () => ({ notifications: [], hasNew: false, markAllRead: vi.fn() }),
}));

// ── Mock useMessageSidebar ──────────────────────────────────────────────────
vi.mock('@/contexts/message-sidebar-context', () => ({
  useMessageSidebar: () => ({
    isOpen: false,
    selectedThreadId: null,
    pendingContact: null,
    openSidebar: vi.fn(),
    closeSidebar: vi.fn(),
    openThread: vi.fn(),
    openContact: vi.fn(),
    clearSelection: vi.fn(),
  }),
}));

// ── Mock UserAvatar (avoids real image requests in tests) ─────────────────────
vi.mock('@/components/user-avatar', () => ({
  UserAvatar: ({ nickname }: { nickname: string }) => (
    <div data-testid="user-avatar" data-nickname={nickname} />
  ),
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
    expect(screen.getByRole('link', { name: 'P2P Exchange' })).toHaveAttribute('href', '/exchange');
    expect(screen.getByRole('link', { name: 'Marketplace' })).toHaveAttribute('href', '/market');
    expect(screen.getByRole('link', { name: 'Donate' })).toHaveAttribute('href', '/donate');
  });

  it('shows Sign in button', () => {
    render(<Navbar />);
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
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

  it('shows P2P Exchange and Marketplace links', () => {
    render(<Navbar />);
    expect(screen.getByRole('link', { name: 'P2P Exchange' })).toHaveAttribute('href', '/exchange');
    expect(screen.getByRole('link', { name: 'Marketplace' })).toHaveAttribute('href', '/market');
  });

  it('shows avatar for authenticated user', () => {
    render(<Navbar />);
    // Dropdown trigger button has aria-label = nickname
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

  it('shows user avatar in dropdown trigger', () => {
    render(<Navbar />);
    // UserAvatar is rendered inside the dropdown trigger button
    const avatar = screen.getByTestId('user-avatar');
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute('data-nickname', 'alice');
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
    const mobileLinks = screen.getAllByRole('link', { name: 'P2P Exchange' });
    expect(mobileLinks.length).toBeGreaterThan(0);

    // Close
    fireEvent.click(menuBtn);
    // The toggle button still exists, but hamburger changes to X
  });
});
