'use client';

import { useCallback, useEffect, useState } from 'react';

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

// The dashboard rail card for the harness's skill suggestions (BC-012). It
// reads the review signal and the pending suggestions, shows each one with
// the verified CV line it came from, and records the user's decision: the
// harness only suggests, the user decides. Accepting adds the skill to the
// profile, so the dashboard reloads it through onAccepted.
export function SkillSuggestionsCard({
  accessToken,
  locale,
  onAccepted,
}: {
  accessToken: string;
  locale: Locale;
  onAccepted: () => void;
}) {
  const t = labels(locale).suggestions;
  const [state, setState] = useState<CardState>({ kind: 'loading' });
  const [deciding, setDeciding] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'alert' | 'status'; text: string } | null>(null);

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

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(suggestion: SkillSuggestion, decision: SkillDecision) {
    if (state.kind !== 'ready' || !state.revisionId) {
      return;
    }
    setDeciding(suggestion.skill_key);
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
      if (decision === 'accepted') {
        onAccepted();
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
    }
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
              <StatusChip>{tr(t.pending, { count: String(state.suggestions.length) })}</StatusChip>
              <ul className="m-0 grid list-none gap-12 p-0" aria-label={t.listAria}>
                {state.suggestions.map((suggestion) => {
                  const busy = deciding === suggestion.skill_key;
                  return (
                    <li
                      key={suggestion.skill_key}
                      className="grid gap-8 border-t border-stone-border pt-12"
                    >
                      <strong className="font-medium text-ink-black">
                        {suggestion.display_name}
                      </strong>
                      <figure className="m-0 grid gap-4">
                        <blockquote className="m-0 border-l-2 border-sky-wash pl-12 text-[14px] leading-[1.6] text-ink-black">
                          {suggestion.evidence.quote}
                        </blockquote>
                        <figcaption className="text-(length:--text-label) tracking-[0.08em] text-warm-gray uppercase">
                          {tr(t.evidence, { section: suggestion.evidence.cv_section })}
                        </figcaption>
                      </figure>
                      <div className="grid grid-cols-2 gap-8">
                        <button
                          type="button"
                          className={outlineButton}
                          disabled={deciding !== null}
                          aria-label={tr(t.acceptAria, { skill: suggestion.display_name })}
                          onClick={() => void decide(suggestion, 'accepted')}
                        >
                          {busy ? t.saving : t.accept}
                        </button>
                        <button
                          type="button"
                          className={ghostButton}
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
