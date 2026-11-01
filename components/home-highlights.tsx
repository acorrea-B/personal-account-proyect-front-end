'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Skeleton } from '@/components/skeleton';
import {
  Eyebrow,
  cx,
  ghostButton,
  linkClass,
  primaryButton,
  workspacePanel,
} from '@/components/ui';
import { fetchEvolutionHistory, fetchEvolutionMode } from '@/lib/api/evolution';
import { fetchSuggestionsSummary } from '@/lib/api/suggestions';
import { type Locale, labels, tr } from '@/lib/i18n';
import type { EvolutionMode, LoopResult, LoopVerdict } from '@/lib/schemas/evolution';

type Highlights =
  | { kind: 'loading' }
  | { kind: 'error' }
  | {
      kind: 'ready';
      pendingSkills: number;
      mode: EvolutionMode | null;
      lastCheck: LoopResult | null;
    };

export type NextStep = 'cv' | 'suggestions' | 'evolution' | 'journal';

// The one action the home recommends, in order of what unblocks the most:
// without a CV the harness has nothing to read; pending suggestions wait
// on the user; without a declared mode nothing is checked; otherwise the
// journal keeps the evidence growing.
export function nextStep(input: {
  hasCv: boolean;
  pendingSkills: number;
  hasMode: boolean;
}): NextStep {
  if (!input.hasCv) {
    return 'cv';
  }
  if (input.pendingSkills > 0) {
    return 'suggestions';
  }
  if (!input.hasMode) {
    return 'evolution';
  }
  return 'journal';
}

// The month of the horizon the user is in, counted from the declaration
// (1 on the declaration day), never past the horizon.
export function horizonMonth(declaredAt: string, horizonMonths: number, now = Date.now()): number {
  const elapsed = (now - new Date(declaredAt).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  return Math.min(Math.max(Math.floor(elapsed) + 1, 1), horizonMonths);
}

const verdictTone: Record<LoopVerdict, string> = {
  on_track: 'bg-teal-wash text-teal-text',
  fixable_deviation: 'bg-sky-wash-soft text-cyan-text-strong',
  structural: 'bg-[rgba(185,28,28,0.08)] text-alert',
  unmeasurable: 'bg-stone-canvas text-warm-gray',
};

// The home's two highlights: the recommended next step and where the
// declared evolution stands (mode, horizon, last harness check). One load
// per visit feeds both.
export function HomeHighlights({
  accessToken,
  locale,
  hasCv,
}: {
  accessToken: string;
  locale: Locale;
  hasCv: boolean;
}) {
  const t = labels(locale);
  const h = t.home;
  const base = locale === 'es' ? '/es' : '';
  const [state, setState] = useState<Highlights>({ kind: 'loading' });
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const token = tokenRef.current;
      const [summary, mode, history] = await Promise.all([
        fetchSuggestionsSummary(token),
        fetchEvolutionMode(token),
        fetchEvolutionHistory(token, 1),
      ]);
      setState({
        kind: 'ready',
        pendingSkills: summary.skills.pending,
        mode,
        lastCheck: history[0] ?? null,
      });
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

  if (state.kind === 'loading') {
    return (
      <div className={grid} aria-label={h.loadingAria}>
        {[0, 1].map((index) => (
          <section key={index} className={workspacePanel}>
            <Skeleton width={90} height={12} />
            <Skeleton width="80%" height={20} />
            <Skeleton width="60%" height={14} />
          </section>
        ))}
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <section className={workspacePanel} aria-label={h.nextEyebrow}>
        <p role="alert" className="m-0 text-[14px] text-soot">
          {h.loadFailed}
        </p>
        <div>
          <button type="button" className={ghostButton} onClick={() => void load()}>
            {h.retry}
          </button>
        </div>
      </section>
    );
  }

  const step = nextStep({
    hasCv,
    pendingSkills: state.pendingSkills,
    hasMode: state.mode !== null,
  });
  const copy = {
    cv: { title: h.cvTitle, body: h.cvCopy, action: h.cvAction, path: '/app/cv/' },
    suggestions: {
      title:
        state.pendingSkills === 1
          ? h.suggestionsOne
          : tr(h.suggestionsOther, { count: String(state.pendingSkills) }),
      body: h.suggestionsCopy,
      action: h.suggestionsAction,
      path: '/app/profile/',
    },
    evolution: {
      title: h.evolutionTitle,
      body: h.evolutionCopy,
      action: h.evolutionAction,
      path: '/app/evolution/',
    },
    journal: {
      title: h.journalTitle,
      body: h.journalCopy,
      action: h.journalAction,
      path: '/app/journal/',
    },
  }[step];

  const mode = state.mode;
  const month = mode ? horizonMonth(mode.declared_at, mode.horizon_months) : 0;

  return (
    <div className={grid}>
      <section className={workspacePanel} aria-label={h.nextEyebrow}>
        <span className="text-(length:--text-label) font-semibold tracking-[0.08em] text-cyan-text uppercase">
          {h.nextEyebrow}
        </span>
        <h2 className="m-0 font-roobert text-title-sm leading-[1.3] font-medium text-ink-black">
          {copy.title}
        </h2>
        <p className="m-0 text-[14px] leading-[1.6] text-warm-gray">{copy.body}</p>
        <div>
          <Link className={cx(primaryButton, 'no-underline')} href={`${base}${copy.path}`}>
            {copy.action}
          </Link>
        </div>
      </section>

      <section className={workspacePanel} aria-label={h.evolutionEyebrow}>
        <div className="flex flex-wrap items-center justify-between gap-8">
          <Eyebrow>{h.evolutionEyebrow}</Eyebrow>
          {state.lastCheck ? (
            <span
              className={cx(
                'rounded-full px-12 py-4 text-(length:--text-label) font-medium',
                verdictTone[state.lastCheck.verdict],
              )}
            >
              {t.evolution[state.lastCheck.verdict]}
            </span>
          ) : null}
        </div>
        {mode ? (
          <>
            <h2 className="m-0 font-roobert text-title-sm leading-[1.3] font-medium text-ink-black">
              {tr(t.evolution.summary, {
                mode: mode.mode === 'must_evolve' ? t.evolution.mustEvolve : t.evolution.canEvolve,
                role: mode.target_role_id,
                months: String(mode.horizon_months),
              })}
            </h2>
            <div className="grid gap-4">
              <span className="text-[13px] text-warm-gray tabular-nums">
                {tr(h.horizon, { month: String(month), months: String(mode.horizon_months) })}
              </span>
              <div
                role="meter"
                aria-label={h.evolutionEyebrow}
                aria-valuemin={0}
                aria-valuemax={mode.horizon_months}
                aria-valuenow={month}
                aria-valuetext={tr(h.horizon, {
                  month: String(month),
                  months: String(mode.horizon_months),
                })}
                className="h-[6px] overflow-hidden rounded-full bg-teal-wash"
              >
                <div
                  className="h-full rounded-full bg-teal-text"
                  style={{ width: `${(month / mode.horizon_months) * 100}%` }}
                />
              </div>
            </div>
            {state.lastCheck ? null : (
              <p className="m-0 text-[14px] text-warm-gray">{h.noChecks}</p>
            )}
          </>
        ) : (
          <p className="m-0 text-[14px] leading-[1.6] text-warm-gray">{h.noMode}</p>
        )}
        <Link className={cx(linkClass, 'text-[14px] font-medium')} href={`${base}/app/evolution/`}>
          {mode ? h.openEvolution : h.evolutionAction}
        </Link>
      </section>
    </div>
  );
}

const grid = 'grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] items-start gap-16';
