'use client';

import Link from 'next/link';
import {
  type ReactNode,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

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
import { type Labels, type Locale, labels, tr } from '@/lib/i18n';
import { useRequireAuth } from '@/lib/auth/useRequireAuth';
import { AccountMenu } from '@/components/account-menu';
import { AppShell } from '@/components/app-shell';
import { CatalogConsent } from '@/components/catalog-consent';
import { SkillCatalogInput } from '@/components/skill-catalog-input';
import { SkillSuggestionsCard } from '@/components/skill-suggestions-card';
import {
  AuthCard,
  AuthForm,
  AuthFormNote,
  AuthHeading,
  AuthKicker,
  AuthPage,
  AuthSteps,
  AuthSubtitle,
  Eyebrow,
  Field,
  FieldError,
  FormMessage,
  SaveToast,
  SkillChips,
  Spinner,
  WorkspaceBar,
  WorkspaceTitle,
  cx,
  contentResolve,
  ghostButton,
  inputClass,
  primaryButton,
  workspacePanel,
} from '@/components/ui';
import { Skeleton } from '@/components/skeleton';
import { CheckIcon, HomeIcon, MailIcon, ProfileIcon, UserIcon } from '@/components/icons';

type SaveState = { status: 'idle' | 'saving' | 'saved'; note?: string };
type LoadState = { status: 'loading' | 'ready' | 'error'; profile?: Profile; error?: string };
type LinkDraft = { type: string; url: string };

// The schema decides which profile field fails and why; the dictionary
// says it in the tree language (never zod's english default).
function validationMessage(
  field: string,
  issue: { code: string; path: PropertyKey[] },
  v: Labels['validation'],
): string {
  switch (field) {
    case 'full_name':
      return v.fullNameTooLong;
    case 'headline':
      return v.headlineTooLong;
    case 'bio':
      return v.bioTooLong;
    case 'location':
      return v.locationTooLong;
    case 'links':
      return v.linksInvalid;
    case 'skills':
      // An item over 40 characters fails at skills[i]; the list itself
      // fails on the 100 cap or on a repeated name.
      return issue.path.length > 1
        ? v.skillTooLong
        : issue.code === 'too_big'
          ? v.skillsTooMany
          : v.skillsRepeat;
    default:
      return v.fieldInvalid;
  }
}

// A link-row input (the old .link-row input rule): the compact 14px field.
const linkInput =
  'rounded-inputs border border-stone-border bg-pure-white px-12 py-[10px] [font-family:inherit] text-[14px] [font-weight:inherit] [line-height:inherit] text-ink-black aria-invalid:border-alert focus-visible:border-cyan-text! focus-visible:shadow-[0_0_0_3px_var(--color-sky-wash)] focus-visible:outline-none';

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
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;

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

  // A suggestion accepted beside the form: the server added the skill, so
  // the form gains it without losing what the user is typing. The save
  // waits while a decision syncs (`syncing`). The profile's version only
  // moves forward when the server copy differs from the loaded one by the
  // skills alone; a remote edit of any other field keeps the old version,
  // so the next save meets the optimistic lock instead of overwriting it.
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);
  const holdSave = useCallback((busy: boolean) => {
    syncingRef.current = busy;
    setSyncing(busy);
  }, []);
  const profileRef = useRef<Profile | null>(null);
  profileRef.current = profile;
  const acceptSuggestion = useCallback(async (skill: string) => {
    setSkillsText((current) => withSkill(current, skill));
    const token = tokenRef.current;
    if (!token) {
      return;
    }
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const fresh = await fetchProfile(token);
        const known = profileRef.current;
        if (known && sameBesidesSkills(known, fresh)) {
          setProfile(fresh);
        }
        return;
      } catch {
        // one more try; then the known version stays and a save meets the
        // optimistic lock
      }
    }
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

  // Loads once per visit: the session renews the access token in the
  // background, and reloading on it would repopulate the form under the
  // user's typing.
  const loaded = useRef(false);
  useEffect(() => {
    if (isHydrated && isAuthorized && accessToken && !loaded.current) {
      loaded.current = true;
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
    if (syncingRef.current) {
      return;
    }
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
          if (typeof field === 'string' && !errors[field]) {
            errors[field] = validationMessage(field, issue, t.validation);
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
      <AuthPage busy>
        <AuthCard label={t.profile.loadingAria}>
          <ProfileCardSkeleton />
        </AuthCard>
      </AuthPage>
    );
  }

  // The update flow opens inside the workspace frame (menu and the way
  // home), onboarding on the centered auth page.
  const content = (
    <>
      {load.status === 'ready' && profile && isUpdateFlow ? (
        <div className={contentResolve}>
          <WorkspaceBar
            identity={
              <>
                <Eyebrow>{t.workspace.eyebrow}</Eyebrow>
                <WorkspaceTitle as="p">
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
        </div>
      ) : null}
      <ProfileColumns
        aside={
          isUpdateFlow && load.status === 'ready' && accessToken ? (
            <aside className={workspacePanel} aria-label={t.suggestions.title}>
              <ul className="m-0 grid list-none p-0">
                <SkillSuggestionsCard
                  accessToken={accessToken}
                  locale={locale}
                  onAccepted={acceptSuggestion}
                  onBusyChange={holdSave}
                />
              </ul>
            </aside>
          ) : null
        }
      >
        <AuthCard
          wide={isUpdateFlow}
          label={
            load.status === 'ready' && profile
              ? isUpdateFlow
                ? t.profile.updateAria
                : t.profile.onboardingAria
              : t.profile.loadingAria
          }
        >
          {load.status === 'loading' ? <ProfileCardSkeleton /> : null}
          {load.status === 'ready' && profile ? (
            <div className={contentResolve}>
              {isUpdateFlow ? null : (
                <header className="flex items-start justify-between gap-16">
                  <div>
                    <AuthHeading>{t.profile.onboardingHeading}</AuthHeading>
                    <AuthSubtitle>
                      {tr(t.profile.onboardingSubtitle, { email: session?.user.email ?? '' })}
                    </AuthSubtitle>
                  </div>
                  <button
                    type="button"
                    className="cursor-pointer border-none bg-transparent [font:inherit] text-cyan-text no-underline hover:text-cyan-text-strong hover:underline"
                    onClick={() => void signOut()}
                  >
                    {t.signOut}
                  </button>
                </header>
              )}
              {isUpdateFlow ? <AuthHeading>{t.profile.updateHeading}</AuthHeading> : null}

              {isUpdateFlow ? null : (
                <AuthSteps
                  label={t.profile.phasesAria}
                  steps={[
                    { icon: UserIcon, label: t.register.stepAccount },
                    { icon: MailIcon, label: t.register.stepVerify },
                    { icon: ProfileIcon, label: t.register.stepProfile, active: true },
                  ]}
                />
              )}

              {showToast ? (
                <SaveToast
                  icon={CheckIcon}
                  dismissLabel={t.versionDetail.dismiss}
                  onDismiss={() => setShowToast(false)}
                >
                  {isUpdateFlow ? t.profile.toastUpdate : t.profile.toastOnboarding}
                </SaveToast>
              ) : null}

              {isUpdateFlow ? null : <AuthKicker>{t.profile.onboardingKicker}</AuthKicker>}
            </div>
          ) : null}

          {load.status === 'error' ? (
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
          ) : null}

          {load.status === 'ready' && profile ? (
            <div className={contentResolve}>
              <AuthForm
                method="post"
                onSubmit={handleSubmit}
                noValidate
                aria-label={t.profile.fieldsAria}
              >
                <Field
                  label={t.panel.fullName}
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
                {fieldErrors.full_name || nameLiveProblem ? (
                  <FieldError id="setup-full-name-error">
                    {fieldErrors.full_name ?? nameLiveProblem}
                  </FieldError>
                ) : null}

                <Field
                  label={t.panel.headline}
                  id="setup-headline"
                  name="headline"
                  placeholder={t.profile.headlinePlaceholder}
                  maxLength={120}
                  value={headline}
                  onChange={(event) => setHeadline(event.target.value)}
                  aria-invalid={Boolean(fieldErrors.headline)}
                  aria-describedby={fieldErrors.headline ? 'setup-headline-error' : undefined}
                />
                {fieldErrors.headline ? (
                  <FieldError id="setup-headline-error">{fieldErrors.headline}</FieldError>
                ) : null}

                <label className="grid gap-4" htmlFor="setup-bio">
                  {t.panel.bio}
                  <textarea
                    className="min-h-[96px] max-w-full resize-y aria-invalid:border-alert focus-visible:border-cyan-text! focus-visible:shadow-[0_0_0_3px_var(--color-sky-wash)] focus-visible:outline-none"
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
                  <FieldError id="setup-bio-error">{fieldErrors.bio}</FieldError>
                ) : null}
                <p
                  className="m-0 text-right text-(length:--text-label) text-warm-gray"
                  aria-hidden="true"
                >
                  {tr(t.profile.bioCounter, { current: String(bio.length), max: '2000' })}
                </p>

                <div
                  className="relative grid gap-4"
                  // The list closes only when focus leaves the whole field.
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      setShowSuggestions(false);
                    }
                  }}
                >
                  <label className="grid gap-4" htmlFor="setup-location">
                    {t.panel.location}
                    <div className="relative grid">
                      <input
                        className={cx(inputClass, 'pr-[34px]')}
                        id="setup-location"
                        name="location"
                        role="combobox"
                        autoComplete="off"
                        aria-busy={isSearching}
                        aria-expanded={showSuggestions && suggestions.length > 0}
                        aria-controls="setup-location-suggestions"
                        aria-autocomplete="list"
                        aria-activedescendant={
                          showSuggestions && suggestions.length > 0 && highlight >= 0
                            ? `setup-location-option-${highlight}`
                            : undefined
                        }
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
                        aria-invalid={Boolean(fieldErrors.location)}
                        aria-describedby={fieldErrors.location ? 'setup-location-error' : undefined}
                      />
                      {isSearching ? (
                        <Spinner className="absolute top-1/2 right-[10px] -mt-[7px]" />
                      ) : null}
                    </div>
                  </label>
                  {isSearching || (searched && !suggestions.length) ? (
                    <p role="status" className="m-0 text-(length:--text-label) text-warm-gray">
                      {isSearching ? t.profile.searchingPlaces : t.profile.noPlaces}
                    </p>
                  ) : null}
                  {showSuggestions && suggestions.length ? (
                    <ul
                      id="setup-location-suggestions"
                      className="absolute right-0 left-0 z-10 m-0 list-none rounded-lg border border-stone-border bg-pure-white p-4 shadow-sm"
                      role="listbox"
                    >
                      {suggestions.map((suggestion, index) => (
                        <li
                          key={`${suggestion}#${index}`}
                          id={`setup-location-option-${index}`}
                          role="option"
                          aria-selected={index === highlight}
                        >
                          <button
                            type="button"
                            className={cx(
                              'flex min-h-[44px] w-full cursor-pointer items-center rounded-md border-none px-[14px] py-12 text-left [font-family:inherit] text-[15px] [font-weight:inherit] [line-height:inherit] text-ink-black hover:bg-sky-wash',
                              // One background at a time: the keyboard highlight must win.
                              index === highlight ? 'bg-sky-wash' : 'bg-transparent',
                            )}
                            // Same combobox rules as the skills catalog: options stay
                            // out of the tab order, mousedown only keeps the focus
                            // in the field and the pick runs on click (keyboard and
                            // assistive activation included).
                            tabIndex={-1}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => pickSuggestion(index)}
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
                  <FieldError id="setup-location-error">{fieldErrors.location}</FieldError>
                ) : null}

                <label className="grid gap-4" htmlFor="setup-skills">
                  {t.panel.skills}
                  {accessToken ? (
                    <SkillCatalogInput
                      id="setup-skills"
                      name="skills"
                      placeholder="rust, typescript, sql"
                      value={skillsText}
                      onValueChange={setSkillsText}
                      accessToken={accessToken}
                      locale={locale}
                      aria-invalid={Boolean(fieldErrors.skills)}
                      aria-describedby={fieldErrors.skills ? 'setup-skills-error' : undefined}
                    />
                  ) : null}
                </label>
                <AuthFormNote hidden>{t.profile.skillsNote}</AuthFormNote>
                {skillsDraft.length ? <SkillChips skills={skillsDraft} /> : null}
                {fieldErrors.skills ? (
                  <FieldError id="setup-skills-error">{fieldErrors.skills}</FieldError>
                ) : null}
                {accessToken ? <CatalogConsent accessToken={accessToken} locale={locale} /> : null}

                <div className="grid gap-8">
                  <AuthKicker>{t.profile.linksKicker}</AuthKicker>
                  <datalist id="link-types">
                    <option value="github" />
                    <option value="linkedin" />
                    <option value="x" />
                    <option value="website" />
                    <option value="blog" />
                  </datalist>
                  {linksDraft.map((row, index) => (
                    <div key={index} className="grid gap-4">
                      <div className="grid grid-cols-[minmax(120px,200px)_minmax(0,1fr)_auto] items-center gap-8 max-sm:grid-cols-1">
                        <input
                          className={linkInput}
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
                          className={linkInput}
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
                          className="text-cyan-text no-underline hover:text-cyan-text-strong hover:underline"
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
                        <p role="alert" className="text-[12px] leading-[1.5] text-alert">
                          {rowProblems[index]}
                        </p>
                      ) : null}
                    </div>
                  ))}
                  {linksDraft.length < 10 ? (
                    <button
                      type="button"
                      className={ghostButton}
                      onClick={() =>
                        setLinksDraft((previous) => [...previous, { type: '', url: '' }])
                      }
                    >
                      {t.profile.addLink}
                    </button>
                  ) : null}
                  {fieldErrors.links ? (
                    <FieldError id="setup-links-error">{fieldErrors.links}</FieldError>
                  ) : null}
                </div>

                {formNote ? <FormMessage tone="status">{formNote}</FormMessage> : null}

                <div className="flex flex-wrap gap-8 max-sm:flex-col max-sm:items-stretch">
                  <button
                    type="submit"
                    className={cx(primaryButton, 'max-sm:w-full')}
                    disabled={save.status === 'saving' || save.status === 'saved' || syncing}
                  >
                    {save.status === 'saving' ? (
                      <>
                        <Spinner className="ml-8" /> {t.cvEditor.saving}
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
                    <Link className={cx(ghostButton, 'max-sm:w-full')} href={`${base}/app/`}>
                      {t.profile.openWorkspace}
                    </Link>
                  ) : null}
                  {isUpdateFlow ? (
                    // The persistent way back: never tied to the toast's
                    // five seconds, so the exit does not vanish with it.
                    <Link className={cx(ghostButton, 'max-sm:w-full')} href={`${base}/app/`}>
                      <HomeIcon /> {t.cvEditor.back}
                    </Link>
                  ) : null}
                </div>
              </AuthForm>
            </div>
          ) : null}
        </AuthCard>
      </ProfileColumns>
    </>
  );

  return isUpdateFlow ? (
    <AppShell locale={locale} back>
      {content}
    </AppShell>
  ) : (
    <AuthPage>{content}</AuthPage>
  );
}

