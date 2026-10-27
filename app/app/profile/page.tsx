'use client';

import Link from 'next/link';
import { type SyntheticEvent, useCallback, useEffect, useState } from 'react';

import { ProblemError } from '@/lib/api/client';
import { fetchProfile, profileReadMessage, updateProfile } from '@/lib/api/profile';
import { loadSession, signOut } from '@/lib/auth/session';
import { updateProfileRequestSchema, type Profile } from '@/lib/schemas/profile';
import { useRequireAuth } from '@/lib/auth/useRequireAuth';

type SaveState = { status: 'idle' | 'saving' | 'saved'; note?: string };
type LoadState = { status: 'loading' | 'ready' | 'error'; profile?: Profile; error?: string };

export default function ProfileSetupPage() {
  const { isHydrated, isAuthorized, session } = useRequireAuth();
  const accessToken = session?.accessToken ?? null;

  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formNote, setFormNote] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>({ status: 'idle' });

  const populate = useCallback((from: Profile) => {
    setFullName(from.full_name === 'User' ? '' : from.full_name);
    setHeadline(from.headline ?? '');
    setBio(from.bio ?? '');
    setLocation(from.location ?? '');
  }, []);

  const loadProfile = useCallback(
    async (token: string) => {
      setLoad({ status: 'loading' });
      try {
        const fetched = await fetchProfile(token);
        setProfile(fetched);
        populate(fetched);
        setLoad({ status: 'ready', profile: fetched });
      } catch (error) {
        // Same read semantics as the workspace: a 401 never destroys the
        // session; the failure is surfaced with a retryable message.
        if (error instanceof ProblemError && error.problem.status === 401) {
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
        setLoad({
          status: 'error',
          error: 'The profile response was not understood. Please retry or report it.',
        });
      }
    },
    [populate],
  );

  useEffect(() => {
    if (isHydrated && isAuthorized && accessToken) {
      loadProfile(accessToken);
    }
  }, [isHydrated, isAuthorized, accessToken, loadProfile]);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormNote(null);
    setFieldErrors({});

    if (profile && accessToken) {
      const parsed = updateProfileRequestSchema.safeParse({
        full_name: fullName,
        headline: headline.trim() ? headline : undefined,
        bio: bio.trim() ? bio : undefined,
        location: location.trim() ? location : undefined,
        // This slice keeps the enrichments the api holds; their editors land
        // with the next story, and the PUT travels complete.
        links: profile.links,
        skills: profile.skills,
      });
      if (!parsed.success) {
        const errors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const field = issue.path[0];
          if (typeof field === 'string') {
            errors[field] = issue.message;
          }
        }
        setFieldErrors(errors);
        return;
      }

      setSave({ status: 'saving', note: undefined });
      try {
        const saved = await updateProfile(accessToken, parsed.data, profile.updated_at);
        setProfile(saved);
        const refreshedSession = loadSession();
        if (refreshedSession) {
          void refreshedSession;
        }
        setSave({ status: 'saved' });
        return;
      } catch (error) {
        if (error instanceof ProblemError && error.problem.status === 412) {
          // The optimistic lock: reload the latest version and ask for a re-review.
          if (accessToken) {
            await loadProfile(accessToken);
          }
          setFormNote(
            'The profile changed since your last read; we loaded the latest version - review it and save again.',
          );
          setSave({ status: 'idle' });
          return;
        }
        if (error instanceof ProblemError && error.problem.fields) {
          setFieldErrors(error.problem.fields);
          setSave({ status: 'idle' });
          return;
        }
        if (error instanceof ProblemError) {
          setFormNote(
            profileReadMessage(error.problem.status, error.problem.detail ?? error.problem.title),
          );
        } else if (error instanceof DOMException && error.name === 'AbortError') {
          setFormNote('Request timed out. Please try again.');
        } else {
          setFormNote('The save could not be completed. Please try again.');
        }
        setSave({ status: 'idle' });
      }
    }
  }

  if (!isHydrated || !isAuthorized) {
    return (
      <main className="auth-page">
        <p className="auth-subtitle loading-state">Checking session…</p>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-shell auth-card" aria-label="Complete your profile">
        <header className="workspace-header">
          <div>
            <h1 className="auth-heading">Complete your profile</h1>
            <p className="auth-subtitle">
              Signed in as {session?.user.email} — one short pass and the workspace is yours.
            </p>
          </div>
          <button
            type="button"
            className="link"
            onClick={() => void signOut()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }}
          >
            Sign out
          </button>
        </header>

        <p className="auth-kicker">
          <span className="auth-kicker-icon">●</span>
          The api holds a placeholder profile until this is saved
        </p>

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

        {load.status === 'ready' && profile ? (
          <form
            className="setup-form"
            method="post"
            onSubmit={handleSubmit}
            noValidate
            aria-label="Profile fields"
          >
            <label className="field" htmlFor="setup-full-name">
              Full name
              <input
                id="setup-full-name"
                name="full_name"
                autoComplete="name"
                maxLength={200}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                aria-invalid={Boolean(fieldErrors.full_name)}
                aria-describedby={fieldErrors.full_name ? 'setup-full-name-error' : undefined}
              />
            </label>
            {fieldErrors.full_name ? (
              <p id="setup-full-name-error" role="alert" className="field-error">
                {fieldErrors.full_name}
              </p>
            ) : null}

            <label className="field" htmlFor="setup-headline">
              Headline
              <input
                id="setup-headline"
                name="headline"
                placeholder="Backend engineer · Rust and TypeScript"
                maxLength={120}
                value={headline}
                onChange={(event) => setHeadline(event.target.value)}
                aria-invalid={Boolean(fieldErrors.headline)}
                aria-describedby={fieldErrors.headline ? 'setup-headline-error' : undefined}
              />
            </label>
            {fieldErrors.headline ? (
              <p id="setup-headline-error" role="alert" className="field-error">
                {fieldErrors.headline}
              </p>
            ) : null}

            <label className="field" htmlFor="setup-bio">
              Bio
              <textarea
                id="setup-bio"
                name="bio"
                rows={4}
                maxLength={2000}
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                aria-invalid={Boolean(fieldErrors.bio)}
                aria-describedby={fieldErrors.bio ? 'setup-bio-error' : undefined}
              />
            </label>
            {fieldErrors.bio ? (
              <p id="setup-bio-error" role="alert" className="field-error">
                {fieldErrors.bio}
              </p>
            ) : null}

            <label className="field" htmlFor="setup-location">
              Location
              <input
                id="setup-location"
                name="location"
                autoComplete="address-level2"
                maxLength={120}
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                aria-invalid={Boolean(fieldErrors.location)}
                aria-describedby={fieldErrors.location ? 'setup-location-error' : undefined}
              />
            </label>
            {fieldErrors.location ? (
              <p id="setup-location-error" role="alert" className="field-error">
                {fieldErrors.location}
              </p>
            ) : null}

            {formNote ? (
              <div role="status" className="form-error">
                <p>{formNote}</p>
              </div>
            ) : null}

            {save.status === 'saved' ? (
              <div role="status" className="form-error">
                <p>Profile saved — it is live in the workspace.</p>
              </div>
            ) : null}

            <div className="landing-actions">
              <button
                type="submit"
                className="button button-primary"
                disabled={save.status === 'saving'}
              >
                {save.status === 'saving' ? 'Saving...' : 'Save profile'}
              </button>
              {save.status === 'saved' ? (
                <Link className="button button-ghost" href="/app/">
                  Open workspace
                </Link>
              ) : null}
            </div>
          </form>
        ) : null}
      </section>
    </main>
  );
}
