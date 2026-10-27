'use client';

import Link from 'next/link';
import { type SyntheticEvent, useCallback, useEffect, useState } from 'react';

import { ProblemError } from '@/lib/api/client';
import { searchCities } from '@/lib/api/geocoding';
import {
  fetchProfile,
  normalizeProfileLinkUrl,
  profileReadMessage,
  updateProfile,
} from '@/lib/api/profile';
import { loadSession, signOut } from '@/lib/auth/session';
import { updateProfileRequestSchema, type Profile } from '@/lib/schemas/profile';
import { useRequireAuth } from '@/lib/auth/useRequireAuth';
import { MailIcon, ProfileIcon, UserIcon } from '@/components/icons';

type SaveState = { status: 'idle' | 'saving' | 'saved'; note?: string };
type LoadState = { status: 'loading' | 'ready' | 'error'; profile?: Profile; error?: string };
type LinkDraft = { type: string; url: string };

export default function ProfileSetupPage() {
  const { isHydrated, isAuthorized, session } = useRequireAuth();
  const accessToken = session?.accessToken ?? null;

  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [skillsText, setSkillsText] = useState('');
  const [linksDraft, setLinksDraft] = useState<LinkDraft[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [highlight, setHighlight] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formNote, setFormNote] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>({ status: 'idle' });

  const populate = useCallback((from: Profile) => {
    setFullName(from.full_name === 'User' ? '' : from.full_name);
    setHeadline(from.headline ?? '');
    setBio(from.bio ?? '');
    setLocation(from.location ?? '');
    setSkillsText((from.skills ?? []).join(', '));
    setLinksDraft(from.links ?? []);
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

  const skillsDraft = skillsText
    .split(',')
    .map((skill) => skill.trim())
    .filter(Boolean);

  // Debounced location autocomplete against the geocoding api: the field
  // ends with an exact place value, and every failure degrades to silence.
  useEffect(() => {
    const trimmed = location.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      const results = await searchCities(trimmed);
      setSuggestions(results.map((result) => result.label));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [location]);

  function pickSuggestion(index: number) {
    setLocation(suggestions[index]);
    setShowSuggestions(false);
    setHighlight(-1);
  }

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormNote(null);
    setFieldErrors({});

    if (profile && accessToken) {
      const normalizedBio = bio.replace(/\r\n?/g, '\n');
      // The links editor owns the list: rows left completely empty are
      // discarded, and an empty list empties it server-side (complete PUT).
      const cleanLinks = linksDraft
        .map((row) => ({
          type: row.type.trim(),
          url: normalizeProfileLinkUrl(row.url.trim()),
        }))
        .filter((row) => row.type || row.url);
      const parsed = updateProfileRequestSchema.safeParse({
        full_name: fullName,
        headline: headline.trim() ? headline : undefined,
        bio: normalizedBio.trim() ? normalizedBio : undefined,
        location: location.trim() ? location : undefined,
        // The editor owns the full skills list now: commas recover the
        // multiple values, and an empty list empties it server-side.
        skills: skillsDraft.length ? skillsDraft : undefined,
        links: cleanLinks.length ? cleanLinks : undefined,
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

        <ol className="auth-steps" aria-label="Registration phases">
          <li className="auth-step">
            <UserIcon className="auth-step-icon" /> Account
          </li>
          <li className="auth-step">
            <MailIcon className="auth-step-icon" /> Verify
          </li>
          <li className="auth-step is-active">
            <ProfileIcon className="auth-step-icon" /> Profile
          </li>
        </ol>

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
                onChange={(event) => {
                  // Newlines normalize on the way out; the limit is the
                  // api contract (2000).
                  setBio(event.target.value.replace(/\r\n?/g, '\n').slice(0, 2000));
                }}
                aria-invalid={Boolean(fieldErrors.bio)}
                aria-describedby={fieldErrors.bio ? 'setup-bio-error' : undefined}
              />
            </label>
            {fieldErrors.bio ? (
              <p id="setup-bio-error" role="alert" className="field-error">
                {fieldErrors.bio}
              </p>
            ) : null}
            <p className="char-counter" aria-hidden="true">
              {bio.length} / 2000
            </p>

            <div className="location-field">
              <label className="field" htmlFor="setup-location">
                Location
                <input
                  id="setup-location"
                  name="location"
                  role="combobox"
                  autoComplete="off"
                  aria-expanded={showSuggestions && suggestions.length > 0}
                  aria-controls="setup-location-suggestions"
                  aria-autocomplete="list"
                  maxLength={120}
                  value={location}
                  onChange={(event) => {
                    setLocation(event.target.value);
                    setShowSuggestions(true);
                    setHighlight(-1);
                  }}
                  onKeyDown={(event) => {
                    if (!suggestions.length) {
                      return;
                    }
                    if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      setHighlight((previous) => (previous + 1) % suggestions.length);
                    } else if (event.key === 'ArrowUp') {
                      event.preventDefault();
                      setHighlight((previous) =>
                        previous <= 0 ? suggestions.length - 1 : previous - 1,
                      );
                    } else if (event.key === 'Enter' && highlight >= 0) {
                      event.preventDefault();
                      pickSuggestion(highlight);
                    } else if (event.key === 'Escape') {
                      setShowSuggestions(false);
                    }
                  }}
                  onBlur={() => {
                    window.setTimeout(() => setShowSuggestions(false), 150);
                  }}
                  aria-invalid={Boolean(fieldErrors.location)}
                  aria-describedby={fieldErrors.location ? 'setup-location-error' : undefined}
                />
              </label>
              {showSuggestions && suggestions.length ? (
                <ul id="setup-location-suggestions" className="suggestions" role="listbox">
                  {suggestions.map((suggestion, index) => (
                    <li
                      key={`${suggestion}#${index}`}
                      role="option"
                      aria-selected={index === highlight}
                    >
                      <button
                        type="button"
                        className={index === highlight ? 'is-highlight' : undefined}
                        onMouseDown={() => pickSuggestion(index)}
                        onMouseEnter={() => setHighlight(index)}
                      >
                        {suggestion}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {fieldErrors.location ? (
              <p id="setup-location-error" role="alert" className="field-error">
                {fieldErrors.location}
              </p>
            ) : null}

            <label className="field" htmlFor="setup-skills">
              Skills
              <input
                id="setup-skills"
                name="skills"
                placeholder="rust, typescript, sql"
                value={skillsText}
                onChange={(event) => setSkillsText(event.target.value)}
                aria-invalid={Boolean(fieldErrors.skills)}
                aria-describedby={fieldErrors.skills ? 'setup-skills-error' : undefined}
              />
            </label>
            <p className="auth-form-note" aria-hidden="true">
              Separated by commas, at most 30 · recovered as multiple values
            </p>
            {skillsDraft.length ? (
              <ul className="skill-chips" aria-hidden="true">
                {skillsDraft.map((skill) => (
                  <li key={skill.toLowerCase()}>{skill}</li>
                ))}
              </ul>
            ) : null}
            {fieldErrors.skills ? (
              <p id="setup-skills-error" role="alert" className="field-error">
                {fieldErrors.skills}
              </p>
            ) : null}

            <div className="link-editor">
              <p className="auth-kicker">
                <span className="auth-kicker-icon">●</span>
                Social and repository links
              </p>
              <datalist id="link-types">
                <option value="github" />
                <option value="linkedin" />
                <option value="x" />
                <option value="website" />
                <option value="blog" />
              </datalist>
              {linksDraft.map((row, index) => (
                <div key={index} className="link-row">
                  <input
                    id={`link-type-${index}`}
                    name={`link-type-${index}`}
                    list="link-types"
                    placeholder="github"
                    maxLength={40}
                    value={row.type}
                    aria-label={`Link ${index + 1} type`}
                    onChange={(event) =>
                      setLinksDraft((previous) =>
                        previous.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, type: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <input
                    id={`link-url-${index}`}
                    name={`link-url-${index}`}
                    type="url"
                    inputMode="url"
                    placeholder="https://github.com/you"
                    maxLength={2048}
                    value={row.url}
                    aria-label={`Link ${index + 1} url`}
                    onBlur={() =>
                      setLinksDraft((previous) =>
                        previous.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                url: normalizeProfileLinkUrl(item.url),
                              }
                            : item,
                        ),
                      )
                    }
                    onChange={(event) =>
                      setLinksDraft((previous) =>
                        previous.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, url: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="link"
                    aria-label={`Remove link ${index + 1}`}
                    onClick={() =>
                      setLinksDraft((previous) =>
                        previous.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
              {linksDraft.length < 10 ? (
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => setLinksDraft((previous) => [...previous, { type: '', url: '' }])}
                >
                  Add link
                </button>
              ) : null}
              {fieldErrors.links ? (
                <p id="setup-links-error" role="alert" className="field-error">
                  {fieldErrors.links}
                </p>
              ) : null}
            </div>

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
