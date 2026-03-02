import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ── Navigation mocks ────────────────────────────────────────────────────────

const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/settings',
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// ── Auth mock ────────────────────────────────────────────────────────────────

let mockIsAuthenticated = true;
let mockIsLoading = false;
vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ isAuthenticated: mockIsAuthenticated, isLoading: mockIsLoading, user: { nickname: 'tester', max_exchange_offers: null } }),
}));

// ── Users hook mock ──────────────────────────────────────────────────────

vi.mock('@/hooks/use-users', () => ({
  useUpdateProfile: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// ── Theme mock ───────────────────────────────────────────────────────────────

let mockResolvedTheme = 'dark';
const mockSetTheme = vi.fn();

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: mockResolvedTheme, setTheme: mockSetTheme }),
}));

// ── Components under test ───────────────────────────────────────────────────

import SettingsPage from '@/app/settings/page';
import { ThemeToggle } from '@/components/theme-toggle';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockIsAuthenticated = true;
  mockIsLoading = false;
  mockResolvedTheme = 'dark';
});

describe('Settings page', () => {
  it('renders heading and sections', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Settings')).toBeDefined();
    expect(screen.getByText('Appearance')).toBeDefined();
    expect(screen.getByText('Profile')).toBeDefined();
  });

  it('links to profile settings', () => {
    render(<SettingsPage />);
    const link = screen.getByTestId('profile-settings-link');
    expect(link.getAttribute('href')).toBe('/settings/profile');
  });

  it('redirects to /login when not authenticated', async () => {
    mockIsAuthenticated = false;
    render(<SettingsPage />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });

  it('shows skeleton while auth is loading', () => {
    mockIsLoading = true;
    mockIsAuthenticated = false;
    render(<SettingsPage />);
    // No heading rendered while loading
    expect(screen.queryByText('Settings')).toBeNull();
  });
});

describe('ThemeToggle', () => {
  it('shows "Light mode" button when theme is dark', () => {
    mockResolvedTheme = 'dark';
    render(<ThemeToggle />);
    expect(screen.getByText('Light mode')).toBeDefined();
  });

  it('shows "Dark mode" button when theme is light', () => {
    mockResolvedTheme = 'light';
    render(<ThemeToggle />);
    expect(screen.getByText('Dark mode')).toBeDefined();
  });

  it('calls setTheme with light when dark and clicked', async () => {
    mockResolvedTheme = 'dark';
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByTestId('theme-toggle'));
    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });

  it('calls setTheme with dark when light and clicked', async () => {
    mockResolvedTheme = 'light';
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByTestId('theme-toggle'));
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('has correct aria-label for dark theme', () => {
    mockResolvedTheme = 'dark';
    render(<ThemeToggle />);
    expect(screen.getByRole('button').getAttribute('aria-label')).toBe('Switch to light mode');
  });

  it('has correct aria-label for light theme', () => {
    mockResolvedTheme = 'light';
    render(<ThemeToggle />);
    expect(screen.getByRole('button').getAttribute('aria-label')).toBe('Switch to dark mode');
  });
});
