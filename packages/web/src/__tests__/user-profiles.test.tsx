import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockReplace = vi.fn();
const mockPush = vi.fn();
let mockPathname = '/user/alice';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  useParams: () => ({ nickname: 'alice' }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => mockPathname,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

let mockUser: { id: string; nickname: string } | null = { id: 'u1', nickname: 'alice' };
let mockIsAuthenticated = true;
let mockAuthLoading = false;

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: mockIsAuthenticated,
    isLoading: mockAuthLoading,
  }),
}));

const mockUseUser = vi.fn();
const mockUseUserRatings = vi.fn();
const mockUseUpdateProfile = vi.fn();
const mockUseUploadAvatar = vi.fn();

vi.mock('@/hooks/use-users', () => ({
  useUser: (...args: unknown[]) => mockUseUser(...args),
  useUserRatings: (...args: unknown[]) => mockUseUserRatings(...args),
  useUpdateProfile: () => mockUseUpdateProfile(),
  useUploadAvatar: () => mockUseUploadAvatar(),
}));

const mockUseListings = vi.fn();
vi.mock('@/hooks/use-listings', () => ({
  useListings: (...args: unknown[]) => mockUseListings(...args),
}));

const mockUseOffers = vi.fn().mockReturnValue({ data: { offers: [] }, isLoading: false });
vi.mock('@/hooks/use-exchange', () => ({
  useOffers: (...args: unknown[]) => mockUseOffers(...args),
}));

vi.mock('@/components/offer-row', () => ({
  OfferRow: ({ offer }: { offer: { id: string } }) => <div data-testid={`offer-${offer.id}`} />,
}));

const sampleProfile = {
  id: 'u1',
  nickname: 'alice',
  bio: 'Trusted seller',
  avatar_url: null,
  created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(), // 60 days ago
  last_active: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 min ago
  reputation: { composite_score: 85, rating_avg: 4.5, tier: 'trusted' as const },
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockUser = { id: 'u1', nickname: 'alice' };
  mockIsAuthenticated = true;
  mockAuthLoading = false;
  mockPathname = '/user/alice';
});

// ── UserProfilePage ─────────────────────────────────────────────────────────

import UserProfilePage from '@/app/user/[nickname]/page';

describe('UserProfilePage — loading state', () => {
  it('shows skeleton while loading', () => {
    mockUseUser.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    mockUseUserRatings.mockReturnValue({ data: undefined });
    mockUseListings.mockReturnValue({ data: undefined });

    render(<UserProfilePage />);
    // Skeleton elements present (they're divs with animate-pulse)
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });
});

describe('UserProfilePage — not found', () => {
  it('shows user not found message on error', () => {
    mockUseUser.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    mockUseUserRatings.mockReturnValue({ data: undefined });
    mockUseListings.mockReturnValue({ data: undefined });

    render(<UserProfilePage />);
    expect(screen.getByText(/user not found/i)).toBeInTheDocument();
  });
});

describe('UserProfilePage — profile display', () => {
  beforeEach(() => {
    mockUseUser.mockReturnValue({ data: sampleProfile, isLoading: false, isError: false });
    mockUseUserRatings.mockReturnValue({ data: { ratings: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } } });
    mockUseListings.mockReturnValue({ data: { listings: [], pagination: { page: 1, limit: 6, total: 0, pages: 0 } } });
  });

  it('renders nickname and bio', () => {
    render(<UserProfilePage />);
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('Trusted seller')).toBeInTheDocument();
  });

  it('renders reputation tier badge', () => {
    render(<UserProfilePage />);
    expect(screen.getByText('Trusted')).toBeInTheDocument();
  });

  it('renders star rating', () => {
    render(<UserProfilePage />);
    expect(screen.getByLabelText(/rating: 4\.5/i)).toBeInTheDocument();
  });

  it('shows Edit profile button for own profile', () => {
    render(<UserProfilePage />);
    expect(screen.getByRole('link', { name: /edit profile/i })).toHaveAttribute('href', '/settings/profile');
  });

  it('does not show Edit profile button for other profiles', () => {
    mockUser = { id: 'u2', nickname: 'bob' };
    render(<UserProfilePage />);
    expect(screen.queryByRole('link', { name: /edit profile/i })).not.toBeInTheDocument();
  });
});

describe('UserProfilePage — listings section', () => {
  it('renders active listings when present', () => {
    mockUseUser.mockReturnValue({ data: sampleProfile, isLoading: false, isError: false });
    mockUseUserRatings.mockReturnValue({ data: { ratings: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } } });
    mockUseListings.mockReturnValue({
      data: {
        listings: [
          {
            id: 'l1',
            title: 'GPU for sale',
            price_indication: '400',
            currency: 'usd',
            payment_methods: ['btc', 'cash'],
            status: 'active',
            created_at: new Date().toISOString(),
            seller_nickname: 'alice',
            category_name: null,
            category_slug: null,
            thumbnail: null,
          },
        ],
        pagination: { page: 1, limit: 6, total: 1, pages: 1 },
      },
    });

    render(<UserProfilePage />);
    expect(screen.getByText('GPU for sale')).toBeInTheDocument();
    expect(screen.getByText('400 USD')).toBeInTheDocument();
  });

  it('does not render listings section when empty', () => {
    mockUseUser.mockReturnValue({ data: sampleProfile, isLoading: false, isError: false });
    mockUseUserRatings.mockReturnValue({ data: { ratings: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } } });
    mockUseListings.mockReturnValue({ data: { listings: [], pagination: { page: 1, limit: 6, total: 0, pages: 0 } } });

    render(<UserProfilePage />);
    expect(screen.queryByText(/active listings/i)).not.toBeInTheDocument();
  });
});

