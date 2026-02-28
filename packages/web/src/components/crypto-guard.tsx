'use client';

/**
 * Pass-through wrapper for pages that previously required E2E keys.
 * Keys are now unlocked automatically at login time.
 * Kept as a no-op wrapper for backward compatibility.
 */
export function CryptoGuard({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
