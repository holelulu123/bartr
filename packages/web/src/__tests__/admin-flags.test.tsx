import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ── Navigation mocks ────────────────────────────────────────────────────────

const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/admin/flags',
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// ── Auth mock ────────────────────────────────────────────────────────────────

let mockUser: { nickname: string; role?: string } | null = { nickname: 'admin_user', role: 'admin' };
let mockAuthLoading = false;

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: mockUser, isLoading: mockAuthLoading }),
}));

// ── Moderation hooks mock ─────────────────────────────────────────────────────

const mockUpdateFlagMutation = { mutateAsync: vi.fn(), isPending: false };
let mockAdminFlagsData: { flags: object[]; pagination: object } | undefined = undefined;
let mockFlagsLoading = false;

vi.mock('@/hooks/use-moderation', () => ({
  useAdminFlags: () => ({ data: mockAdminFlagsData, isLoading: mockFlagsLoading }),
  useUpdateFlag: () => mockUpdateFlagMutation,
}));

// ── Component ─────────────────────────────────────────────────────────────────

import AdminFlagsPage from '@/app/admin/flags/page';

function makeFlag(overrides: object = {}) {
  return {
    id: 'flag-1',
    target_type: 'listing',
    target_id: 'listing-abc',
    reason: 'This listing is selling counterfeit goods.',
    status: 'pending',
    created_at: new Date(Date.now() - 60_000 * 10).toISOString(),
    reporter_nickname: 'reporter1',
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockUser = { nickname: 'admin_user', role: 'admin' };
  mockAuthLoading = false;
  mockAdminFlagsData = undefined;
  mockFlagsLoading = false;
});

describe('AdminFlagsPage — access control', () => {
  it('redirects non-admin user to home', async () => {
    mockUser = { nickname: 'regular', role: 'user' };
    render(<AdminFlagsPage />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });

  it('redirects unauthenticated user to home', async () => {
    mockUser = null;
    render(<AdminFlagsPage />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });

  it('renders nothing if not admin (after redirect)', () => {
    mockUser = { nickname: 'regular', role: 'user' };
    const { container } = render(<AdminFlagsPage />);
    expect(container.firstChild).toBeNull();
  });

  it('shows skeleton while auth is loading', () => {
    mockAuthLoading = true;
    mockUser = null;
    render(<AdminFlagsPage />);
    // skeleton renders, no heading
    expect(screen.queryByText('Moderation — Flags')).toBeNull();
  });
});

describe('AdminFlagsPage — content', () => {
  beforeEach(() => {
    mockUser = { nickname: 'admin_user', role: 'admin' };
    mockAdminFlagsData = {
      flags: [makeFlag()],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    };
  });

  it('renders page heading', () => {
    render(<AdminFlagsPage />);
    expect(screen.getByText('Moderation — Flags')).toBeDefined();
  });

  it('renders status filter buttons', () => {
    render(<AdminFlagsPage />);
    expect(screen.getByTestId('filter-pending')).toBeDefined();
    expect(screen.getByTestId('filter-reviewed')).toBeDefined();
    expect(screen.getByTestId('filter-resolved')).toBeDefined();
    expect(screen.getByTestId('filter-dismissed')).toBeDefined();
  });

  it('renders flag card with reason', () => {
    render(<AdminFlagsPage />);
    expect(screen.getByText('This listing is selling counterfeit goods.')).toBeDefined();
  });

  it('renders reporter nickname', () => {
    render(<AdminFlagsPage />);
    expect(screen.getByText('reporter1')).toBeDefined();
  });

  it('renders link to flagged listing', () => {
    render(<AdminFlagsPage />);
    const link = screen.getByTestId('flag-listing-link');
    expect(link.getAttribute('href')).toBe('/listings/listing-abc');
  });

  it('renders action buttons for pending flags', () => {
    render(<AdminFlagsPage />);
    expect(screen.getByTestId('dismiss-flag')).toBeDefined();
    expect(screen.getByTestId('review-flag')).toBeDefined();
    expect(screen.getByTestId('resolve-flag')).toBeDefined();
  });

  it('does not render action buttons for non-pending flags', () => {
    mockAdminFlagsData = {
      flags: [makeFlag({ status: 'dismissed' })],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    };
    render(<AdminFlagsPage />);
    expect(screen.queryByTestId('dismiss-flag')).toBeNull();
    expect(screen.queryByTestId('resolve-flag')).toBeNull();
  });

  it('shows empty state when no flags', () => {
    mockAdminFlagsData = { flags: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } };
    render(<AdminFlagsPage />);
    expect(screen.getByTestId('no-flags')).toBeDefined();
  });

  it('shows total flag count', () => {
    render(<AdminFlagsPage />);
    expect(screen.getByText(/total.*1/i)).toBeDefined();
  });
});

describe('AdminFlagsPage — actions', () => {
  beforeEach(() => {
    mockUser = { nickname: 'admin_user', role: 'admin' };
    mockAdminFlagsData = {
      flags: [makeFlag()],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    };
  });

  it('calls updateFlag with dismissed when Dismiss clicked', async () => {
    mockUpdateFlagMutation.mutateAsync.mockResolvedValue({});
    const user = userEvent.setup();
    render(<AdminFlagsPage />);
    await user.click(screen.getByTestId('dismiss-flag'));
    await waitFor(() =>
      expect(mockUpdateFlagMutation.mutateAsync).toHaveBeenCalledWith({ id: 'flag-1', status: 'dismissed' }),
    );
  });

  it('calls updateFlag with reviewed when Mark reviewed clicked', async () => {
    mockUpdateFlagMutation.mutateAsync.mockResolvedValue({});
    const user = userEvent.setup();
    render(<AdminFlagsPage />);
    await user.click(screen.getByTestId('review-flag'));
    await waitFor(() =>
      expect(mockUpdateFlagMutation.mutateAsync).toHaveBeenCalledWith({ id: 'flag-1', status: 'reviewed' }),
    );
  });

  it('calls updateFlag with resolved when Resolve clicked', async () => {
    mockUpdateFlagMutation.mutateAsync.mockResolvedValue({});
    const user = userEvent.setup();
    render(<AdminFlagsPage />);
    await user.click(screen.getByTestId('resolve-flag'));
    await waitFor(() =>
      expect(mockUpdateFlagMutation.mutateAsync).toHaveBeenCalledWith({ id: 'flag-1', status: 'resolved' }),
    );
  });
});
