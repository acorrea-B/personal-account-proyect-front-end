'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { formatWhen } from '@/components/cv-timeline';
import { Skeleton } from '@/components/skeleton';
import { cx, ghostButton, workspacePanel } from '@/components/ui';
import { type HarnessOutputs, fetchHarnessOutputs } from '@/lib/api/harness';
import { type Locale, labels, tr } from '@/lib/i18n';
import type { CvSuggestion, VerificationStatus } from '@/lib/schemas/harness';

type CardState =
  { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; outputs: HarnessOutputs };

// Backed advice first; what verification blocked is not advice and is
// listed apart, as what the CV still has to prove.
const order: VerificationStatus[] = ['AllSupported', 'Mixed', 'AllInferred'];

const tone: Record<Exclude<VerificationStatus, 'Blocked'>, string> = {
  AllSupported: 'bg-teal-wash text-teal-text',
  Mixed: 'bg-sky-wash-soft text-cyan-text-strong',
  AllInferred: 'bg-stone-canvas text-warm-gray',
};

// The harness marks a suggestion with no resolved evidence in its
// rationale; the status chip already says it.
const plainRationale = (rationale: string) => rationale.replace(/^\[inferred\]\s*/, '');

function SuggestionItem({ suggestion, locale }: { suggestion: CvSuggestion; locale: Locale }) {
  const a = labels(locale).ai;
  const status = suggestion.verification_status;
  const statusLabel = {
    AllSupported: a.statusSupported,
    Mixed: a.statusPartial,
    AllInferred: a.statusInferred,
    Blocked: null,
  }[status];
  return (
    <li className="grid gap-8 border-t border-stone-border py-12 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-8">
        <span className="text-(length:--text-label) font-semibold tracking-[0.08em] text-warm-gray uppercase">
          {suggestion.section}
        </span>
        {status !== 'Blocked' ? (
          <span className={cx('rounded-full px-8 py-4 text-[12px] font-medium', tone[status])}>
            {statusLabel}
          </span>
        ) : null}
      </div>
      <p className="m-0 text-[14px] leading-[1.6] text-ink-black">{suggestion.suggested_text}</p>
      {suggestion.rationale ? (
        <p className="m-0 text-[13px] leading-[1.6] text-warm-gray">
          {tr(a.why, { rationale: plainRationale(suggestion.rationale) })}
        </p>
      ) : null}
    </li>
  );
}

// The profile's AI suggestions for the CV: the newest harness run's
// cv_suggestions with the verification status of each, the blocked ones
// apart as what the CV still has to prove. Read-only until BC-013 adds CV
// suggestion decisions. It loads once per visit.
export function AiSuggestionsCard({
  accessToken,
  locale,
}: {
  accessToken: string;
  locale: Locale;
}) {
  const a = labels(locale).ai;
  const [state, setState] = useState<CardState>({ kind: 'loading' });
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      setState({ kind: 'ready', outputs: await fetchHarnessOutputs(tokenRef.current) });
    } catch {
      setState({ kind: 'error' });
    }
  }, []);

  const loaded = useRef(false);
  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      void load();
    }
  }, [load]);

  const suggestions = state.kind === 'ready' ? state.outputs.cvSuggestions : null;
  const advice = (suggestions ?? [])
    .filter((suggestion) => suggestion.verification_status !== 'Blocked')
    .sort(
      (left, right) =>
        order.indexOf(left.verification_status) - order.indexOf(right.verification_status),
    );
  const missing = (suggestions ?? []).filter(
    (suggestion) => suggestion.verification_status === 'Blocked',
  );

  return (
    <section className={workspacePanel} aria-label={a.title}>
      <h2 className="m-0 font-roobert text-title-sm font-medium text-ink-black">{a.title}</h2>
      {state.kind === 'loading' ? (
        <div className="grid gap-12" aria-label={a.loadingAria}>
          <Skeleton width="60%" height={12} />
          <Skeleton width="100%" height={14} />
          <Skeleton width="90%" height={14} />
        </div>
      ) : state.kind === 'error' ? (
        <>
          <p role="alert" className="m-0 text-[14px] text-soot">
            {a.loadFailed}
          </p>
          <div>
            <button type="button" className={ghostButton} onClick={() => void load()}>
              {a.retry}
            </button>
          </div>
        </>
      ) : !suggestions?.length ? (
        <p className="m-0 text-[14px] text-warm-gray">{a.none}</p>
      ) : (
        <>
          <p className="m-0 text-[14px] leading-[1.6] text-warm-gray">{a.intro}</p>
          {advice.length ? (
            <ul className="m-0 grid list-none p-0" aria-label={a.listAria}>
              {advice.map((suggestion) => (
                <SuggestionItem
                  key={suggestion.suggestion_id}
                  suggestion={suggestion}
                  locale={locale}
                />
              ))}
            </ul>
          ) : null}
          {missing.length ? (
            <div className="grid gap-8 rounded-lg bg-stone-canvas p-12">
              <h3 className="m-0 text-[14px] font-semibold text-ink-black">{a.missingTitle}</h3>
              <p className="m-0 text-[13px] leading-[1.6] text-warm-gray">{a.missingCopy}</p>
              <ul className="m-0 grid list-none p-0">
                {missing.map((suggestion) => (
                  <SuggestionItem
                    key={suggestion.suggestion_id}
                    suggestion={suggestion}
                    locale={locale}
                  />
                ))}
              </ul>
            </div>
          ) : null}
          <p className="m-0 text-[12px] text-warm-gray">
            {a.decideSoon}
            {state.outputs.runAt
              ? ` · ${tr(a.runAt, { date: formatWhen(state.outputs.runAt, locale) })}`
              : ''}
          </p>
        </>
      )}
    </section>
  );
}
