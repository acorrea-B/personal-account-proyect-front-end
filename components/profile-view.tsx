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
  profileWriteFlow,
  updateProfile,
  type ProfileFlow,
  type NameProblems,
  type LinkRowProblems,
} from '@/lib/api/profile';
import { signOut } from '@/lib/auth/session';
import { updateProfileRequestSchema, type Profile } from '@/lib/schemas/profile';
import { type Locale, labels, tr } from '@/lib/i18n';
import { useRequireAuth } from '@/lib/auth/useRequireAuth';
import { AccountMenu } from '@/components/account-menu';
import { Skeleton } from '@/components/skeleton';
import { CheckIcon, HomeIcon, MailIcon, ProfileIcon, UserIcon } from '@/components/icons';

type SaveState = { status: 'idle' | 'saving' | 'saved'; note?: string };
type LoadState = { status: 'loading' | 'ready' | 'error'; profile?: Profile; error?: string };
type LinkDraft = { type: string; url: string };

// The shared profile editor: one implementation serves both locale trees
// with every string from the json dictionaries and the routes hanging from
// the tree's base prefix. The api holds the two write flows: onboarding
// (the placeholder profile owns the setup) and update (maintenance inside
// the dashboard shell). The editor's own rules (name, link rows) speak the
// tree language through the dictionary; the api problem details keep the
// contract's english voice.
export function ProfileView({ locale }: { locale: Locale }) {
  const t = labels(locale);
  const base = locale === 'es' ? '/es' : '';
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
          setLoad({ status: 'error', error: t.workspace.serviceDeclined });
          return;
        }
        if (error instanceof ProblemError) {
          if (error.problem.status === 429) {
            setLoad({ status: 'error', error: t.workspace.profileRateCapped });
            return;
          }
          if (error.problem.status >= 500) {
            setLoad({
              status: 'error',
              error:
                error.problem.status === 503
                  ? t.workspace.profileWarming
                  : t.workspace.profileUnreachable,
            });
            return;
          }
          setLoad({
            status: 'error',
            error: `${error.problem.detail ?? error.problem.title ?? ''}${t.workspace.detailSuffix}`,
          });
          return;
        }
        setLoad({ status: 'error', error: t.workspace.profileUnknown });
      }
    },
    [populate, t.workspace],
  );

  useEffect(() => {
    if (isHydrated && isAuthorized && accessToken) {
      loadProfile(accessToken);
    }
  }, [isHydrated, isAuthorized, accessToken, loadProfile]);

  // Real-time evaluation of every link row, exactly like the email field:
  // the row marks red while its condition is unmet.
  const linkRowProblems: LinkRowProblems = {
    linkNeedsUrl: t.profile.linkNeedsUrl,
    linkNeedsType: t.profile.linkNeedsType,
    linkNeedsScheme: t.profile.linkNeedsScheme,
  };
  const rowProblems = linksDraft.map((row) => linkRowProblem(row, linkRowProblems));

  const nameProblems: NameProblems = {
    nameRequired: t.profile.nameRequired,
    nameRequiredUpdate: t.profile.nameRequiredUpdate,
    namePlaceholderConflict: t.profile.namePlaceholderConflict,
  };

  // The update flow marks the name field live too: a profile in
  // maintenance cannot quietly lose its name.
  const nameLiveProblem = flow === 'update' ? fullNameProblem(fullName, flow, nameProblems) : null;

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
      try {
        const results = await searchCities(trimmed);
        setSuggestions(results.map((result) => result.label));
      } catch {
        setSuggestions([]);
      }
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
      const nameProblem = fullNameProblem(fullName, flow, nameProblems);
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
          setFormNote(t.profile.conflictNote);
          setSave({ status: 'idle' });
          return;
        }
        if (error instanceof ProblemError && error.problem.fields) {
          setFieldErrors(error.problem.fields);
          setSave({ status: 'idle' });
          return;
        }
        if (error instanceof ProblemError) {
          if (error.problem.status === 429) {
            setFormNote(t.workspace.profileRateCapped);
          } else {
            setFormNote(
              `${error.problem.detail ?? error.problem.title ?? ''}${t.workspace.detailSuffix}`,
            );
          }
        } else if (error instanceof DOMException && error.name === 'AbortError') {
          setFormNote(t.workspace.cvTimeout);
        } else {
          setFormNote(t.cvEditor.saveFallback);
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
        <section className="auth-shell auth-card" aria-label={t.profile.loadingAria}>
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
            <p className="eyebrow">{t.workspace.eyebrow}</p>
            <p className="workspace-title">
              {firstName ? tr(t.workspace.greeting, { name: firstName }) : t.workspace.title}
            </p>
            <p className="auth-subtitle">
              {tr(t.workspace.signedInAs, { email: session?.user.email ?? '' })}
            </p>
          </div>
          <div className="workspace-actions">
            <Link className="workspace-home" href={`${base}/app/`} aria-label={t.profile.homeAria}>
              <HomeIcon />
            </Link>
            <AccountMenu locale={locale} />
          </div>
        </header>
      ) : null}
      <section
        className="auth-shell auth-card"
        aria-label={
          load.status === 'ready' && profile
            ? isUpdateFlow
              ? t.profile.updateAria
              : t.profile.onboardingAria
            : t.profile.loadingAria
        }
      >
        {load.status === 'loading' ? <ProfileCardSkeleton /> : null}
        {load.status === 'ready' && profile ? (
          <div className="content-resolve">
            {isUpdateFlow ? null : (
              <header className="workspace-header">
                <div>
                  <h1 className="auth-heading">{t.profile.onboardingHeading}</h1>
                  <p className="auth-subtitle">
                    {tr(t.profile.onboardingSubtitle, { email: session?.user.email ?? '' })}
                  </p>
                </div>
                <button
                  type="button"
                  className="link"
                  onClick={() => void signOut()}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }}
                >
                  {t.signOut}
                </button>
              </header>
            )}
            {isUpdateFlow ? <h1 className="auth-heading">{t.profile.updateHeading}</h1> : null}

            {isUpdateFlow ? null : (
              <ol className="auth-steps" aria-label={t.profile.phasesAria}>
                <li className="auth-step">
                  <UserIcon className="auth-step-icon" /> {t.register.stepAccount}
                </li>
                <li className="auth-step">
                  <MailIcon className="auth-step-icon" /> {t.register.stepVerify}
                </li>
                <li className="auth-step is-active">
                  <ProfileIcon className="auth-step-icon" /> {t.register.stepProfile}
                </li>
              </ol>
            )}

            {showToast ? (
              <div role="status" className="save-toast">
                <CheckIcon />
                <p>{isUpdateFlow ? t.profile.toastUpdate : t.profile.toastOnboarding}</p>
                <button
                  type="button"
                  className="save-toast-dismiss"
                  aria-label={t.versionDetail.dismiss}
                  onClick={() => setShowToast(false)}
                >
                  ✕
                </button>
              </div>
            ) : null}

            {isUpdateFlow ? null : (
              <p className="auth-kicker">
                <span className="auth-kicker-icon">●</span>
                {t.profile.onboardingKicker}
              </p>
            )}
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
              {t.cvCard.retry}
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
              aria-label={t.profile.fieldsAria}
            >
              <label className="field" htmlFor="setup-full-name">
                {t.panel.fullName}
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
                {t.panel.headline}
                <input
                  id="setup-headline"
                  name="headline"
                  placeholder={t.profile.headlinePlaceholder}
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
                {t.panel.bio}
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
                {tr(t.profile.bioCounter, { current: String(bio.length), max: '2000' })}
              </p>

              <div className="location-field">
                <label className="field" htmlFor="setup-location">
                  {t.panel.location}
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
                    {isSearching ? t.profile.searchingPlaces : t.profile.noPlaces}
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
                {t.panel.skills}
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
                {t.profile.skillsNote}
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
                  {t.profile.linksKicker}
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
                        placeholder={t.profile.linkTypePlaceholder}
                        maxLength={40}
                        value={row.type}
                        aria-label={tr(t.profile.linkTypeAria, { index: String(index + 1) })}
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
                        placeholder={t.profile.linkUrlPlaceholder}
                        maxLength={2048}
                        value={row.url}
                        aria-label={tr(t.profile.linkUrlAria, { index: String(index + 1) })}
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
                        aria-label={tr(t.profile.removeLinkAria, { index: String(index + 1) })}
                        onClick={() =>
                          setLinksDraft((previous) =>
                            previous.filter((_, itemIndex) => itemIndex !== index),
                          )
                        }
                      >
                        {t.profile.removeLink}
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
                    {t.profile.addLink}
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
                      <span className="spinner" aria-hidden="true" /> {t.cvEditor.saving}
                    </>
                  ) : save.status === 'saved' ? (
                    t.profile.savedCheck
                  ) : isUpdateFlow ? (
                    t.profile.updateCta
                  ) : (
                    t.profile.onboardingCta
                  )}
                </button>
                {isUpdateFlow ? null : showToast ? (
                  <Link className="button button-ghost" href={`${base}/app/`}>
                    {t.profile.openWorkspace}
                  </Link>
                ) : null}
                {isUpdateFlow ? (
                  // The persistent way back: never tied to the toast's
                  // five seconds, so the exit does not vanish with it.
                  <Link className="button button-ghost" href={`${base}/app/`}>
                    <HomeIcon /> {t.cvEditor.back}
                  </Link>
                ) : null}
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
