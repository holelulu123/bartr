'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'click',
];

/**
 * Automatically logs the user out after 5 minutes of inactivity
 * and redirects to the main page.
 */
export function IdleLogout() {
  const { isAuthenticated, logout } = useAuth();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleIdle = useCallback(async () => {
    await logout();
    if (typeof window !== 'undefined') {
      window.location.replace('/');
    }
  }, [logout]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(handleIdle, IDLE_TIMEOUT_MS);
  }, [handleIdle]);

  useEffect(() => {
    if (!isAuthenticated) return;

    resetTimer();

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, resetTimer, { passive: true });
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, resetTimer);
      }
    };
  }, [isAuthenticated, resetTimer]);

  return null;
}
