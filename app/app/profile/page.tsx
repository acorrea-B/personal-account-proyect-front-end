'use client';

import Link from 'next/link';
import { type SyntheticEvent, useCallback, useEffect, useState } from 'react';

import { ProblemError } from '@/lib/api/client';
import { searchCities } from '@/lib/api/geocoding';
import {
  fetchProfile,
  fullNameProblem,
  linkRowProblem,
  normalizeProfileLinkUrl,
  profileReadMessage,
  profileWriteFlow,
  updateProfile,
  type ProfileFlow,
} from '@/lib/api/profile';
import { signOut } from '@/lib/auth/session';
import { updateProfileRequestSchema, type Profile } from '@/lib/schemas/profile';
import { useRequireAuth } from '@/lib/auth/useRequireAuth';
import { AccountMenu } from '@/components/account-menu';
import { Skeleton } from '@/components/skeleton';
import { CheckIcon, HomeIcon, MailIcon, ProfileIcon, UserIcon } from '@/components/icons';

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
  // The in-flight marker: from the first keystroke the field shows the
  // searching action (the debounce plus the network ride behind it).
  const [isSearching, setIsSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  // The search belongs to the user's typing only: the value loaded from
  // the api (or a just-picked suggestion) must never open the list by
  // itself, on top of the field.
  const [isLocationTouched, setLocationTouched] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formNote, setFormNote] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>({ status: 'idle' });
  // The write flow: derived once from the profile the api returned at
  // load, then frozen. Both flows share PUT /v1/profile, but onboarding
  // replaces the placeholder while update keeps a live profile — their
  // background rules differ.
  const [flow, setFlow] = useState<ProfileFlow>('onboarding');
  // The save toast: pinned to the bottom of the viewport, so the
  // confirmation is visible wherever the user is in the form. It
  // auto-dismisses after 5 seconds and stays dismissible by hand.
  const [showToast, setShowToast] = useState(false);

  // The toast rides the viewport for 5 seconds; the button flashes Saved
  // for 3.5. Both timers clean up independently.
  useEffect(() => {
    if (!showToast) {
      return;
    }
    const timer = window.setTimeout(() => setShowToast(false), 5000);
    return () => window.clearTimeout(timer);
  }, [showToast]);

  // The button flashes Saved briefly; the viewport toast keeps the
  // confirmation visible meanwhile.
  useEffect(() => {
    if (save.status !== 'saved') {
      return;
    }
    const timer = window.setTimeout(() => setSave({ status: 'idle' }), 3500);
    return () => window.clearTimeout(timer);
  }, [save.status]);

  const populate = useCallback((from: Profile) => {
    setFullName(from.full_name === 'User' ? '' : from.full_name);
    setHeadline(from.headline ?? '');
    setBio(from.bio ?? '');
    setLocation(from.location ?? '');
    setSkillsText((from.skills ?? []).join(', '));
    setLinksDraft(from.links ?? []);
    // A fresh population is not typing: the autocomplete stays closed
    // until the user touches the field again.
    setLocationTouched(false);
  }, []);

  const loadProfile = useCallback(
    async (token: string) => {
      setLoad({ status: 'loading' });
      try {
        const fetched = await fetchProfile(token);
        setProfile(fetched);
        populate(fetched);
        setFlow(profileWriteFlow(fetched));
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

  // Real-time evaluation of every link row, exactly like the email field:
  // the row marks red while its condition is unmet.
  const rowProblems = linksDraft.map((row) => linkRowProblem(row));

  // The update flow marks the name field live too: a profile in
  // maintenance cannot quietly lose its name.
  const nameLiveProblem = flow === 'update' ? fullNameProblem(fullName, flow) : null;

  const skillsDraft = skillsText
    .split(',')
    .map((skill) => skill.trim())
    .filter(Boolean);

  // Debounced location autocomplete against the geocoding api: the field
  // ends with an exact place value, every failure degrades to silence, and
  // the spinner runs from the keystroke so the action is always visible.
  // Only the user's own edits trigger the search: the loaded value and a
  // picked suggestion never reopen the list over the field.
  useEffect(() => {
    const trimmed = location.trim();
    if (!isLocationTouched || trimmed.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsSearching(false);
      setSearched(false);
      return;
    }
    setIsSearching(true);
    const timer = window.setTimeout(async () => {
      const results = await searchCities(trimmed);
      setSuggestions(results.map((result) => result.label));
      setIsSearching(false);
      setSearched(true);
      setShowSuggestions(true);
    }, 350);
    return () => {
      window.clearTimeout(timer);
      setIsSearching(false);
    };
  }, [location, isLocationTouched]);

  function pickSuggestion(index: number) {
    setLocation(suggestions[index]);
    setShowSuggestions(false);
    setHighlight(-1);
    // Picking is not typing either: the exact value is set, the list
    // closes and no re-search fires over it.
    setLocationTouched(false);
  }

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormNote(null);
    setFieldErrors({});

    if (profile && accessToken) {
      // The flow's own name rule runs before the schema: the update flow
      // also blocks the placeholder (a 200 that reinstalls 'User' would
      // silently re-qualify the profile as incomplete and re-gate the
      // workspace).
      const nameProblem = fullNameProblem(fullName, flow);
      if (nameProblem) {
        setFieldErrors({ full_name: nameProblem });
        return;
      }
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
        setShowToast(true);
        setSave({ status: 'saved' });
        return;
      } catch (error) {
        if (error instanceof ProblemError && error.problem.status === 412) {
          // The optimistic lock: reload the latest version, drop the stale
          // toast, and ask for a re-review.
          setShowToast(false);
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

  const isUpdateFlow = flow === 'update';
  // The update flow is part of the dashboard: it opens inside the
  // dashboard shell, under the same identity bar and Account menu.
  const firstName = profile ? profile.full_name.trim().split(/\s+/)[0] : '';

  if (!isHydrated || !isAuthorized) {
    return (
      <main className="auth-page" aria-busy="true">
        <section className="auth-shell auth-card" aria-label="Loading your profile">
          <ProfileCardSkeleton />
        </section>
      </main>
    );
  }

  return (
    <main className={isUpdateFlow ? 'workspace-page' : 'auth-page'}>
      {load.status === 'ready' && profile && isUpdateFlow ? (
        <header className="workspace-bar content-resolve">
          <div className="workspace-identity">
            <p className="eyebrow">Your workspace</p>
            <p className="workspace-title">
              {firstName ? `Hello, ${firstName}.` : 'Your workspace'}
            </p>
            <p className="auth-subtitle">Signed in as {session?.user.email}</p>
          </div>
          <div className="workspace-actions">
            <Link className="workspace-home" href="/app/" aria-label="Back to the workspace">
              <HomeIcon />
            </Link>
            <AccountMenu />
          </div>
        </header>
      ) : null}
      <section
        className="auth-shell auth-card"
        aria-label={
          load.status === 'ready' && profile
            ? flow === 'onboarding'
              ? 'Complete your profile'
              : 'Update profile'
            : 'Loading your profile'
        }
      >
        {load.status === 'loading' ? <ProfileCardSkeleton /> : null}
        {load.status === 'ready' && profile ? (
          <div className="content-resolve">
            {flow === 'onboarding' ? (
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
            ) : (
              <h1 className="auth-heading">Update profile</h1>
            )}

            {flow === 'onboarding' ? (
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
            ) : null}

            {showToast ? (
              <div role="status" className="save-toast">
                <CheckIcon />
                <p>
                  {flow === 'onboarding'
                    ? 'Profile saved — it is live in the workspace.'
                    : 'Profile updated — saved exactly as edited.'}
                </p>
                <button
                  type="button"
                  className="save-toast-dismiss"
                  aria-label="Dismiss the saved confirmation"
                  onClick={() => setShowToast(false)}
                >
                  ✕
                </button>
              </div>
            ) : null}

            {flow === 'onboarding' ? (
              <p className="auth-kicker">
                <span className="auth-kicker-icon">●</span>
                The api holds a placeholder profile until this is saved
              </p>
            ) : null}
          </div>
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
          <div className="content-resolve">
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
                  aria-invalid={Boolean(fieldErrors.full_name || nameLiveProblem)}
                  aria-describedby={
                    fieldErrors.full_name || nameLiveProblem ? 'setup-full-name-error' : undefined
                  }
                />
              </label>
              {fieldErrors.full_name || nameLiveProblem ? (
                <p id="setup-full-name-error" role="alert" className="field-error">
                  {fieldErrors.full_name ?? nameLiveProblem}
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
                  <div className="location-input-wrap">
                    <input
                      id="setup-location"
                      name="location"
                      role="combobox"
                      autoComplete="off"
                      aria-busy={isSearching}
                      aria-expanded={showSuggestions && suggestions.length > 0}
                      aria-controls="setup-location-suggestions"
                      aria-autocomplete="list"
                      maxLength={120}
                      value={location}
                      onChange={(event) => {
                        setLocation(event.target.value);
                        setLocationTouched(true);
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
                    {isSearching ? <span className="spinner" aria-hidden="true" /> : null}
                  </div>
                </label>
                {isSearching || (searched && !suggestions.length) ? (
                  <p role="status" className="autocomplete-status">
                    {isSearching ? 'Searching places…' : 'No places found; keep typing the name.'}
                  </p>
                ) : null}
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
                  <div key={index} className="link-row-group">
                    <div className="link-row">
                      <input
                        id={`link-type-${index}`}
                        name={`link-type-${index}`}
                        list="link-types"
                        placeholder="github"
                        maxLength={40}
                        value={row.type}
                        aria-label={`Link ${index + 1} type`}
                        aria-invalid={Boolean(rowProblems[index])}
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
                        aria-invalid={Boolean(rowProblems[index])}
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
                    {rowProblems[index] ? (
                      <p role="alert" className="field-error">
                        {rowProblems[index]}
                      </p>
                    ) : null}
                  </div>
                ))}
                {linksDraft.length < 10 ? (
                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={() =>
                      setLinksDraft((previous) => [...previous, { type: '', url: '' }])
                    }
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

              <div className="landing-actions">
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={save.status === 'saving' || save.status === 'saved'}
                >
                  {save.status === 'saving' ? (
                    <>
                      <span className="spinner" aria-hidden="true" /> Saving…
                    </>
                  ) : save.status === 'saved' ? (
                    '✓ Saved'
                  ) : flow === 'onboarding' ? (
                    'Save profile'
                  ) : (
                    'Save changes'
                  )}
                </button>
                {flow === 'onboarding' ? (
                  showToast ? (
                    <Link className="button button-ghost" href="/app/">
                      Open workspace
                    </Link>
                  ) : null
                ) : (
                  // The persistent way back: never tied to the toast's
                  // five seconds, so the exit does not vanish with it.
                  <Link className="button button-ghost" href="/app/">
                    <HomeIcon /> Back to workspace
                  </Link>
                )}
              </div>
            </form>
          </div>
        ) : null}
      </section>
    </main>
  );
}

// The profile card skeleton: heading, description and field rows as soft
// blocks in the same geometry as the ready state — the flow's face
// (heading, stepper, kicker) stays hidden until the profile arrives, so
// no flow is announced before its data exists.
function ProfileCardSkeleton() {
  return (
    <div className="skeleton-screen">
      <Skeleton width={190} height={28} />
      <Skeleton width={280} height={14} />
      <Skeleton width="100%" height={52} />
      <Skeleton width="100%" height={52} />
      <Skeleton width="100%" height={84} />
      <Skeleton width="100%" height={52} />
      <Skeleton width="100%" height={52} />
      <Skeleton width={140} height={40} />
    </div>
  );
}
