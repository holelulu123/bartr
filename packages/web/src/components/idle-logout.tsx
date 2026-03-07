'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const LAST_ACTIVITY_KEY = 'bartr_last_activity';

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'click',
];

/**
 * Automatically logs the user out after 15 minutes of inactivity.
 * Persists the last-activity timestamp in localStorage so it survives
 * browser sleep, tab close, and full restarts.
 */
export function IdleLogout() {
  const { isAuthenticated, logout } = useAuth();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleIdle = useCallback(async () => {
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    await logout();
    if (typeof window !== 'undefined') {
      window.location.replace('/');
    }
  }, [logout]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    // Persist current timestamp so we can check elapsed time on next visit
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    timerRef.current = setTimeout(handleIdle, IDLE_TIMEOUT_MS);
  }, [handleIdle]);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Check if the user was idle too long before this page load
    // (e.g. browser was closed/sleeping)
    const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (lastActivity) {
      const elapsed = Date.now() - parseInt(lastActivity, 10);
      if (elapsed >= IDLE_TIMEOUT_MS) {
        // Expired — log out immediately
        handleIdle();
        return;
      }
      // Not expired yet — set timer for the remaining time, then switch
      // to full-duration timers on next activity
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(handleIdle, IDLE_TIMEOUT_MS - elapsed);
    } else {
      // First login or no stored timestamp — start fresh
      resetTimer();
    }

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
  }, [isAuthenticated, resetTimer, handleIdle]);

  return null;
}
