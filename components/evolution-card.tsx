'use client';

import { type SyntheticEvent, useCallback, useEffect, useRef, useState } from 'react';

import { AiRoadmapPreview } from '@/components/ai-roadmap-preview';
import { Skeleton } from '@/components/skeleton';
import {
  Eyebrow,
  cx,
  ghostButton,
  inlineAlert,
  inputClass,
  outlineButton,
  workspacePanel,
} from '@/components/ui';
import { formatWhen } from '@/components/cv-timeline';
import {
  declareEvolutionMode,
  fetchEvolutionHistory,
  fetchEvolutionMode,
} from '@/lib/api/evolution';
import { type Locale, labels, tr } from '@/lib/i18n';
import {
  declareEvolutionModeSchema,
  horizonMonthsMax,
  horizonMonthsMin,
  rationaleMax,
  type EvolutionMode,
  type LoopResult,
  type LoopVerdict,
} from '@/lib/schemas/evolution';

type CardState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; mode: EvolutionMode | null; history: LoopResult[] };

// The badge tone of each loop verdict: on track reads teal (the progress
// accent), a fixable deviation cyan, a structural gap alert, and an
// unmeasurable check stays neutral.
const verdictTone: Record<LoopVerdict, string> = {
  on_track: 'bg-teal-wash text-teal-text',
  fixable_deviation: 'bg-sky-wash-soft text-cyan-text-strong',
  structural: 'bg-[rgba(185,28,28,0.08)] text-alert',
  unmeasurable: 'bg-stone-canvas text-warm-gray',
};