// The profile card skeleton: heading, description and field rows as soft
// blocks in the same geometry as the ready state — the flow's face
// (heading, stepper, kicker) stays hidden until the profile arrives, so
// no flow is announced before its data exists.
function ProfileCardSkeleton() {
  return (
    <div className="grid gap-12">
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

// The skills text with one more name: kept as typed, the name appended
// once (case-insensitive) after a comma.
export function withSkill(text: string, skill: string): string {
  const names = text
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  if (names.some((name) => name.toLowerCase() === skill.toLowerCase())) {
    return text;
  }
  return [...names, skill].join(', ');
}

// The update flow puts the harness suggestions beside the form (stacked
// under 860px); onboarding keeps the single centered card.
function ProfileColumns({ aside, children }: { aside: ReactNode; children: ReactNode }) {
  if (!aside) {
    return <>{children}</>;
  }
  return (
    <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(260px,0.9fr)] items-start gap-16 max-md:grid-cols-1">
      {children}
      {aside}
    </div>
  );
}

// Whether two copies of the profile agree on everything but the skills
// (and the version stamp): an accepted suggestion changes only those.
export function sameBesidesSkills(a: Profile, b: Profile): boolean {
  return (
    a.full_name === b.full_name &&
    (a.headline ?? null) === (b.headline ?? null) &&
    (a.bio ?? null) === (b.bio ?? null) &&
    (a.location ?? null) === (b.location ?? null) &&
    JSON.stringify(a.links ?? []) === JSON.stringify(b.links ?? [])
  );
}
