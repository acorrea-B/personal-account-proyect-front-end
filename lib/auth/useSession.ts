'use client';

import { useEffect, useState } from 'react';

import { loadSession, refreshSession, type AuthSession } from './session';

export function useSession() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setSession(loadSession());
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    let cancelled = false;
    const interval = window.setInterval(
      async () => {
        try {
          const refreshed = await refreshSession(session);
          if (!cancelled) {
            setSession(refreshed);
          }
        } catch {
          if (!cancelled) {
            setSession(loadSession());
          }
        }
      },
      5 * 60 * 1000,
    );

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [session]);

  return { session, isHydrated };
}
