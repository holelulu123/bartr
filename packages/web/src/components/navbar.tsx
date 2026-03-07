'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Menu, X, MessageSquare, Store, ArrowLeftRight, Heart, Info, ShieldCheck, Moon, Sun, User, Package, Settings, LogOut, Bell } from 'lucide-react';
import { useTheme } from 'next-themes';
import { APP_NAME } from '@bartr/shared';
import { useAuth } from '@/contexts/auth-context';
import { useCrypto } from '@/contexts/crypto-context';
import { useMessageSidebar } from '@/contexts/message-sidebar-context';
import { useThreads } from '@/hooks/use-messages';
import { useUnreadThreads } from '@/hooks/use-unread-threads';
import { usePendingProposals } from '@/hooks/use-pending-proposals';
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
import { cn, fmtAmount } from '@/lib/utils';


function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return '1W+';
}

const navLinks = [
  { href: '/exchange', label: 'P2P Exchange', icon: ArrowLeftRight },
  { href: '/market', label: 'Marketplace', icon: Store },
  { href: '/tips', label: 'Tips', icon: ShieldCheck },
  { href: '/about', label: 'About', icon: Info },
];

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { lock } = useCrypto();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  // Unread message indicator — only fetch threads when authenticated
  const { data: threadsData } = useThreads({ enabled: isAuthenticated });
  const { hasUnread } = useUnreadThreads(
    threadsData?.threads ?? [],
    user?.nickname ?? '',
  );

  const { notifications, hasNew: hasNewProposals, hasMore: hasMoreNotifs, loadMore: loadMoreNotifs, markAllRead } = usePendingProposals(isAuthenticated);
  const { isOpen: messagesOpen, openSidebar, openThread, closeSidebar: closeMessages } = useMessageSidebar();

  // Auto-open chat when a new message arrives from someone else
  const threads = threadsData?.threads ?? [];
  const myNick = user?.nickname ?? '';

  // Build a map of threadId -> last_message_at for threads where the last sender is not me
  const incomingTimestamps = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of threads) {
      if (t.last_message_at && t.last_sender_nickname && t.last_sender_nickname !== myNick) {
        map.set(t.id, t.last_message_at);
      }
    }
    return map;
  }, [threads, myNick]);

  const prevIncoming = useRef<Map<string, string>>(incomingTimestamps);
  useEffect(() => {
    const prev = prevIncoming.current;
    prevIncoming.current = incomingTimestamps;

    // Find threads where last_message_at is newer than what we saw before
    let newestThread: { id: string; time: string } | null = null;
    for (const [id, time] of incomingTimestamps) {
      const prevTime = prev.get(id);
      if (!prevTime || time > prevTime) {
        if (!newestThread || time > newestThread.time) {
          newestThread = { id, time };
        }
      }
    }

    if (newestThread) {
      openThread(newestThread.id);
    }
  }, [incomingTimestamps, openThread]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        {/* Logo */}
        <Link href="/" className="mr-6 flex items-center gap-2 font-bold text-primary text-lg">
          <Image src="/logo.png" alt="" width={28} height={28} className="h-7 w-7" />
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
            </Link>
          ))}
          <Link
            href="/donate"
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              pathname?.startsWith('/donate')
                ? 'bg-pink-500/15 text-pink-600 dark:text-pink-400'
                : 'text-pink-500 dark:text-pink-400 hover:bg-pink-500/10',
            )}
          >
            <Heart className="h-3.5 w-3.5 fill-current" />
            Donate
          </Link>
        </nav>

        {/* Right section */}
        <div className="ml-auto flex items-center gap-4">
          {isAuthenticated ? (
            <>
              {/* Messages icon */}
              <button
                className="relative rounded-md p-1.5 text-muted-foreground hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Messages"
                onClick={messagesOpen ? closeMessages : openSidebar}
              >
                <MessageSquare className="h-5 w-5" />
                {hasUnread && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-orange-500" aria-label="Unread messages" />
                )}
              </button>

              {/* Notifications bell */}
              <DropdownMenu onOpenChange={(open) => { if (open) markAllRead(); }}>
                <DropdownMenuTrigger asChild>
                  <button
                    className="relative rounded-md p-1.5 text-muted-foreground hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Notifications"
                  >
                    <Bell className="h-5 w-5" />
                    {hasNewProposals && (
                      <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-orange-500" aria-label="New proposals" />
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {notifications.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                      No notifications
                    </div>
                  ) : (
                    <>
                      {notifications.map((n) => {
                        const t = n.trade;
                        const pair = t.offer_summary?.replace(/^(buy|sell)\s+/i, '') ?? '';
                        const amount = t.fiat_amount != null ? `${fmtAmount(t.fiat_amount)} ${t.offer_summary?.split('/')[1] ?? ''}` : '';
                        let label: React.ReactNode;
                        let otherNickname: string;
                        if (n.type === 'incoming_offer') {
                          otherNickname = t.buyer_nickname;
                          label = <><span className="font-medium">{t.buyer_nickname}</span> offered you{amount ? ` ${amount}` : ''} on <span className="font-medium">{pair}</span></>;
                        } else if (n.type === 'offer_accepted') {
                          otherNickname = t.seller_nickname;
                          label = <><span className="font-medium">{t.seller_nickname}</span> accepted your{amount ? ` ${amount}` : ''} offer on <span className="font-medium">{pair}</span></>;
                        } else {
                          otherNickname = t.seller_nickname;
                          label = <><span className="font-medium">{t.seller_nickname}</span> declined your{amount ? ` ${amount}` : ''} offer on <span className="font-medium">{pair}</span></>;
                        }
                        return (
                          <DropdownMenuItem key={n.id} asChild>
                            <Link
                              href={`/exchange/${t.offer_id}`}
                              className="flex items-center gap-2 py-2"
                            >
                              <UserAvatar nickname={otherNickname} size={28} />
                              <span className="text-sm flex-1">{label}</span>
                              <span className={cn('text-xs font-medium shrink-0', n.type === 'offer_accepted' ? 'text-green-500' : n.type === 'offer_declined' ? 'text-red-500' : 'text-orange-500')}>
                                {timeAgo(n.timestamp)}
                              </span>
                            </Link>
                          </DropdownMenuItem>
                        );
                      })}
                      {hasMoreNotifs && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={(e) => { e.preventDefault(); loadMoreNotifs(); }}
                            className="justify-center text-xs text-muted-foreground cursor-pointer py-2"
                          >
                            Load more
                          </DropdownMenuItem>
                        </>
                      )}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

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
                      My Contracts
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
                    onClick={() => { lock(); logout(); }}
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
          {isAuthenticated && (
            <button
              type="button"
              onClick={() => { (messagesOpen ? closeMessages : openSidebar)(); setMobileOpen(false); }}
              className="relative flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent text-muted-foreground"
            >
              <MessageSquare className="h-4 w-4" />
              Messages
              {hasUnread && (
                <span className="absolute top-2 left-6 h-2 w-2 rounded-full bg-orange-500" aria-label="Unread messages" />
              )}
            </button>
          )}
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
            </Link>
          ))}
          <Link
            href="/donate"
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              pathname?.startsWith('/donate')
                ? 'bg-pink-500/15 text-pink-600 dark:text-pink-400'
                : 'text-pink-500 dark:text-pink-400 hover:bg-pink-500/10',
            )}
          >
            <Heart className="h-4 w-4 fill-current" />
            Donate
          </Link>
        </div>
      )}
    </header>
  );
}
