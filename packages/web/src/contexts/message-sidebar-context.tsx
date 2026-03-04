'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

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

export function MessageSidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [pendingContact, setPendingContact] = useState<{ nickname: string; listingId?: string } | null>(null);

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
