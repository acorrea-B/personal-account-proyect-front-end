'use client';

import { AccountMenu } from '@/components/account-menu';
import { AppShell } from '@/components/app-shell';
import { EvolutionCard } from '@/components/evolution-card';
import { Skeleton } from '@/components/skeleton';
import {
  Eyebrow,
  WorkspaceBar,
  WorkspaceTitle,
  contentResolve,
  cx,
  workspacePanel,
} from '@/components/ui';
import { useRequireAuth } from '@/lib/auth/useRequireAuth';
import { type Locale, labels } from '@/lib/i18n';

// The evolution page (BC-005/BC-008): the declared mode, its declaration
// form and the checks the harness recorded, on a page of their own instead
// of crowding the home summary.
export function EvolutionView({ locale }: { locale: Locale }) {
  const t = labels(locale);
  const { isHydrated, isAuthorized, session } = useRequireAuth();
  const accessToken = session?.accessToken ?? null;

  const bar = (
    <WorkspaceBar
      identity={
        <>
          <Eyebrow>{t.workspace.eyebrow}</Eyebrow>
          <WorkspaceTitle>{t.nav.evolution}</WorkspaceTitle>
        </>
      }
    >
      <AccountMenu locale={locale} />
    </WorkspaceBar>
  );

  if (!isHydrated || !isAuthorized || !accessToken) {
    return (
      <AppShell locale={locale} back busy>
        {bar}
        <section className={workspacePanel} aria-label={t.evolution.loadingAria}>
          <div className="grid gap-12">
            <Skeleton width="60%" height={16} />
            <Skeleton width="100%" height={14} />
          </div>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell locale={locale} back>
      <div className={cx(contentResolve, 'grid gap-32')}>
        {bar}
        <EvolutionCard accessToken={accessToken} locale={locale} />
      </div>
    </AppShell>
  );
}
