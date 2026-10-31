'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useState } from 'react';

import { ProblemError } from '@/lib/api/client';
import { fetchCvText, getVersions } from '@/lib/api/cv';
import { fetchProfile, isProfileIncomplete } from '@/lib/api/profile';
import { fetchProfileSkills } from '@/lib/api/suggestions';
import type { ProfileSkill } from '@/lib/schemas/suggestions';
import { loadSession, refreshSession } from '@/lib/auth/session';
import type { Profile } from '@/lib/schemas/profile';
import { type Locale, labels, tr } from '@/lib/i18n';
import { useRequireAuth } from '@/lib/auth/useRequireAuth';
import { AccountMenu } from '@/components/account-menu';
import {
  AuthFormNote,
  AuthSubtitle,
  Eyebrow,
  SkillChips,
  WorkspaceBar,
  WorkspacePage,
  WorkspaceTitle,
  cx,
  ghostButton,
  linkClass,
  workspacePanel,
} from '@/components/ui';
import { ClampedText } from '@/components/clamped-text';
import { CvCard, type CvCardState } from '@/components/cv-card';
import { CvHistoryCard, formatWhen, type CvHistoryState } from '@/components/cv-timeline';
import { CvVersionDetail } from '@/components/cv-version-detail';
import { Skeleton } from '@/components/skeleton';
import { SkillSuggestionsCard } from '@/components/skill-suggestions-card';

type WorkspaceLoad =
  | { status: 'loading' }
  | { status: 'ready'; profile: Profile }
  | { status: 'error'; error: string };

