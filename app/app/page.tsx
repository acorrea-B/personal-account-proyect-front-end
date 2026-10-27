'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { ProblemError } from '@/lib/api/client';
import { cvLoadMessage, fetchCvText, getVersions } from '@/lib/api/cv';
import { fetchProfile, isProfileIncomplete, profileReadMessage } from '@/lib/api/profile';
import { loadSession, refreshSession } from '@/lib/auth/session';
import type { Profile } from '@/lib/schemas/profile';
import { useRequireAuth } from '@/lib/auth/useRequireAuth';
import { AccountMenu } from '@/components/account-menu';
import { ClampedText } from '@/components/clamped-text';
import { CvCard, type CvCardState } from '@/components/cv-card';
import { CvHistoryCard, type CvHistoryState } from '@/components/cv-timeline';
import { Skeleton } from '@/components/skeleton';
import { SignalIcon } from '@/components/icons';

interface WorkspaceLoad {
  status: 'loading' | 'ready' | 'error';
  profile?: Profile;
  error?: string;
}

export default function AppHomePage() {
  const router = useRouter();
  const { isHydrated, isAuthorized, session } = useRequireAuth();
  const accessToken = session?.accessToken ?? null;

  const [load, setLoad] = useState<WorkspaceLoad>({ status: 'loading' });
  const [cvLoad, setCvLoad] = useState<CvCardState>({ kind: 'loading' });
  const [history, setHistory] = useState<CvHistoryState>({ kind: 'loading' });

  const loadCv = useCallback(async (token: string) => {
    setCvLoad({ kind: 'loading' });
    try {
      const cv = await fetchCvText(token);
      setCvLoad({ kind: 'ready', cv });
    } catch (error) {
      // Mirror the profile read: a cv read failure never destroys the
      // session and never waits on the profile - the rail card carries
      // its own retry while the profile panel stays usable.
      if (error instanceof ProblemError) {
        if (error.problem.status === 404) {
          setCvLoad({ kind: 'empty' });
          return;
        }
        setCvLoad({
          kind: 'error',
          message: cvLoadMessage(error.problem.status, error.problem.detail ?? error.problem.title),
          onRetry: () => loadCv(token),
        });
        return;
      }
      if (error instanceof DOMException && error.name === 'AbortError') {
        setCvLoad({
          kind: 'error',
          message: 'Request timed out. Please try again.',
          onRetry: () => loadCv(token),
        });
        return;
      }
      setCvLoad({
        kind: 'error',
        message: 'The cv response was not understood. Please retry or report it.',
        onRetry: () => loadCv(token),
      });
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
          router.replace('/app/profile/');
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
          setLoad({
            status: 'error',
            error:
              'The service did not accept the credential for now. Your session is kept; try again shortly.',
          });
          return;
        }
        if (error instanceof ProblemError) {
          setLoad({
            status: 'error',
            error: profileReadMessage(
              error.problem.status,
              error.problem.detail ?? error.problem.title,
            ),
          });
          return;
        }
        if (error instanceof DOMException && error.name === 'AbortError') {
          setLoad({ status: 'error', error: 'Request timed out. Please try again.' });
          return;
        }
        // A response outside the schema or an unknown failure: fail closed —
        // never render improvised data for the user's real profile.
        setLoad({
          status: 'error',
          error: 'The profile response was not understood. Please retry or report it.',
        });
      }
    },
    [router],
  );

  const loadHistory = useCallback(async (token: string) => {
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
              ? cvLoadMessage(401)
              : cvLoadMessage(error.problem.status, error.problem.detail ?? error.problem.title),
          onRetry: () => loadHistory(token),
        });
        return;
      }
      setHistory({
        kind: 'error',
        message: 'The version history failed to load. Please try again.',
        onRetry: () => loadHistory(token),
      });
    }
  }, []);

  useEffect(() => {
    if (isHydrated && isAuthorized && accessToken) {
      loadProfile(accessToken);
      // The cv rides the profile in parallel: the profile panel never waits
      // on the cv, and the rail carves its own card with its own retry.
      loadCv(accessToken);
      loadHistory(accessToken);
    }
  }, [isHydrated, isAuthorized, accessToken, loadProfile, loadCv, loadHistory]);

  // The waiting face: the session check and the profile fetch both hide
  // the dashboard behind the skeleton screen — never a white page.
  if (!isHydrated || !isAuthorized || load.status === 'loading') {
    return (
      <main className="workspace-page" aria-busy="true">
        <WorkspaceSkeleton />
      </main>
    );
  }

  const profile = load.profile;
  const firstName = profile ? profile.full_name.trim().split(/\s+/)[0] : '';

  return (
    <main className="workspace-page">
      <div className="content-resolve">
        <header className="workspace-bar">
          <div className="workspace-identity">
            <p className="eyebrow">Your workspace</p>
            <h1 className="workspace-title">
              {firstName ? `Hello, ${firstName}.` : 'Your workspace'}
            </h1>
            <p className="auth-subtitle">Signed in as {session?.user.email}</p>
          </div>
          <AccountMenu />
        </header>

        {load.status === 'error' ? (
          <section className="profile-panel">
            <div role="alert" className="form-error">
              <p>{load.error}</p>
              <button
                type="button"
                className="button button-ghost"
                onClick={() => accessToken && loadProfile(accessToken)}
              >
                Try again
              </button>
            </div>
          </section>
        ) : null}

        {load.status === 'ready' && profile ? (
          <div className="dashboard-grid">
            <section className="profile-panel" aria-label="Your profile">
              <div className="panel-head">
                <p className="eyebrow">Profile · live from the api</p>
                <Link className="link" href="/app/profile/">
                  Update profile
                </Link>
              </div>

              <dl className="profile-grid">
                <div>
                  <dt>Full name</dt>
                  <dd className="profile-headline">{profile.full_name}</dd>
                </div>
                {profile.headline ? (
                  <div>
                    <dt>Headline</dt>
                    <dd>{profile.headline}</dd>
                  </div>
                ) : null}
                {profile.location ? (
                  <div>
                    <dt>Location</dt>
                    <dd>{profile.location}</dd>
                  </div>
                ) : null}
              </dl>

              {profile.bio ? (
                <div>
                  <p className="eyebrow">Bio</p>
                  <ClampedText text={profile.bio} className="clamped-text" />
                </div>
              ) : null}

              {profile.skills ? (
                <div>
                  <p className="eyebrow">Skills</p>
                  <ul className="skill-chips" aria-label="Skills">
                    {profile.skills.map((skill) => (
                      <li key={skill.toLowerCase()}>{skill}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {profile.links ? (
                <div>
                  <p className="eyebrow">Links</p>
                  <ul className="profile-links" aria-label="Links">
                    {profile.links.map((link) => (
                      <li key={link.url}>
                        <a
                          className="link"
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

              <p className="auth-form-note">As the api holds it · Updated {profile.updated_at}</p>
            </section>

            <aside className="upcoming-panel" aria-label="Coming to your workspace">
              <p className="eyebrow">Coming up</p>
              <ul className="upcoming-list">
                <CvCard state={cvLoad} />
                <CvHistoryCard state={history} />
                <li className="upcoming-item">
                  <SignalIcon />
                  <div className="upcoming-copy">
                    <strong>Skill suggestions</strong>
                    <span>Inferred from what the api already knows about you.</span>
                    <span className="status-chip">After beta 1</span>
                  </div>
                </li>
              </ul>
            </aside>
          </div>
        ) : null}
      </div>
    </main>
  );
}

// The dashboard skeleton: the same containers as the ready state (bar,
// profile panel, coming-up rail) with the content replaced by soft
// placeholder lines riding the blurred glow sweep.
function WorkspaceSkeleton() {
  return (
    <>
      <div className="skeleton-bar">
        <div className="skeleton-screen">
          <Skeleton width={110} height={11} />
          <Skeleton width={280} height={28} />
          <Skeleton width={210} height={14} />
        </div>
        <div className="workspace-actions">
          <Skeleton width={40} height={40} />
          <Skeleton width={92} height={36} />
        </div>
      </div>
      <div className="dashboard-grid">
        <div className="profile-panel">
          <div className="skeleton-screen">
            <Skeleton width={150} height={12} />
            <Skeleton width="100%" height={16} />
            <Skeleton width="70%" height={16} />
            <Skeleton width="55%" height={16} />
            <Skeleton width="85%" height={16} />
          </div>
        </div>
        <div className="upcoming-panel">
          <div className="skeleton-screen">
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