describe('UserProfilePage — ratings section', () => {
  it('renders recent ratings when present', () => {
    mockUseUser.mockReturnValue({ data: sampleProfile, isLoading: false, isError: false });
    mockUseListings.mockReturnValue({ data: { listings: [], pagination: { page: 1, limit: 6, total: 0, pages: 0 } } });
    mockUseUserRatings.mockReturnValue({
      data: {
        ratings: [
          {
            id: 'r1',
            trade_id: 't1',
            from_user_id: 'u2',
            to_user_id: 'u1',
            score: 5,
            comment: 'Great seller!',
            created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, pages: 1 },
      },
    });

    render(<UserProfilePage />);
    expect(screen.getByText('Great seller!')).toBeInTheDocument();
    expect(screen.getByText(/recent ratings/i)).toBeInTheDocument();
  });
});

// ── EditProfilePage ─────────────────────────────────────────────────────────

import EditProfilePage from '@/app/settings/profile/page';

const mockMutateAsync = vi.fn();
const mockUploadMutateAsync = vi.fn();

function setupEditProfileMocks() {
  mockUseUser.mockReturnValue({
    data: sampleProfile,
    isLoading: false,
    isError: false,
  });
  mockUseUpdateProfile.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: false });
  mockUseUploadAvatar.mockReturnValue({ mutateAsync: mockUploadMutateAsync, isPending: false });
}

describe('EditProfilePage — rendering', () => {
  beforeEach(() => {
    setupEditProfileMocks();
    mockPathname = '/settings/profile';
  });

  it('renders nickname and bio fields pre-filled', async () => {
    render(<EditProfilePage />);
    await waitFor(() => {
      expect(screen.getByLabelText(/^nickname$/i)).toHaveValue('alice');
    });
    expect(screen.getByLabelText(/^bio$/i)).toHaveValue('Trusted seller');
  });

  it('renders Save changes button', () => {
    render(<EditProfilePage />);
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });

  it('renders View profile link', () => {
    render(<EditProfilePage />);
    expect(screen.getByRole('link', { name: /view profile/i })).toHaveAttribute('href', '/user/alice');
  });
});

describe('EditProfilePage — validation', () => {
  beforeEach(setupEditProfileMocks);

  it('shows error for too short nickname', async () => {
    render(<EditProfilePage />);
    await waitFor(() => screen.getByLabelText(/^nickname$/i));
    await userEvent.clear(screen.getByLabelText(/^nickname$/i));
    await userEvent.type(screen.getByLabelText(/^nickname$/i), 'ab');

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    });

    await waitFor(() => expect(screen.getByText(/3.30 characters/i)).toBeInTheDocument());
  });

  it('shows error for bio over 500 chars', async () => {
    render(<EditProfilePage />);
    await waitFor(() => screen.getByLabelText(/^bio$/i));
    await userEvent.clear(screen.getByLabelText(/^bio$/i));
    await userEvent.type(screen.getByLabelText(/^bio$/i), 'x'.repeat(501));

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    });

    await waitFor(() => expect(screen.getByText(/500 characters or less/i)).toBeInTheDocument());
  });
});

describe('EditProfilePage — successful save', () => {
  beforeEach(setupEditProfileMocks);

  it('calls updateProfile and shows success message', async () => {
    mockMutateAsync.mockResolvedValue({ ...sampleProfile, bio: 'Updated bio' });

    render(<EditProfilePage />);
    await waitFor(() => screen.getByLabelText(/^bio$/i));
    await userEvent.clear(screen.getByLabelText(/^bio$/i));
    await userEvent.type(screen.getByLabelText(/^bio$/i), 'Updated bio');

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    });

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledWith({ bio: 'Updated bio' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/saved/i));
  });
});

describe('EditProfilePage — error handling', () => {
  beforeEach(setupEditProfileMocks);

  it('shows error on 409 nickname conflict', async () => {
    mockMutateAsync.mockRejectedValue(new Error('409: nickname taken'));

    render(<EditProfilePage />);
    await waitFor(() => screen.getByLabelText(/^nickname$/i));
    await userEvent.clear(screen.getByLabelText(/^nickname$/i));
    await userEvent.type(screen.getByLabelText(/^nickname$/i), 'taken_nick');

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    });

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/nickname already taken/i));
  });
});

describe('EditProfilePage — unauthenticated', () => {
  it('redirects to /login when not authenticated', async () => {
    mockIsAuthenticated = false;
    mockUser = null;
    mockAuthLoading = false;
    mockUseUser.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    mockUseUpdateProfile.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: false });
    mockUseUploadAvatar.mockReturnValue({ mutateAsync: mockUploadMutateAsync, isPending: false });

    render(<EditProfilePage />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));
  });
});
