'use client';

import Link from 'next/link';
import { type SyntheticEvent, useCallback, useEffect, useRef, useState } from 'react';

import { AccountMenu } from '@/components/account-menu';
import { HomeIcon } from '@/components/icons';
import { Skeleton } from '@/components/skeleton';
import {
  AuthKicker,
  Eyebrow,
  WorkspaceBar,
  WorkspacePage,
  WorkspaceTitle,
  contentResolve,
  cx,
  ghostButton,
  inlineAlert,
  primaryButton,
  workspacePanel,
} from '@/components/ui';
import { ProblemError } from '@/lib/api/client';
import {
  confirmJournalConsent,
  createJournalEntry,
  deleteJournalEntry,
  fetchJournalConsent,
  fetchJournalEntries,
} from '@/lib/api/journal';
import { fetchProfileSkills } from '@/lib/api/suggestions';
import { useRequireAuth } from '@/lib/auth/useRequireAuth';
import { type Locale, labels, tr } from '@/lib/i18n';
import { journalTextMax, type JournalConsent, type JournalEntry } from '@/lib/schemas/journal';
import type { ProfileSkill } from '@/lib/schemas/suggestions';

// An entry happened on a day (stored as that day at 00:00 UTC): it reads
// as a date in the tree language, never with a midnight time.
function formatDay(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso));
}

type JournalLoad =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      consent: JournalConsent;
      entries: JournalEntry[];
      skills: ProfileSkill[];
      consented: boolean;
    };

