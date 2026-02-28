import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';

// ── Mocks ──────────────────────────────────────────────────────────────────

let mockIsAuthenticated = true;
const mockLogout = vi.fn().mockResolvedValue(undefined);

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    logout: mockLogout,
  }),
}));

// Mock window.location.replace
const mockLocationReplace = vi.fn();
Object.defineProperty(window, 'location', {
  value: { ...window.location, replace: mockLocationReplace },
  writable: true,
});

import { IdleLogout } from '@/components/idle-logout';

beforeEach(() => {
  vi.useFakeTimers();
  mockIsAuthenticated = true;
  mockLogout.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('IdleLogout', () => {
  it('does not log out before 5 minutes', () => {
    render(<IdleLogout />);
    act(() => {
      vi.advanceTimersByTime(4 * 60 * 1000); // 4 minutes
    });
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('logs out and redirects after 5 minutes of inactivity', async () => {
    render(<IdleLogout />);
    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000); // 5 minutes
    });
    expect(mockLogout).toHaveBeenCalledOnce();
    expect(mockLocationReplace).toHaveBeenCalledWith('/');
  });

  it('resets timer on user activity', async () => {
    render(<IdleLogout />);
    act(() => {
      vi.advanceTimersByTime(4 * 60 * 1000); // 4 minutes
    });
    // Simulate activity
    act(() => {
      window.dispatchEvent(new Event('mousemove'));
    });
    // Another 4 minutes — should NOT logout (timer reset)
    act(() => {
      vi.advanceTimersByTime(4 * 60 * 1000);
    });
    expect(mockLogout).not.toHaveBeenCalled();

    // But after 5 more minutes total from last activity, it should logout
    await act(async () => {
      vi.advanceTimersByTime(1 * 60 * 1000); // 1 more minute = 5 total
    });
    expect(mockLogout).toHaveBeenCalledOnce();
  });

  it('does not set timer when not authenticated', () => {
    mockIsAuthenticated = false;
    render(<IdleLogout />);
    act(() => {
      vi.advanceTimersByTime(10 * 60 * 1000); // 10 minutes
    });
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('renders nothing', () => {
    const { container } = render(<IdleLogout />);
    expect(container.innerHTML).toBe('');
  });
});
