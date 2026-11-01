'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ProblemError } from '@/lib/api/client';
import { fetchCvText } from '@/lib/api/cv';
import { fetchProfile, isProfileIncomplete } from '@/lib/api/profile';
import { loadSession, refreshSession } from '@/lib/auth/session';
import type { Profile } from '@/lib/schemas/profile';
import { type Locale, labels, tr } from '@/lib/i18n';
import { useRequireAuth } from '@/lib/auth/useRequireAuth';
import { AccountMenu } from '@/components/account-menu';
import { AppShell } from '@/components/app-shell';
import { HomeHighlights } from '@/components/home-highlights';
import { ProfileMetrics } from '@/components/profile-metrics';
import { RecentActivity } from '@/components/recent-activity';
import {
  AuthSubtitle,
  Eyebrow,
  WorkspaceBar,
  WorkspaceTitle,
  contentResolve,
  cx,
  ghostButton,
  workspacePanel,
} from '@/components/ui';
import { Skeleton } from '@/components/skeleton';

type WorkspaceLoad =
  | { status: 'loading' }
  | { status: 'ready'; profile: Profile }
  | { status: 'error'; error: string };

// The home of the workspace: one implementation serves both locale trees,
// every string reads the json dictionaries, and the routes hang from the
// tree's base prefix (empty for english, /es for spanish). It summarizes:
// the profile in numbers (metrics and trend), the one recommended next
// step and where the declared evolution stands; each flow (profile, cv,
// journal, evolution) lives on its own page behind the workspace menu.
// The user-facing error voice is the dictionary's; the api problem details
// stay in the contract's english voice and only ride the detail suffix.
export function DashboardView({ locale }: { locale: Locale }) {
  const t = labels(locale);
  const base = locale === 'es' ? '/es' : '';
  const router = useRouter();
  const { isHydrated, isAuthorized, session } = useRequireAuth();
  const accessToken = session?.accessToken ?? null;

  const [load, setLoad] = useState<WorkspaceLoad>({ status: 'loading' });
  // Whether the user has a cv: the next step sends them to write one. An
  // unknown answer (loading or a failed read) never claims there is none.
  const [hasCv, setHasCv] = useState<boolean | null>(null);

  const timedOut = (error: unknown): boolean =>
    error instanceof DOMException && error.name === 'AbortError';

  const readFallback = (error: unknown): string | undefined =>
    error instanceof ProblemError ? (error.problem.detail ?? error.problem.title) : undefined;

  const loadCv = useCallback(async (token: string) => {
    try {
      await fetchCvText(token);
      setHasCv(true);
    } catch (error) {
      setHasCv(error instanceof ProblemError && error.problem.status === 404 ? false : null);
    }
  }, []);

  const loadProfile = useCallback(
    async (token: string, viaRenewal = false) => {
      setLoad({ status: 'loading' });
      try {
        const profile = await fetchProfile(token);
        // The api always seeds full_name as 'User': the placeholder owns the
        // setup flow until the user completes their profile.
        if (isProfileIncomplete(profile)) {
          router.replace(`${base}/app/profile/`);
          setLoad({ status: 'loading' });
          return;
        }
        setLoad({ status: 'ready', profile });
      } catch (error) {
        // A 401 on a READ never destroys the session: a read failure is not
        // a session event. One silent renewal is attempted with the kept
        // refresh token; if the service still declines, the session stays
        // and the failure is surfaced with a retryable message.
        if (error instanceof ProblemError && error.problem.status === 401 && !viaRenewal) {
          const kept = loadSession();
          if (kept?.refreshToken) {
            try {
              const next = await refreshSession();
              if (next) {
                return loadProfile(next.accessToken, true);
              }
            } catch {
              // fall through: keep the session, report the failure below
            }
          }
          setLoad({ status: 'error', error: t.workspace.serviceDeclined });
          return;
        }
        if (error instanceof ProblemError) {
          if (error.problem.status === 429) {
            setLoad({ status: 'error', error: t.workspace.profileRateCapped });
            return;
          }
          if (error.problem.status === 503) {
            setLoad({ status: 'error', error: t.workspace.profileWarming });
            return;
          }
          if (error.problem.status >= 500) {
            setLoad({ status: 'error', error: t.workspace.profileUnreachable });
            return;
          }
          const fallback = readFallback(error);
          setLoad({
            status: 'error',
            error: `${fallback ?? t.versionDetail.viewFallback}${t.workspace.detailSuffix}`,
          });
          return;
        }
        if (timedOut(error)) {
          setLoad({ status: 'error', error: t.workspace.profileTimeout });
          return;
        }
        // A response outside the schema or an unknown failure: fail closed —
        // never render improvised data for the user's real profile.
        setLoad({ status: 'error', error: t.workspace.profileUnknown });
      }
    },
    [router, base, t],
  );

  // The home loads once per visit. The session renews the access token in
  // the background; reloading on it would put the page behind the
  // skeleton. Retries call their loaders explicitly.
  const loaded = useRef(false);
  useEffect(() => {
    if (isHydrated && isAuthorized && accessToken && !loaded.current) {
      loaded.current = true;
      loadProfile(accessToken);
      void loadCv(accessToken);
    }
  }, [isHydrated, isAuthorized, accessToken, loadProfile, loadCv]);

  // The waiting face: the session check and the profile fetch both hide
  // the home behind the skeleton screen — never a white page.
  if (!isHydrated || !isAuthorized || load.status === 'loading') {
    return (
      <AppShell locale={locale} busy>
        <WorkspaceSkeleton />
      </AppShell>
    );
  }

  const profile = load.status === 'ready' ? load.profile : null;
  const firstName = profile ? profile.full_name.trim().split(/\s+/)[0] : '';

  return (
    <AppShell locale={locale}>
      <div className={cx(contentResolve, 'grid gap-24')}>
        <WorkspaceBar
          identity={
            <>
              <Eyebrow>{t.workspace.eyebrow}</Eyebrow>
              <WorkspaceTitle>
                {firstName ? tr(t.workspace.greeting, { name: firstName }) : t.workspace.title}
              </WorkspaceTitle>
              <AuthSubtitle>
                {tr(t.workspace.signedInAs, { email: session?.user.email ?? '' })}
              </AuthSubtitle>
            </>
          }
        >
          <AccountMenu locale={locale} />
        </WorkspaceBar>

        {load.status === 'error' ? (
          <section className={workspacePanel}>
            <div
              role="alert"
              className="rounded-lg border border-stone-muted px-12 py-8 text-[12px] leading-[1.6] text-soot"
            >
              <p>{load.error}</p>
              <button
                type="button"
                className={ghostButton}
                onClick={() => accessToken && loadProfile(accessToken)}
              >
                {t.cvCard.retry}
              </button>
            </div>
          </section>
        ) : null}

        {load.status === 'ready' && accessToken ? (
          <>
            <ProfileMetrics accessToken={accessToken} locale={locale} />
            <HomeHighlights accessToken={accessToken} locale={locale} hasCv={hasCv !== false} />
            <RecentActivity accessToken={accessToken} locale={locale} />
          </>
        ) : null}
      </div>
    </AppShell>
  );
}

// The home skeleton: the same containers as the ready state (bar, the
// metric tiles, the two highlights) with soft placeholder lines.
function WorkspaceSkeleton() {
  return (
    <>
      <div className="flex items-end justify-between gap-16 border-b border-stone-border pb-24">
        <div className="grid gap-12">
          <Skeleton width={110} height={11} />
          <Skeleton width={280} height={28} />
          <Skeleton width={210} height={14} />
        </div>
        <div className="flex items-center gap-12">
          <Skeleton width={92} height={36} />
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-12">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="grid gap-8 rounded-2xl border border-stone-border p-16">
            <Skeleton width={110} height={12} />
            <Skeleton width={80} height={28} />
            <Skeleton width="100%" height={6} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-16">
        {[0, 1].map((index) => (
          <div key={index} className={workspacePanel}>
            <Skeleton width={90} height={12} />
            <Skeleton width="80%" height={20} />
            <Skeleton width="60%" height={14} />
          </div>
        ))}
      </div>
    </>
  );
}
