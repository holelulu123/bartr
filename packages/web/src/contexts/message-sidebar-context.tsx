'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useAuth } from '@/contexts/auth-context';

interface MessageSidebarState {
  isOpen: boolean;
  selectedThreadId: string | null;
  pendingContact: { nickname: string; listingId?: string } | null;
  openSidebar: () => void;
  closeSidebar: () => void;
  openThread: (threadId: string) => void;
  openContact: (nickname: string, listingId?: string) => void;
  clearSelection: () => void;
}

const MessageSidebarContext = createContext<MessageSidebarState | null>(null);

function readSession<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = sessionStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}

export function MessageSidebarProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [pendingContact, setPendingContact] = useState<{ nickname: string; listingId?: string } | null>(null);

  // Restore from sessionStorage after hydration
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const savedOpen = readSession('sidebar-open', false);
    const savedThread = readSession<string | null>('sidebar-thread', null);
    if (savedOpen) setIsOpen(true);
    if (savedThread) setSelectedThreadId(savedThread);
  }, []);

  // Close sidebar when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      setIsOpen(false);
      setSelectedThreadId(null);
      setPendingContact(null);
    }
  }, [isAuthenticated]);

  useEffect(() => { sessionStorage.setItem('sidebar-open', JSON.stringify(isOpen)); }, [isOpen]);
  useEffect(() => { sessionStorage.setItem('sidebar-thread', JSON.stringify(selectedThreadId)); }, [selectedThreadId]);

  const openSidebar = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsOpen(false);
    setSelectedThreadId(null);
    setPendingContact(null);
  }, []);

  const openThread = useCallback((threadId: string) => {
    setSelectedThreadId(threadId);
    setPendingContact(null);
    setIsOpen(true);
  }, []);

  const openContact = useCallback((nickname: string, listingId?: string) => {
    setPendingContact({ nickname, listingId });
    setSelectedThreadId(null);
    setIsOpen(true);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedThreadId(null);
    setPendingContact(null);
  }, []);

  return (
    <MessageSidebarContext.Provider
      value={{ isOpen, selectedThreadId, pendingContact, openSidebar, closeSidebar, openThread, openContact, clearSelection }}
    >
      {children}
    </MessageSidebarContext.Provider>
  );
}

export function useMessageSidebar() {
  const ctx = useContext(MessageSidebarContext);
  if (!ctx) throw new Error('useMessageSidebar must be used within MessageSidebarProvider');
  return ctx;
}
