'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { ProblemError, refresh } from '@/lib/api/client';
import { fetchProfile, profileReadMessage } from '@/lib/api/profile';
import { loadSession } from '@/lib/auth/session';
import type { Profile } from '@/lib/schemas/profile';
import { useRequireAuth } from '../../lib/auth/useRequireAuth';

interface WorkspaceLoad {
  status: 'loading' | 'ready' | 'error';
  profile?: Profile;
  error?: string;
}

export default function AppHomePage() {
  const { isHydrated, isAuthorized, session } = useRequireAuth();
  const accessToken = session?.accessToken ?? null;

  const [load, setLoad] = useState<WorkspaceLoad>({ status: 'loading' });

  const loadProfile = useCallback(async (token: string, viaRenewal = false) => {
    setLoad({ status: 'loading' });
    try {
      const profile = await fetchProfile(token);
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
            const renewed = await refresh({ refresh_token: kept.refreshToken });
            const next = loadSession();
            if (next) {
              return loadProfile(next.accessToken, true);
            }
            return loadProfile(renewed.access_token, true);
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
  }, []);

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

  return (
    <main className="auth-page">
      <section className="auth-shell auth-card" aria-label="Your workspace">
        <header className="workspace-header">
          <div>
            <h1 className="auth-heading">Your workspace</h1>
            <p className="auth-subtitle">Signed in as {session?.user.email}</p>
          </div>
          <Link className="link" href="/logout/">
            Sign out
          </Link>
        </header>

        {load.status === 'loading' ? (
          <p className="auth-subtitle loading-state">Loading your profile…</p>
        ) : null}

        {load.status === 'error' ? (
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
        ) : null}

        {load.status === 'ready' && load.profile ? (
          <div className="workspace-profile">
            <p className="auth-kicker">
              <span className="auth-kicker-icon">●</span>
              Profile, live from the api
            </p>

            <dl className="profile-grid">
              {load.profile.headline ? (
                <div>
                  <dt>Headline</dt>
                  <dd className="profile-headline">{load.profile.headline}</dd>
                </div>
              ) : null}
              <div>
                <dt>Full name</dt>
                <dd>{load.profile.full_name}</dd>
              </div>
              {load.profile.bio ? (
                <div>
                  <dt>Bio</dt>
                  <dd>{load.profile.bio}</dd>
                </div>
              ) : null}
              {load.profile.location ? (
                <div>
                  <dt>Location</dt>
                  <dd>{load.profile.location}</dd>
                </div>
              ) : null}
            </dl>

            {load.profile.skills ? (
              <ul className="skill-chips" aria-label="Skills">
                {load.profile.skills.map((skill) => (
                  <li key={skill.toLowerCase()}>{skill}</li>
                ))}
              </ul>
            ) : null}

            {load.profile.links ? (
              <ul className="profile-links" aria-label="Links">
                {load.profile.links.map((link) => (
                  <li key={link.url}>
                    <a className="link" href={link.url} target="_blank" rel="noopener noreferrer">
                      {link.type}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}

            <p className="auth-form-note">
              As the api holds it · Updated {load.profile.updated_at} · Created
              {load.profile.created_at}
            </p>
          </div>
        ) : null}
      </section>
    </main>
  );
}