// The evolution panel (BC-005/BC-008): the mode the user declared — whether
// they can or must evolve, toward which role and in how many months — and
// the latest checks the harness recorded. Without a mode (or on "Change")
// the user first picks a path: the AI roadmap (a beta 1.1 preview for now)
// or a specific target, which opens the declaration form. The contract's
// success criterion is derived from the role and horizon: the user knows
// where they want to go, not yet what it will be like to be there.
export function EvolutionCard({ accessToken, locale }: { accessToken: string; locale: Locale }) {
  const t = labels(locale).evolution;
  const [state, setState] = useState<CardState>({ kind: 'loading' });
  const [editing, setEditing] = useState(false);
  const [path, setPath] = useState<'ai' | 'target' | null>(null);
  const [horizonInfo, setHorizonInfo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({
    mode: 'can_evolve' as EvolutionMode['mode'],
    role: '',
    months: '12',
    rationale: '',
  });

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const [mode, history] = await Promise.all([
        fetchEvolutionMode(accessToken),
        fetchEvolutionHistory(accessToken, 5),
      ]);
      setState({ kind: 'ready', mode, history });
    } catch {
      setState({ kind: 'error' });
    }
  }, [accessToken]);

  // Loads once per visit: a renewed access token (background session
  // refresh) must not reload the panel under a declaration in flight.
  const loaded = useRef(false);
  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      void load();
    }
  }, [load]);

  function startEditing(mode: EvolutionMode | null) {
    setForm({
      mode: mode?.mode ?? 'can_evolve',
      role: mode?.target_role_id ?? '',
      months: String(mode?.horizon_months ?? 12),
      rationale: mode?.rationale ?? '',
    });
    setNotice(null);
    setPath(null);
    setHorizonInfo(false);
    setEditing(true);
  }

  async function declare(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const declaration = {
      mode: form.mode,
      target_role_id: form.role,
      horizon_months: Number(form.months),
      success_criterion: tr(t.criterionDerived, { role: form.role.trim(), months: form.months }),
      ...(form.rationale.trim() ? { rationale: form.rationale } : {}),
    };
    if (!declareEvolutionModeSchema.safeParse(declaration).success) {
      setNotice(t.invalid);
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const mode = await declareEvolutionMode(accessToken, declaration);
      setState((current) => (current.kind === 'ready' ? { ...current, mode } : current));
      setEditing(false);
      setPath(null);
    } catch {
      setNotice(t.failed);
    } finally {
      setSaving(false);
    }
  }

  const modeName = (mode: EvolutionMode['mode']) =>
    mode === 'must_evolve' ? t.mustEvolve : t.canEvolve;

  return (
    <section className={workspacePanel} aria-label={t.title}>
      <Eyebrow>{t.title}</Eyebrow>
      {state.kind === 'loading' ? (
        <div className="grid gap-12" aria-label={t.loadingAria}>
          <Skeleton width="60%" height={16} />
          <Skeleton width="100%" height={14} />
        </div>
      ) : state.kind === 'error' ? (
        <div className="grid justify-items-start gap-8">
          <p role="alert" className="m-0 text-[14px] text-soot">
            {t.loadFailed}
          </p>
          <button type="button" className={ghostButton} onClick={() => void load()}>
            {t.retry}
          </button>
        </div>
      ) : (editing || !state.mode) && path === null ? (
        <div className="grid animate-content-resolve gap-12 motion-reduce:animate-none">
          <h3 className="m-0 font-roobert text-(length:--text-subheading) font-medium text-ink-black">
            {t.pathTitle}
          </h3>
          <div className="grid gap-12 sm:grid-cols-2">
            {(
              [
                ['ai', t.pathAi, t.pathAiHint],
                ['target', t.pathTarget, t.pathTargetHint],
              ] as const
            ).map(([choice, title, hint]) => (
              <button
                key={choice}
                type="button"
                onClick={() => setPath(choice)}
                className="grid cursor-pointer content-start gap-8 rounded-lg border border-stone-border bg-pure-white p-16 text-left [font-family:inherit] transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-[1px] hover:border-cyan-edge hover:bg-sky-wash-soft hover:shadow-[0_6px_18px_rgba(14,116,144,0.10)] focus-visible:border-cyan-signal focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <span className="text-[15px] font-medium text-ink-black">{title}</span>
                <span className="text-[14px] leading-[1.5] text-warm-gray">{hint}</span>
              </button>
            ))}
          </div>
          {state.mode ? (
            <div>
              <button type="button" className={ghostButton} onClick={() => setEditing(false)}>
                {t.cancel}
              </button>
            </div>
          ) : null}
        </div>
      ) : (editing || !state.mode) && path === 'ai' ? (
        <AiRoadmapPreview locale={locale} onBack={() => setPath(null)} />
      ) : editing || !state.mode ? (
        <form
          className="m-0 grid animate-content-resolve gap-16 motion-reduce:animate-none"
          noValidate
          onSubmit={(event) => void declare(event)}
        >
          <p className="m-0 text-[14px] leading-[1.6] text-warm-gray">{t.intro}</p>
          <fieldset disabled={saving} className="m-0 grid gap-16 border-none p-0">
            <div role="radiogroup" aria-label={t.modeLegend} className="grid gap-8 sm:grid-cols-2">
              {(['can_evolve', 'must_evolve'] as const).map((mode) => (
                <label
                  key={mode}
                  className={cx(
                    'grid cursor-pointer gap-4 rounded-lg border p-12',
                    form.mode === mode
                      ? 'border-cyan-edge bg-sky-wash-soft'
                      : 'border-stone-border',
                  )}
                >
                  <span className="flex items-center gap-8 font-medium text-ink-black">
                    <input
                      type="radio"
                      name="evolution-mode"
                      value={mode}
                      checked={form.mode === mode}
                      onChange={() => setForm((current) => ({ ...current, mode }))}
                      className="accent-cyan-signal"
                    />
                    {modeName(mode)}
                  </span>
                  <span className="text-[14px] leading-[1.5] text-warm-gray">
                    {mode === 'must_evolve' ? t.mustEvolveHint : t.canEvolveHint}
                  </span>
                </label>
              ))}
            </div>
            <div className="grid gap-16 sm:grid-cols-[minmax(0,1fr)_160px]">
              <label className="grid gap-4" htmlFor="evolution-role">
                {t.targetRole}
                <input
                  id="evolution-role"
                  className={inputClass}
                  maxLength={200}
                  placeholder={t.targetPlaceholder}
                  value={form.role}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, role: event.target.value }))
                  }
                />
              </label>
              <div className="grid content-start gap-4">
                <span className="flex items-center gap-4">
                  <label htmlFor="evolution-months">{t.horizon}</label>
                  <button
                    type="button"
                    aria-label={t.horizonInfoAria}
                    aria-expanded={horizonInfo}
                    aria-controls="evolution-horizon-info"
                    onClick={() => setHorizonInfo((open) => !open)}
                    className="grid size-[20px] cursor-pointer place-items-center rounded-full border border-stone-border bg-pure-white p-0 text-[12px] leading-none font-semibold text-cyan-text transition-colors duration-200 hover:border-cyan-edge hover:bg-sky-wash-soft"
                  >
                    ?
                  </button>
                </span>
                <span className="relative">
                  <input
                    id="evolution-months"
                    className={cx(inputClass, 'pr-[64px]')}
                    type="number"
                    min={horizonMonthsMin}
                    max={horizonMonthsMax}
                    aria-describedby={horizonInfo ? 'evolution-horizon-info' : undefined}
                    value={form.months}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, months: event.target.value }))
                    }
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 right-12 -translate-y-1/2 text-[14px] text-warm-gray"
                  >
                    {t.horizonUnit}
                  </span>
                </span>
              </div>
            </div>
            {horizonInfo ? (
              <p
                id="evolution-horizon-info"
                className="m-0 animate-content-resolve rounded-lg bg-sky-wash-soft px-12 py-8 text-[13px] leading-[1.6] text-cyan-text-strong motion-reduce:animate-none"
              >
                {t.horizonInfo}
              </p>
            ) : null}
            <label className="grid gap-4" htmlFor="evolution-rationale">
              {t.rationale}
              <textarea
                id="evolution-rationale"
                rows={3}
                maxLength={rationaleMax}
                value={form.rationale}
                onChange={(event) =>
                  setForm((current) => ({ ...current, rationale: event.target.value }))
                }
                className="min-h-[80px] w-full resize-y rounded-inputs border border-stone-border bg-pure-white px-[14px] py-12 [font-family:inherit] text-[16px] leading-[1.6] text-ink-black focus-visible:border-cyan-signal focus-visible:outline-none"
              />
            </label>
          </fieldset>
          <div className="flex flex-wrap gap-8">
            <button type="submit" className={outlineButton} disabled={saving}>
              {saving ? t.declaring : t.declare}
            </button>
            <button
              type="button"
              className={ghostButton}
              disabled={saving}
              onClick={() => setPath(null)}
            >
              {t.roadmapBack}
            </button>
          </div>
        </form>
      ) : (
        <div className="grid gap-8">
          <p className="m-0 font-roobert text-(length:--text-subheading) leading-[1.3] text-ink-black">
            {tr(t.summary, {
              mode: modeName(state.mode.mode),
              role: state.mode.target_role_id,
              months: String(state.mode.horizon_months),
            })}
          </p>
          <p className="m-0 text-(length:--text-label) text-warm-gray">
            {tr(t.declaredOn, { date: formatWhen(state.mode.declared_at, locale) })}
          </p>
          <div>
            <button
              type="button"
              className={ghostButton}
              onClick={() => startEditing(state.kind === 'ready' ? state.mode : null)}
            >
              {t.change}
            </button>
          </div>
        </div>
      )}

      {notice ? (
        <p role="alert" className={cx('m-0', inlineAlert)}>
          {notice}
        </p>
      ) : null}

      {state.kind === 'ready' ? (
        <div className="grid gap-8 border-t border-stone-border pt-16">
          <Eyebrow>{t.historyTitle}</Eyebrow>
          {state.history.length ? (
            <ul className="m-0 grid list-none gap-8 p-0" aria-label={t.historyTitle}>
              {state.history.map((result) => (
                <li
                  key={result.id}
                  className="grid gap-4 rounded-lg border border-stone-border p-12"
                >
                  <div className="flex flex-wrap items-center justify-between gap-8">
                    <span
                      className={cx(
                        'rounded-full px-12 py-4 text-(length:--text-label) font-medium',
                        verdictTone[result.verdict],
                      )}
                    >
                      {t[result.verdict]}
                    </span>
                    <time
                      dateTime={result.created_at}
                      className="text-(length:--text-label) text-warm-gray"
                    >
                      {formatWhen(result.created_at, locale)}
                    </time>
                  </div>
                  <p className="m-0 text-[14px] leading-[1.6] text-ink-black">{result.rationale}</p>
                  <p className="m-0 text-(length:--text-label) text-warm-gray">
                    {tr(t.action, { action: result.action_type, target: result.target_ref })}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-[14px] text-warm-gray">{t.historyEmpty}</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
