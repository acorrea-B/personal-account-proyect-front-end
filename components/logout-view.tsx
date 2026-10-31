'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { signOut } from '@/lib/auth/session';
import { type Locale, labels } from '@/lib/i18n';
import { AuthCard, AuthHeading, AuthPage, AuthSubtitle } from '@/components/ui';

// The shared sign-out view: the revoke+clear lives in the session module
// and the route always finishes by handing the user to its tree's sign-in
// page, even when the api revoke fails. No language control here: the
// signed-out state returns the signed-out copy of the tree it left.
export function LogoutView({ locale }: { locale: Locale }) {
  const t = labels(locale);
  const base = locale === 'es' ? '/es' : '';
  const router = useRouter();

  useEffect(() => {
    void signOut()
      .catch(() => {
        // The revoke failing never blocks the exit: the local clear already
        // happened in the session module; the sign-in handoff proceeds.
      })
      .finally(() => {
        router.replace(`${base}/login/`);
      });
  }, [router, base]);

  return (
    <AuthPage>
      <AuthCard>
        <AuthHeading>{t.logout.heading}</AuthHeading>
        <AuthSubtitle>{t.logout.subtitle}</AuthSubtitle>
      </AuthCard>
    </AuthPage>
  );
}