// The journal (BC-003/BC-004): the user records what they did, optionally
// as evidence and linked to their skills. The first visit shows the active
// journal consent; the api does not expose whether the caller already
// confirmed it, so an entry saved under the active version counts as
// consent (confirming again is idempotent on the api side).
export function JournalView({ locale }: { locale: Locale }) {
  const t = labels(locale);
  const j = t.journal;
  const base = locale === 'es' ? '/es' : '';
  const { isHydrated, isAuthorized, session } = useRequireAuth();
  const accessToken = session?.accessToken ?? null;

  const [load, setLoad] = useState<JournalLoad>({ status: 'loading' });
  const [confirming, setConfirming] = useState(false);
  const [text, setText] = useState('');
  const [day, setDay] = useState('');
  const [asEvidence, setAsEvidence] = useState(true);
  const [linked, setLinked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'alert' | 'status'; text: string } | null>(null);

  const loadJournal = useCallback(
    async (token: string) => {
      setLoad({ status: 'loading' });
      try {
        const [consent, entries, skills] = await Promise.all([
          fetchJournalConsent(token),
          fetchJournalEntries(token),
          // The skill links are optional: a failed read just offers none.
          fetchProfileSkills(token).catch(() => [] as ProfileSkill[]),
        ]);
        setLoad({
          status: 'ready',
          consent,
          entries,
          skills,
          consented: entries.some((entry) => entry.consent_version === consent.version),
        });
      } catch (error) {
        setLoad({
          status: 'error',
          message:
            error instanceof ProblemError &&
            (error.problem.status === 429 || error.problem.status === 503)
              ? j.busy
              : j.loadFailed,
        });
      }
    },
    [j],
  );

  // The journal loads once per visit. A renewed access token (the session
  // refreshes it in the background) must not reload it: a reload would
  // drop the ready list while a save or a delete is completing.
  const loaded = useRef(false);
  useEffect(() => {
    if (isHydrated && isAuthorized && accessToken && !loaded.current) {
      loaded.current = true;
      void loadJournal(accessToken);
    }
  }, [isHydrated, isAuthorized, accessToken, loadJournal]);

  // Every mutation lands on the latest list (a save and a delete may
  // overlap), never on the copy captured when the request started.
  function updateEntries(change: (entries: JournalEntry[]) => JournalEntry[]) {
    setLoad((current) =>
      current.status === 'ready' ? { ...current, entries: change(current.entries) } : current,
    );
  }

  async function confirm() {
    if (load.status !== 'ready' || !accessToken) {
      return;
    }
    setConfirming(true);
    setNotice(null);
    try {
      await confirmJournalConsent(accessToken, load.consent.version);
      setLoad((current) =>
        current.status === 'ready' ? { ...current, consented: true } : current,
      );
    } catch {
      setNotice({ tone: 'alert', text: j.consentFailed });
    } finally {
      setConfirming(false);
    }
  }

  async function save(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (load.status !== 'ready' || !accessToken || !text.trim()) {
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const entry = await createJournalEntry(accessToken, {
        text,
        ...(day ? { occurred_at: `${day}T00:00:00Z` } : {}),
        user_confirmed_as_evidence: asEvidence,
        linked_skill_ids: linked,
        consent_version: load.consent.version,
      });
      updateEntries((entries) => [entry, ...entries]);
      setText('');
      setDay('');
      setLinked([]);
      setNotice({ tone: 'status', text: j.saved });
    } catch {
      setNotice({ tone: 'alert', text: j.saveFailed });
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (load.status !== 'ready' || !accessToken) {
      return;
    }
    setNotice(null);
    setDeleting(id);
    try {
      await deleteJournalEntry(accessToken, id);
      updateEntries((entries) => entries.filter((entry) => entry.id !== id));
    } catch (error) {
      if (error instanceof ProblemError && error.problem.status === 404) {
        // Already gone (another tab): the list catches up.
        updateEntries((entries) => entries.filter((entry) => entry.id !== id));
      } else {
        setNotice({ tone: 'alert', text: j.deleteFailed });
      }
    } finally {
      setPendingDelete(null);
      setDeleting(null);
    }
  }

  const bar = (
    <WorkspaceBar
      identity={
        <>
          <Eyebrow>{t.workspace.eyebrow}</Eyebrow>
          <WorkspaceTitle>{j.title}</WorkspaceTitle>
        </>
      }
    >
      <AccountMenu locale={locale} />
    </WorkspaceBar>
  );

  if (!isHydrated || !isAuthorized || load.status === 'loading') {
    return (
      <WorkspacePage busy>
        {bar}
        <section className={workspacePanel} aria-label={j.loadingAria}>
          <div className="grid gap-12">
            <Skeleton width={180} height={14} />
            <Skeleton width="100%" height={120} />
            <Skeleton width="60%" height={14} />
          </div>
        </section>
      </WorkspacePage>
    );
  }

  const skillName = (id: string) =>
    load.status === 'ready'
      ? (load.skills.find((skill) => skill.id === id)?.display_name ?? null)
      : null;

  return (
    <WorkspacePage>
      <div className={cx(contentResolve, 'grid gap-32')}>
        {bar}

        {load.status === 'error' ? (
          <section className={workspacePanel}>
            <p role="alert" className={cx('m-0', inlineAlert)}>
              {load.message}
            </p>
            <div>
              <button
                type="button"
                className={ghostButton}
                onClick={() => accessToken && void loadJournal(accessToken)}
              >
                {j.retry}
              </button>
            </div>
          </section>
        ) : !load.consented ? (
          <section className={workspacePanel} aria-label={j.consentTitle}>
            <AuthKicker>{j.consentTitle}</AuthKicker>
            <p className="m-0 text-[14px] leading-[1.6] text-warm-gray">{j.intro}</p>
            <blockquote className="m-0 max-h-[240px] overflow-y-auto rounded-lg border border-stone-border bg-stone-canvas p-16 text-[14px] leading-[1.6] whitespace-pre-wrap text-ink-black">
              {load.consent.consent_text}
            </blockquote>
            <p className="m-0 text-(length:--text-label) text-warm-gray">
              {tr(j.consentVersion, { version: load.consent.version })}
            </p>
            <div>
              <button
                type="button"
                className={primaryButton}
                disabled={confirming}
                onClick={() => void confirm()}
              >
                {confirming ? j.consentConfirming : j.consentConfirm}
              </button>
            </div>
          </section>
        ) : (
          <>
            <section className={workspacePanel} aria-label={j.composerLabel}>
              <p className="m-0 text-[14px] leading-[1.6] text-warm-gray">{j.intro}</p>
              <form className="m-0 grid gap-16" onSubmit={(event) => void save(event)}>
                {/* The composer is frozen while its entry saves, so nothing
                    typed meanwhile is lost when the fields clear. */}
                <fieldset disabled={saving} className="m-0 grid gap-16 border-none p-0">
                  <label className="grid gap-4" htmlFor="journal-text">
                    {j.composerLabel}
                    <textarea
                      id="journal-text"
                      rows={5}
                      maxLength={journalTextMax}
                      value={text}
                      placeholder={j.composerPlaceholder}
                      onChange={(event) => setText(event.target.value)}
                      aria-describedby="journal-counter"
                      className="min-h-[120px] w-full max-w-full resize-y rounded-inputs border border-stone-border bg-pure-white px-[14px] py-12 [font-family:inherit] text-[16px] leading-[1.6] text-ink-black focus-visible:border-cyan-signal focus-visible:shadow-[0_0_0_3px_var(--color-sky-wash)] focus-visible:outline-none"
                    />
                  </label>
                  <p
                    id="journal-counter"
                    className="m-0 text-right text-(length:--text-label) text-warm-gray"
                  >
                    {tr(j.counter, { count: String(text.length), max: String(journalTextMax) })}
                  </p>
                  <div className="flex flex-wrap items-end gap-16">
                    <label className="grid gap-4" htmlFor="journal-day">
                      {j.dateLabel}
                      <input
                        id="journal-day"
                        type="date"
                        value={day}
                        onChange={(event) => setDay(event.target.value)}
                        className="min-h-[44px] rounded-inputs border border-stone-border bg-pure-white px-12 [font-family:inherit] text-[16px] text-ink-black focus-visible:border-cyan-signal focus-visible:outline-none"
                      />
                    </label>
                    <label
                      className="flex min-h-[44px] items-center gap-8"
                      htmlFor="journal-evidence"
                    >
                      <input
                        id="journal-evidence"
                        type="checkbox"
                        checked={asEvidence}
                        onChange={(event) => setAsEvidence(event.target.checked)}
                        className="size-[18px] accent-cyan-signal"
                      />
                      {j.evidenceLabel}
                    </label>
                  </div>
                  {load.skills.length ? (
                    <fieldset className="m-0 grid gap-8 border-none p-0">
                      <legend className="mb-8 p-0">{j.skillsLegend}</legend>
                      <div className="flex flex-wrap gap-8">
                        {load.skills.map((skill) => {
                          const on = linked.includes(skill.id);
                          return (
                            <button
                              key={skill.id}
                              type="button"
                              aria-pressed={on}
                              onClick={() =>
                                setLinked((previous) =>
                                  on
                                    ? previous.filter((id) => id !== skill.id)
                                    : [...previous, skill.id],
                                )
                              }
                              className={cx(
                                'min-h-[36px] cursor-pointer rounded-full border px-12 py-4 [font-family:inherit] text-[14px] font-medium',
                                on
                                  ? 'border-cyan-edge bg-sky-wash-soft text-cyan-text-strong'
                                  : 'border-stone-border bg-transparent text-warm-gray',
                              )}
                            >
                              {on ? '✓ ' : ''}
                              {skill.display_name}
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>
                  ) : null}
                </fieldset>
                <div className="flex flex-wrap gap-8 max-sm:flex-col max-sm:items-stretch">
                  <button
                    type="submit"
                    className={cx(primaryButton, 'max-sm:w-full')}
                    disabled={saving || !text.trim()}
                  >
                    {saving ? j.saving : j.save}
                  </button>
                  <Link className={cx(ghostButton, 'max-sm:w-full')} href={`${base}/app/`}>
                    <HomeIcon /> {j.back}
                  </Link>
                </div>
              </form>
            </section>

            <section className={workspacePanel} aria-label={j.listTitle}>
              <Eyebrow>{j.listTitle}</Eyebrow>
              {load.entries.length ? (
                <ul className="m-0 grid list-none gap-12 p-0" aria-label={j.listAria}>
                  {load.entries.map((entry) => {
                    const when = formatDay(entry.occurred_at, locale);
                    const names = entry.linked_skill_ids
                      .map(skillName)
                      .filter((name): name is string => Boolean(name));
                    return (
                      <li
                        key={entry.id}
                        className="grid gap-8 rounded-lg border border-stone-border p-16"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-8">
                          <time
                            dateTime={entry.occurred_at}
                            className="text-(length:--text-label) tracking-[0.08em] text-warm-gray uppercase"
                          >
                            {when}
                          </time>
                          {entry.user_confirmed_as_evidence ? (
                            <span className="rounded-full bg-sky-wash-soft px-12 py-4 text-(length:--text-label) font-medium text-cyan-text-strong">
                              {j.evidenceBadge}
                            </span>
                          ) : null}
                        </div>
                        <p className="m-0 [overflow-wrap:anywhere] whitespace-pre-wrap text-ink-black">
                          {entry.text}
                        </p>
                        {names.length ? (
                          <p className="m-0 text-[14px] text-warm-gray">{names.join(' · ')}</p>
                        ) : null}
                        {pendingDelete === entry.id ? (
                          <div className="flex flex-wrap items-center gap-8" role="group">
                            <span className="text-[14px] text-soot">{j.confirmDelete}</span>
                            <button
                              type="button"
                              className={ghostButton}
                              disabled={deleting !== null}
                              onClick={() => void remove(entry.id)}
                            >
                              {j.deleteConfirm}
                            </button>
                            <button
                              type="button"
                              className={ghostButton}
                              onClick={() => setPendingDelete(null)}
                            >
                              {j.deleteCancel}
                            </button>
                          </div>
                        ) : (
                          <div>
                            <button
                              type="button"
                              className="cursor-pointer border-none bg-transparent p-0 [font-family:inherit] text-[14px] text-cyan-text hover:text-cyan-text-strong hover:underline"
                              aria-label={tr(j.deleteAria, { date: when })}
                              disabled={deleting !== null}
                              onClick={() => setPendingDelete(entry.id)}
                            >
                              {j.delete}
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="m-0 text-[14px] text-warm-gray">{j.empty}</p>
              )}
            </section>
          </>
        )}

        {notice ? (
          <p
            role={notice.tone}
            className={cx('m-0', inlineAlert, notice.tone === 'status' && 'border-cyan-text')}
          >
            {notice.text}
          </p>
        ) : null}
      </div>
    </WorkspacePage>
  );
}
