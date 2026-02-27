import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ── 404 Not Found page ─────────────────────────────────────────────────────

describe('NotFound page', () => {
  it('renders the 404 status', async () => {
    const { default: NotFound } = await import('@/app/not-found');
    render(<NotFound />);
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('renders the page not found heading', async () => {
    const { default: NotFound } = await import('@/app/not-found');
    render(<NotFound />);
    expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument();
  });

  it('renders go home and browse listings links', async () => {
    const { default: NotFound } = await import('@/app/not-found');
    render(<NotFound />);
    expect(screen.getByRole('link', { name: /go home/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /browse listings/i })).toHaveAttribute('href', '/listings');
  });
});

// ── 500 Error page ─────────────────────────────────────────────────────────

describe('Error page (500)', () => {
  it('renders the 500 status', async () => {
    const { default: ErrorPage } = await import('@/app/error');
    const reset = vi.fn();
    render(<ErrorPage error={new Error('Test error')} reset={reset} />);
    expect(screen.getByText('500')).toBeInTheDocument();
  });

  it('renders the something went wrong heading', async () => {
    const { default: ErrorPage } = await import('@/app/error');
    const reset = vi.fn();
    render(<ErrorPage error={new Error('Test error')} reset={reset} />);
    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument();
  });

  it('calls reset when try again is clicked', async () => {
    const { default: ErrorPage } = await import('@/app/error');
    const reset = vi.fn();
    render(<ErrorPage error={new Error('Test error')} reset={reset} />);
    screen.getByRole('button', { name: /try again/i }).click();
    expect(reset).toHaveBeenCalledOnce();
  });

  it('logs the error to console', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { default: ErrorPage } = await import('@/app/error');
    const error = new Error('Something broke');
    const reset = vi.fn();
    render(<ErrorPage error={error} reset={reset} />);
    expect(consoleSpy).toHaveBeenCalledWith(error);
    consoleSpy.mockRestore();
  });
});

// ── useToast hook ──────────────────────────────────────────────────────────

describe('useToast hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with no toasts', async () => {
    const { useToast } = await import('@/hooks/use-toast');
    const { result } = renderHook(() => useToast());
    expect(result.current.toasts).toHaveLength(0);
  });

  it('adds a toast via toast()', async () => {
    const { useToast, toast } = await import('@/hooks/use-toast');
    const { result } = renderHook(() => useToast());

    act(() => {
      toast({ title: 'Hello world', variant: 'success' });
    });

    expect(result.current.toasts.length).toBeGreaterThan(0);
    const added = result.current.toasts.find((t) => t.title === 'Hello world');
    expect(added).toBeDefined();
    expect(added?.variant).toBe('success');
  });

  it('adds a destructive toast', async () => {
    const { useToast, toast } = await import('@/hooks/use-toast');
    const { result } = renderHook(() => useToast());

    act(() => {
      toast({ title: 'Error occurred', variant: 'destructive' });
    });

    const added = result.current.toasts.find((t) => t.title === 'Error occurred');
    expect(added?.variant).toBe('destructive');
  });

  it('dismiss() closes the toast', async () => {
    const { useToast, toast } = await import('@/hooks/use-toast');
    const { result } = renderHook(() => useToast());

    let id: string;
    act(() => {
      const t = toast({ title: 'Dismiss me' });
      id = t.id;
    });

    act(() => {
      result.current.dismiss(id!);
    });

    const dismissed = result.current.toasts.find((t) => t.id === id!);
    expect(dismissed?.open).toBe(false);
  });

  it('toast with description renders title and description', async () => {
    const { useToast, toast } = await import('@/hooks/use-toast');
    const { result } = renderHook(() => useToast());

    act(() => {
      toast({ title: 'Item saved', description: 'Your listing was saved successfully.' });
    });

    const added = result.current.toasts.find((t) => t.title === 'Item saved');
    expect(added?.description).toBe('Your listing was saved successfully.');
  });
});

// ── Toaster component ──────────────────────────────────────────────────────

describe('Toaster component', () => {
  it('renders without crashing', async () => {
    const { Toaster } = await import('@/components/toaster');
    const { container } = render(<Toaster />);
    expect(container).toBeTruthy();
  });
});
