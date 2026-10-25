'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useSession } from './useSession';

export function useRequireAuth() {
  const router = useRouter();
  const { session, isHydrated } = useSession();

  useEffect(() => {
    if (isHydrated && !session) {
      router.replace('/login/');
    }
  }, [isHydrated, session, router]);

  return { session, isHydrated, isAuthorized: Boolean(isHydrated && session) };
}
