'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { SignalIcon } from '@/components/icons';
import { Skeleton } from '@/components/skeleton';
import {
  RailItem,
  RailTitle,
  StatusChip,
  cx,
  ghostButton,
  inlineAlert,
  outlineButton,
  railText,
} from '@/components/ui';
import { ProblemError } from '@/lib/api/client';
import {
  decideSkillSuggestion,
  fetchSkillSuggestions,
  fetchSuggestionsSummary,
} from '@/lib/api/suggestions';
import { announceSuggestionsChanged } from '@/lib/suggestions-signal';
import { type Locale, labels, tr } from '@/lib/i18n';
import type { SkillDecision, SkillSuggestion, SuggestionsSummary } from '@/lib/schemas/suggestions';

type CardState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ready';
      summary: SuggestionsSummary;
      revisionId: string | null;
      suggestions: SkillSuggestion[];
    };

// How many suggestions the card shows at first and adds per "show more": a
// CV can yield dozens, and the column must stay readable beside the form.
export const suggestionsPage = 5;

// The profile's card for the harness's skill suggestions (BC-012). It reads
// the review signal and the pending suggestions, shows each one compactly
// (name and section, the verified CV line folded behind "see evidence"),
// and records the user's decision: the harness only suggests, the user
// decides. Accepting adds the skill to the
// profile, so the host reloads it through onAccepted (with the skill's
// display name).
export function SkillSuggestionsCard({
  accessToken,
  locale,
  onAccepted,
  onAcceptedMany,
  onBusyChange,
}: {
  accessToken: string;
  locale: Locale;
  onAccepted: (skill: string) => void | Promise<void>;
  // Told once after "add all" with every skill it added, so the host
  // reloads the profile once instead of once per skill.
  onAcceptedMany?: (skills: string[]) => void | Promise<void>;
  // Told when a decision starts and when it (and the host's onAccepted)
  // finished: a host form holds its save meanwhile.
  onBusyChange?: (busy: boolean) => void;
}) {
  const t = labels(locale).suggestions;
  const sections = labels(locale).cvSections;
  // The harness names the section by its canonical key; an unknown key
  // (a newer vocabulary) shows as sent rather than disappearing.
  const sectionLabel = (key: string) =>
    Object.hasOwn(sections, key) ? sections[key as keyof typeof sections] : key;
  const [state, setState] = useState<CardState>({ kind: 'loading' });
  const [deciding, setDeciding] = useState<string | null>(null);
  const [shown, setShown] = useState(suggestionsPage);
  const [notice, setNotice] = useState<{ tone: 'alert' | 'status'; text: string } | null>(null);
  // "Add all" progress: how many it added of how many it set out to add.
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);

  const readError = useCallback(
    (error: unknown) =>
      error instanceof ProblemError &&
      (error.problem.status === 429 || error.problem.status === 503)
        ? t.busy
        : t.loadFailed,
    [t],
  );

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const [summary, pending] = await Promise.all([
        fetchSuggestionsSummary(accessToken),
        fetchSkillSuggestions(accessToken),
      ]);
      setState({
        kind: 'ready',
        summary,
        revisionId: pending.revision_id,
        suggestions: pending.suggestions,
      });
    } catch (error) {
      setState({ kind: 'error', message: readError(error) });
    }
  }, [accessToken, readError]);

  // Loads once per visit: a renewed access token (the session refreshes it
  // in the background) must not reload under a decision in flight.
  const loaded = useRef(false);
  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      void load();
    }
  }, [load]);

  async function decide(suggestion: SkillSuggestion, decision: SkillDecision) {
    if (state.kind !== 'ready' || !state.revisionId) {
      return;
    }
    setDeciding(suggestion.skill_key);
    onBusyChange?.(true);
    setNotice(null);
    try {
      await decideSkillSuggestion(accessToken, suggestion.skill_key, decision, state.revisionId);
      setState({
        ...state,
        suggestions: state.suggestions.filter((item) => item.skill_key !== suggestion.skill_key),
        summary: {
          ...state.summary,
          skills: {
            ...state.summary.skills,
            pending: Math.max(state.summary.skills.pending - 1, 0),
          },
        },
      });
      announceSuggestionsChanged();
      if (decision === 'accepted') {
        await onAccepted(suggestion.display_name);
      }
    } catch (error) {
      if (error instanceof ProblemError && error.problem.status === 404) {
        // The revision moved on (the harness wrote a newer one): show it.
        await load();
        setNotice({ tone: 'status', text: t.changed });
      } else if (error instanceof ProblemError && error.problem.status === 422) {
        setNotice({ tone: 'alert', text: t.limit });
      } else {
        setNotice({ tone: 'alert', text: t.failed });
      }
    } finally {
      setDeciding(null);
      onBusyChange?.(false);
    }
  }

  // Adds every pending suggestion, one decision after another (the API
  // decides one skill per request). It stops, keeping what it added, at the
  // profile's 100-skill limit, on a busy service or on any failure; the
  // rest stay pending. A changed revision reloads the list.
  async function acceptAll() {
    if (state.kind !== 'ready' || !state.revisionId || !state.suggestions.length) {
      return;
    }
    const revisionId = state.revisionId;
    const queue = [...state.suggestions];
    const added: SkillSuggestion[] = [];
    setDeciding('*');
    onBusyChange?.(true);
    setNotice(null);
    setBulk({ done: 0, total: queue.length });
    let stop: { tone: 'alert' | 'status'; text: string } | null = null;
    for (const suggestion of queue) {
      try {
        await decideSkillSuggestion(accessToken, suggestion.skill_key, 'accepted', revisionId);
        added.push(suggestion);
        setBulk({ done: added.length, total: queue.length });
      } catch (error) {
        const status = error instanceof ProblemError ? error.problem.status : 0;
        stop =
          status === 422
            ? { tone: 'alert', text: tr(t.addAllLimit, { count: String(added.length) }) }
            : status === 404
              ? { tone: 'status', text: t.changed }
              : status === 429 || status === 503
                ? { tone: 'alert', text: tr(t.addAllBusy, { count: String(added.length) }) }
                : { tone: 'alert', text: tr(t.addAllFailed, { count: String(added.length) }) };
        break;
      }
    }
    const addedKeys = new Set(added.map((item) => item.skill_key));
    setState({
      ...state,
      suggestions: state.suggestions.filter((item) => !addedKeys.has(item.skill_key)),
      summary: {
        ...state.summary,
        skills: {
          ...state.summary.skills,
          pending: Math.max(state.summary.skills.pending - added.length, 0),
        },
      },
    });
    if (added.length) {
      announceSuggestionsChanged();
      const names = added.map((item) => item.display_name);
      if (onAcceptedMany) {
        await onAcceptedMany(names);
      } else {
        for (const name of names) {
          await onAccepted(name);
        }
      }
    }
    if (stop?.text === t.changed) {
      await load();
    }
    setNotice(stop ?? { tone: 'status', text: tr(t.addAllDone, { count: String(added.length) }) });
    setBulk(null);
    setDeciding(null);
    onBusyChange?.(false);
  }

  return (
    <RailItem icon={SignalIcon}>
      <RailTitle>{t.title}</RailTitle>
      {state.kind === 'loading' ? (
        <span className={railText} aria-label={t.loadingAria}>
          <Skeleton width={160} height={12} />
        </span>
      ) : state.kind === 'error' ? (
        <>
          <span role="alert" className={railText}>
            {state.message}
          </span>
          <button type="button" className={ghostButton} onClick={() => void load()}>
            {t.retry}
          </button>
        </>
      ) : (
        <>
          {state.suggestions.length ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-8">
                <StatusChip>
                  {tr(t.pending, { count: String(state.suggestions.length) })}
                </StatusChip>
                {state.suggestions.length > 1 ? (
                  <button
                    type="button"
                    className={cx(outlineButton, 'min-h-[44px] px-12')}
                    disabled={deciding !== null}
                    onClick={() => void acceptAll()}
                  >
                    {bulk
                      ? tr(t.addAllProgress, {
                          done: String(bulk.done),
                          total: String(bulk.total),
                        })
                      : tr(t.addAll, { count: String(state.suggestions.length) })}
                  </button>
                ) : null}
              </div>
              <ul className="m-0 grid list-none p-0" aria-label={t.listAria}>
                {state.suggestions.slice(0, shown).map((suggestion) => {
                  const busy = deciding === suggestion.skill_key;
                  return (
                    <li
                      key={suggestion.skill_key}
                      className="grid gap-8 border-t border-stone-border py-12"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-4">
                        <strong className="min-w-0 font-medium [overflow-wrap:anywhere] text-ink-black">
                          {suggestion.display_name}
                        </strong>
                        <span className="rounded-full bg-stone-canvas px-8 py-[2px] text-[12px] text-warm-gray">
                          {sectionLabel(suggestion.evidence.cv_section)}
                        </span>
                      </div>
                      <details className="group text-[13px]">
                        <summary className="w-fit cursor-pointer list-none text-cyan-text-strong hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-text-strong [&::-webkit-details-marker]:hidden">
                          <span
                            aria-hidden="true"
                            className="mr-4 inline-block transition-transform duration-200 group-open:rotate-90 motion-reduce:transition-none"
                          >
                            ›
                          </span>
                          {t.showEvidence}
                        </summary>
                        <figure className="m-0 mt-8 grid gap-4">
                          <blockquote className="m-0 border-l-2 border-sky-wash pl-12 text-[14px] leading-[1.6] [overflow-wrap:anywhere] text-ink-black">
                            {suggestion.evidence.quote}
                          </blockquote>
                          <figcaption className="text-(length:--text-label) tracking-[0.08em] text-warm-gray uppercase">
                            {tr(t.evidence, {
                              section: sectionLabel(suggestion.evidence.cv_section),
                            })}
                          </figcaption>
                        </figure>
                      </details>
                      <div className="flex flex-wrap gap-8">
                        <button
                          type="button"
                          className={cx(outlineButton, 'min-h-[44px] flex-1 px-12')}
                          disabled={deciding !== null}
                          aria-label={tr(t.acceptAria, { skill: suggestion.display_name })}
                          onClick={() => void decide(suggestion, 'accepted')}
                        >
                          {busy ? t.saving : t.accept}
                        </button>
                        <button
                          type="button"
                          className={cx(ghostButton, 'min-h-[44px] flex-1 px-12')}
                          disabled={deciding !== null}
                          aria-label={tr(t.rejectAria, { skill: suggestion.display_name })}
                          onClick={() => void decide(suggestion, 'rejected')}
                        >
                          {t.reject}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {state.suggestions.length > shown ? (
                <button
                  type="button"
                  className={ghostButton}
                  onClick={() => setShown((current) => current + suggestionsPage)}
                >
                  {tr(t.showMore, {
                    count: String(Math.min(suggestionsPage, state.suggestions.length - shown)),
                  })}
                </button>
              ) : null}
            </>
          ) : (
            <span className={railText}>{state.revisionId ? t.allReviewed : t.none}</span>
          )}
          {notice ? (
            <span
              role={notice.tone}
              className={cx(inlineAlert, notice.tone === 'status' && 'border-cyan-text')}
            >
              {notice.text}
            </span>
          ) : null}
          {state.summary.cv.pending > 0 ? (
            <span className={railText}>
              {tr(t.cvNew, { count: String(state.summary.cv.pending) })}
            </span>
          ) : null}
        </>
      )}
    </RailItem>
  );
}
