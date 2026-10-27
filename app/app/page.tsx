'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { ProblemError } from '@/lib/api/client';
import { fetchProfile, isProfileIncomplete, profileReadMessage } from '@/lib/api/profile';
import { loadSession, refreshSession } from '@/lib/auth/session';
import type { Profile } from '@/lib/schemas/profile';
import { useRequireAuth } from '@/lib/auth/useRequireAuth';
import { AccountMenu } from '@/components/account-menu';
import { ClampedText } from '@/components/clamped-text';
import { ProfileIcon, ShieldIcon, SignalIcon } from '@/components/icons';

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

  useEffect(() => {
    if (isHydrated && isAuthorized && accessToken) {
      loadProfile(accessToken);
    }
  }, [isHydrated, isAuthorized, accessToken, loadProfile]);

  if (!isHydrated || !isAuthorized) {
    return (
      <main className="auth-page">
        <p className="auth-subtitle loading-state">Checking session…</p>
      </main>
    );
  }

  const profile = load.profile;
  const firstName = profile ? profile.full_name.trim().split(/\s+/)[0] : '';

  return (
    <main className="workspace-page">
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

      {load.status === 'loading' ? (
        <p className="auth-subtitle loading-state">Loading your profile…</p>
      ) : null}

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
                      <a className="link" href={link.url} target="_blank" rel="noopener noreferrer">
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
              <li className="upcoming-item">
                <ProfileIcon />
                <div className="upcoming-copy">
                  <strong>CV editor</strong>
                  <span>Write and save your CV text, in place.</span>
                  <span className="status-chip">Planned next</span>
                </div>
              </li>
              <li className="upcoming-item">
                <ShieldIcon />
                <div className="upcoming-copy">
                  <strong>Version history</strong>
                  <span>At most 10 versions, newest first, ready to read.</span>
                  <span className="status-chip">Planned</span>
                </div>
              </li>
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
    </main>
  );
}
