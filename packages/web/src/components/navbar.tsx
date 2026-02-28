'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X, MessageSquare, Store, ArrowLeftRight, Heart, Moon, Sun, User, Package, BarChart2, Settings, LogOut } from 'lucide-react';
import { useTheme } from 'next-themes';
import { APP_NAME } from '@bartr/shared';
import { useAuth } from '@/contexts/auth-context';
import { useThreads } from '@/hooks/use-messages';
import { useUnreadThreads } from '@/hooks/use-unread-threads';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';


const navLinks = [
  { href: '/exchange', label: 'P2P Exchange', icon: ArrowLeftRight },
  { href: '/market', label: 'Marketplace', icon: Store },
  { href: '/messages', label: 'Messages', icon: MessageSquare },
  { href: '/donate', label: 'Donate', icon: Heart },
];

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  // Unread message indicator — only fetch threads when authenticated
  const { data: threadsData } = useThreads({ enabled: isAuthenticated });
  const { hasUnread } = useUnreadThreads(
    threadsData?.threads ?? [],
    user?.nickname ?? '',
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        {/* Logo */}
        <Link href="/" className="mr-6 flex items-center space-x-2 font-bold text-primary text-lg">
          {APP_NAME}
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 flex-1">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'relative px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                pathname?.startsWith(href) ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
              )}
            >
              {label}
              {href === '/messages' && isAuthenticated && hasUnread && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-orange-500" aria-label="Unread messages" />
              )}
            </Link>
          ))}
        </nav>

        {/* Right section */}
        <div className="ml-auto flex items-center gap-2">
          {isAuthenticated ? (
            <>
              {/* User dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    aria-label={user?.nickname}
                  >
                    <UserAvatar nickname={user?.nickname ?? ''} size={32} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel className="font-normal">
                    <div className="text-sm font-medium">{user?.nickname}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={`/user/${user?.nickname}`} className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/listings" className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      My Listings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/offers" className="flex items-center gap-2">
                      <ArrowLeftRight className="h-4 w-4" />
                      My Offers
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/trades" className="flex items-center gap-2">
                      <BarChart2 className="h-4 w-4" />
                      My Trades
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                    className="cursor-pointer flex items-center gap-2"
                    data-testid="navbar-theme-toggle"
                  >
                    {resolvedTheme === 'dark' ? (
                      <Sun className="h-4 w-4" />
                    ) : (
                      <Moon className="h-4 w-4" />
                    )}
                    {resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive cursor-pointer flex items-center gap-2"
                    onClick={() => logout()}
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button asChild size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          )}

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border px-4 py-3 flex flex-col gap-1">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'relative flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent',
                pathname?.startsWith(href) ? 'bg-accent' : 'text-muted-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
              {href === '/messages' && isAuthenticated && hasUnread && (
                <span className="absolute top-2 left-6 h-2 w-2 rounded-full bg-orange-500" aria-label="Unread messages" />
              )}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