// The shared workspace dashboard: one implementation serves both locale
// trees, every page string reads the json dictionaries, and the routes
// hang from the tree's base prefix (empty for english, /es for spanish).
// The tree's user-facing error voice is the dictionary's; the api problem
// details stay in the contract's english voice and only ride the detail
// suffix composition. This view is the en dashboard (the superset mirror:
// version detail dialog, history on-select, abort handling) - the stale
// es mirror is retired with the same behavior restored to /es/app.
export function DashboardView({ locale }: { locale: Locale }) {
  const t = labels(locale);
  const base = locale === 'es' ? '/es' : '';
  const router = useRouter();
  const { isHydrated, isAuthorized, session } = useRequireAuth();
  const accessToken = session?.accessToken ?? null;

  const [load, setLoad] = useState<WorkspaceLoad>({ status: 'loading' });
  const [cvCard, setCvCard] = useState<CvCardState>({ kind: 'loading' });
  const [history, setHistory] = useState<CvHistoryState>({ kind: 'loading' });
  const [detailVersionId, setDetailVersionId] = useState<string | null>(null);

  const timedOut = (error: unknown): boolean =>
    error instanceof DOMException && error.name === 'AbortError';

  const readFallback = (error: unknown): string | undefined =>
    error instanceof ProblemError ? (error.problem.detail ?? error.problem.title) : undefined;

  const loadCv = useCallback(
    async (token: string) => {
      setCvCard({ kind: 'loading' });
      try {
        const cv = await fetchCvText(token);
        setCvCard({ kind: 'ready', cv });
      } catch (error) {
        // Mirror the profile read: a cv read failure never destroys the
        // session and never waits on the profile - the rail card carries
        // its own retry while the profile panel stays usable.
        if (error instanceof ProblemError) {
          if (error.problem.status === 404) {
            setCvCard({ kind: 'empty' });
            return;
          }
          if (error.problem.status === 429) {
            setCvCard({
              kind: 'error',
              message: t.workspace.cvRateCapped,
              onRetry: () => loadCv(token),
            });
            return;
          }
          if (error.problem.status === 401) {
            setCvCard({
              kind: 'error',
              message: t.workspace.serviceDeclined,
              onRetry: () => loadCv(token),
            });
            return;
          }
          const fallback = readFallback(error);
          setCvCard({
            kind: 'error',
            message: fallback ? `${fallback}${t.workspace.detailSuffix}` : t.workspace.cvFallback,
            onRetry: () => loadCv(token),
          });
          return;
        }
        if (timedOut(error)) {
          setCvCard({
            kind: 'error',
            message: t.workspace.cvTimeout,
            onRetry: () => loadCv(token),
          });
          return;
        }
        setCvCard({
          kind: 'error',
          message: t.workspace.cvFallback,
          onRetry: () => loadCv(token),
        });
      }
    },
    [t],
  );

  // The skill rows tell which skills came from an accepted suggestion; a
  // failed read just leaves the chips unmarked.
  const [skillRows, setSkillRows] = useState<ProfileSkill[] | null>(null);
  const loadSkillRows = useCallback(async (token: string) => {
    try {
      setSkillRows(await fetchProfileSkills(token));
    } catch {
      setSkillRows(null);
    }
  }, []);

  // After a suggestion is accepted: the profile and the rows refresh in
  // place, without the skeleton, so the new skill appears in the chips.
  const refreshSkills = useCallback(async (token: string) => {
    try {
      const [profile, rows] = await Promise.all([fetchProfile(token), fetchProfileSkills(token)]);
      setLoad({ status: 'ready', profile });
      setSkillRows(rows);
    } catch {
      // keep what is shown; the next visit reads it again
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

  const loadHistory = useCallback(
    async (token: string) => {
      setHistory({ kind: 'loading' });
      try {
        const versions = await getVersions(token);
        setHistory({ kind: 'ready', versions });
      } catch (error) {
        // Same read rule as the cv card: the history failure never destroys
        // the session and stays inside its own card with a retry.
        if (error instanceof ProblemError) {
          setHistory({
            kind: 'error',
            message:
              error.problem.status === 401
                ? t.workspace.serviceDeclined
                : error.problem.status === 429
                  ? t.workspace.cvRateCapped
                  : `${readFallback(error) ?? ''}${t.workspace.detailSuffix}`,
            onRetry: () => loadHistory(token),
          });
          return;
        }
        setHistory({
          kind: 'error',
          message: t.workspace.historyFallback,
          onRetry: () => loadHistory(token),
        });
      }
    },
    [t],
  );

  useEffect(() => {
    if (isHydrated && isAuthorized && accessToken) {
      loadProfile(accessToken);
      // The cv and the history ride the profile in parallel: the profile
      // panel never waits on the rail cards, each with its own retry.
      loadCv(accessToken);
      loadHistory(accessToken);
      void loadSkillRows(accessToken);
    }
  }, [isHydrated, isAuthorized, accessToken, loadProfile, loadCv, loadHistory, loadSkillRows]);

  // The waiting face: the session check and the profile fetch both hide
  // the dashboard behind the skeleton screen — never a white page.
  if (!isHydrated || !isAuthorized || load.status === 'loading') {
    return (
      <WorkspacePage busy>
        <WorkspaceSkeleton />
      </WorkspacePage>
    );
  }

  const profile = load.status === 'ready' ? load.profile : null;
  const acceptedSkills = new Set(
    (skillRows ?? [])
      .filter((row) => row.origin === 'accepted')
      .map((row) => row.display_name.toLowerCase()),
  );
  const firstName = profile ? profile.full_name.trim().split(/\s+/)[0] : '';

  return (
    <WorkspacePage>
      <div className="content-resolve">
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

        {load.status === 'ready' && profile ? (
          <div className={dashboardGrid}>
            <section className={workspacePanel} aria-label={t.workspace.profilePanel}>
              <div className="flex items-center justify-between gap-16 max-sm:flex-col max-sm:items-stretch max-sm:gap-8">
                <Eyebrow>{t.panel.eyebrow}</Eyebrow>
                <Link
                  className={cx(
                    linkClass,
                    'max-sm:flex max-sm:min-h-[44px] max-sm:items-center max-sm:justify-center max-sm:rounded-full max-sm:bg-sky-wash max-sm:text-[16px]',
                  )}
                  href={`${base}/app/profile/`}
                >
                  {t.panel.updateLink}
                </Link>
              </div>

              <dl className="m-0 grid gap-12">
                <ProfileFact term={t.panel.fullName} headline>
                  {profile.full_name}
                </ProfileFact>
                {profile.headline ? (
                  <ProfileFact term={t.panel.headline}>{profile.headline}</ProfileFact>
                ) : null}
                {profile.location ? (
                  <ProfileFact term={t.panel.location}>{profile.location}</ProfileFact>
                ) : null}
              </dl>

              {profile.bio ? (
                <div>
                  <Eyebrow>{t.panel.bio}</Eyebrow>
                  <ClampedText text={profile.bio} className="m-0 text-ink-black" locale={locale} />
                </div>
              ) : null}

              {profile.skills ? (
                <div>
                  <Eyebrow>{t.panel.skills}</Eyebrow>
                  <SkillChips
                    skills={profile.skills}
                    label={t.panel.skills}
                    marked={acceptedSkills}
                    markedLabel={t.panel.acceptedSkill}
                  />
                  {acceptedSkills.size ? (
                    <p className="mt-8 mb-0 text-(length:--text-label) text-warm-gray">
                      {t.panel.acceptedLegend}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {profile.links ? (
                <div>
                  <Eyebrow>{t.panel.links}</Eyebrow>
                  <ul
                    className="m-0 flex list-none flex-wrap gap-16 p-0"
                    aria-label={t.panel.links}
                  >
                    {profile.links.map((link) => (
                      <li key={link.url}>
                        <a
                          className={linkClass}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {link.type}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <AuthFormNote>
                {tr(t.panel.updatedNote, { date: formatWhen(profile.updated_at, locale) })}
              </AuthFormNote>
            </section>

            <aside className={workspacePanel} aria-label={t.workspace.comingUpPanel}>
              <Eyebrow>{t.panel.comingUp}</Eyebrow>
              <ul className="m-0 grid list-none gap-12 p-0">
                <CvCard state={cvCard} locale={locale} />
                <CvHistoryCard
                  state={history}
                  locale={locale}
                  onSelect={accessToken ? (id: string) => setDetailVersionId(id) : undefined}
                />
                {accessToken ? (
                  <SkillSuggestionsCard
                    accessToken={accessToken}
                    locale={locale}
                    onAccepted={() => void refreshSkills(accessToken)}
                  />
                ) : null}
              </ul>
            </aside>
          </div>
        ) : null}

        {accessToken && detailVersionId ? (
          <CvVersionDetail
            id={detailVersionId}
            accessToken={accessToken}
            locale={locale}
            currentUpdatedAt={cvCard.kind === 'ready' ? cvCard.cv.updated_at : undefined}
            onClose={() => setDetailVersionId(null)}
            onRestored={() => {
              setDetailVersionId(null);
              if (accessToken) {
                void loadCv(accessToken);
                void loadHistory(accessToken);
              }
            }}
          />
        ) : null}
      </div>
    </WorkspacePage>
  );
}

// .dashboard-grid: the profile panel and the coming-up rail side by side,
// stacked under 860px.
const dashboardGrid =
  'grid grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)] items-start gap-16 max-md:grid-cols-1';

// One fact of the profile panel (.profile-grid > div, dt, dd): the cyan
// rule on the left, the label over the value; the name reads larger.
function ProfileFact({
  term,
  headline,
  children,
}: {
  term: string;
  headline?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-4 border-l-2 border-sky-wash pl-12">
      <dt className="text-(length:--text-label) tracking-[0.08em] text-cyan-text uppercase">
        {term}
      </dt>
      <dd className={cx('m-0 text-ink-black', headline && 'text-(length:--text-subheading)')}>
        {children}
      </dd>
    </div>
  );
}

// The dashboard skeleton: the same containers as the ready state (bar,
// profile panel, coming-up rail) with the content replaced by soft
// placeholder lines riding the blurred glow sweep.
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
          <Skeleton width={40} height={40} />
          <Skeleton width={92} height={36} />
        </div>
      </div>
      <div className={dashboardGrid}>
        <div className={workspacePanel}>
          <div className="grid gap-12">
            <Skeleton width={150} height={12} />
            <Skeleton width="100%" height={16} />
            <Skeleton width="70%" height={16} />
            <Skeleton width="55%" height={16} />
            <Skeleton width="85%" height={16} />
          </div>
        </div>
        <div className={workspacePanel}>
          <div className="grid gap-12">
            <Skeleton width={90} height={12} />
            <Skeleton width="100%" height={44} />
            <Skeleton width="100%" height={44} />
            <Skeleton width="100%" height={44} />
          </div>
        </div>
      </div>
    </>
  );
}
