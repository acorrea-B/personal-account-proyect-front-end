'use client';

import { type SyntheticEvent, useCallback, useEffect, useState } from 'react';

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

// The dashboard's evolution panel (BC-005/BC-008): the mode the user
// declared — whether they can or must evolve, toward which role, in how
// many months, and how they will know — and the latest checks the harness
// recorded in the evolution loop. Without a mode it opens the declaration
// form; "Change" declares a new one.
export function EvolutionCard({ accessToken, locale }: { accessToken: string; locale: Locale }) {
  const t = labels(locale).evolution;
  const [state, setState] = useState<CardState>({ kind: 'loading' });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({
    mode: 'can_evolve' as EvolutionMode['mode'],
    role: '',
    months: '12',
    criterion: '',
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

  useEffect(() => {
    void load();
  }, [load]);

  function startEditing(mode: EvolutionMode | null) {
    setForm({
      mode: mode?.mode ?? 'can_evolve',
      role: mode?.target_role_id ?? '',
      months: String(mode?.horizon_months ?? 12),
      criterion: mode?.success_criterion ?? '',
      rationale: mode?.rationale ?? '',
    });
    setNotice(null);
    setEditing(true);
  }

  async function declare(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const declaration = {
      mode: form.mode,
      target_role_id: form.role,
      horizon_months: Number(form.months),
      success_criterion: form.criterion,
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
      ) : editing || !state.mode ? (
        <form className="m-0 grid gap-16" noValidate onSubmit={(event) => void declare(event)}>
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
              <label className="grid gap-4" htmlFor="evolution-months">
                {t.horizon}
                <input
                  id="evolution-months"
                  className={inputClass}
                  type="number"
                  min={horizonMonthsMin}
                  max={horizonMonthsMax}
                  value={form.months}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, months: event.target.value }))
                  }
                />
              </label>
            </div>
            <label className="grid gap-4" htmlFor="evolution-criterion">
              {t.criterion}
              <input
                id="evolution-criterion"
                className={inputClass}
                maxLength={2000}
                value={form.criterion}
                onChange={(event) =>
                  setForm((current) => ({ ...current, criterion: event.target.value }))
                }
              />
            </label>
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
            {state.mode ? (
              <button
                type="button"
                className={ghostButton}
                disabled={saving}
                onClick={() => setEditing(false)}
              >
                {t.cancel}
              </button>
            ) : null}
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
          <p className="m-0 text-[14px] text-warm-gray">
            <span className="font-medium text-ink-black">{t.criterionLabel}:</span>{' '}
            {state.mode.success_criterion}
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
