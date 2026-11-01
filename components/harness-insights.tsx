'use client';

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import { formatWhen } from '@/components/cv-timeline';
import { Skeleton } from '@/components/skeleton';
import { cx, ghostButton, workspacePanel } from '@/components/ui';
import { type HarnessOutputs, fetchHarnessOutputs } from '@/lib/api/harness';
import { type Labels, type Locale, labels, tr } from '@/lib/i18n';

type InsightsState =
  { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; outputs: HarnessOutputs };

const numberLocale = (locale: Locale) => (locale === 'es' ? 'es' : 'en-US');

const percent = (value: number, locale: Locale) =>
  new Intl.NumberFormat(numberLocale(locale), {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(value);

// The label of a rubric dimension; an unknown one keeps its id readable.
function dimensionLabel(a: Labels['ai'], dimension: string): string {
  const key = `dimension_${dimension}` as keyof Labels['ai'];
  return a[key] ?? dimension.replaceAll('_', ' ');
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={workspacePanel} aria-label={title}>
      <h2 className="m-0 font-roobert text-title-sm font-medium text-ink-black">{title}</h2>
      {children}
    </section>
  );
}

// What the newest harness run says about the profile: how much of the AI
// output held up under verification, the level read from the CV by
// dimension (lowest first: where the CV gains most) and the roles it fits.
// Every number comes from the run's published outputs. Loads once.
export function HarnessInsights({ accessToken, locale }: { accessToken: string; locale: Locale }) {
  const a = labels(locale).ai;
  const [state, setState] = useState<InsightsState>({ kind: 'loading' });
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

  if (state.kind === 'loading') {
    return (
      <section className={workspacePanel} aria-label={a.loadingAria}>
        <Skeleton width="50%" height={16} />
        <Skeleton width="100%" height={14} />
        <Skeleton width="80%" height={14} />
      </section>
    );
  }

  if (state.kind === 'error') {
    return (
      <section className={workspacePanel} aria-label={a.qualityTitle}>
        <p role="alert" className="m-0 text-[14px] text-soot">
          {a.loadFailed}
        </p>
        <div>
          <button type="button" className={ghostButton} onClick={() => void load()}>
            {a.retry}
          </button>
        </div>
      </section>
    );
  }

  const { outputs } = state;
  const latest = outputs.metrics[outputs.metrics.length - 1]?.metrics ?? null;
  if (!latest && !outputs.level && !outputs.roles.length) {
    return (
      <section className={workspacePanel} aria-label={a.qualityTitle}>
        <p className="m-0 text-[14px] text-warm-gray">{a.noRun}</p>
      </section>
    );
  }

  const number = new Intl.NumberFormat(numberLocale(locale));
  const dimensions = [...(outputs.level?.dimension_scores ?? [])].sort(
    (left, right) => left.score - right.score,
  );

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] items-start gap-16">
      {latest ? (
        <Panel title={a.qualityTitle}>
          <p className="m-0 font-roobert text-[20px] leading-[1.3] font-semibold text-ink-black">
            {tr(a.qualityOf, {
              supported: String(latest.suggestions.supported),
              total: String(latest.suggestions.total),
            })}
          </p>
          <ul className="m-0 grid list-none gap-4 p-0 text-[14px] text-warm-gray">
            <li>{tr(a.qualityPartial, { count: String(latest.suggestions.partial) })}</li>
            <li>{tr(a.qualityBlocked, { count: String(latest.suggestions.blocked) })}</li>
            <li>{tr(a.qualityInferred, { count: String(latest.suggestions.inferred) })}</li>
            {typeof latest.skill_suggestions === 'number' ? (
              <li>{tr(a.qualitySkills, { count: String(latest.skill_suggestions) })}</li>
            ) : null}
          </ul>
          <p className="m-0 text-[12px] text-warm-gray">
            {tr(a.qualityModel, {
              calls: number.format(latest.model.calls),
              retries: number.format(latest.model.retries),
              tokens: number.format(latest.model.total_tokens),
            })}
            {outputs.runAt ? ` · ${tr(a.runAt, { date: formatWhen(outputs.runAt, locale) })}` : ''}
          </p>
        </Panel>
      ) : null}

      {outputs.level ? (
        <Panel title={a.levelTitle}>
          <div className="flex flex-wrap items-baseline gap-8">
            <span className="font-roobert text-[20px] font-semibold text-ink-black capitalize">
              {outputs.level.seniority_label}
            </span>
            <span className="text-[13px] text-warm-gray tabular-nums">
              {tr(a.levelScore, { score: percent(outputs.level.weighted_score, locale) })}
            </span>
          </div>
          <ul className="m-0 grid list-none gap-12 p-0">
            {dimensions.map((dimension) => {
              const name = dimensionLabel(a, dimension.dimension);
              return (
                <li key={dimension.dimension} className="grid gap-4">
                  <div className="flex items-baseline justify-between gap-8 text-[13px]">
                    <span className="text-ink-black">{name}</span>
                    <span className="text-warm-gray tabular-nums">
                      {percent(dimension.score, locale)}
                    </span>
                  </div>
                  <div
                    role="meter"
                    aria-label={name}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(dimension.score * 100)}
                    aria-valuetext={percent(dimension.score, locale)}
                    className="h-[6px] overflow-hidden rounded-full bg-sky-wash-soft"
                  >
                    <div
                      className="h-full rounded-full bg-cyan-text-strong"
                      style={{ width: `${dimension.score * 100}%` }}
                    />
                  </div>
                  <span className="text-[12px] leading-[1.5] text-warm-gray">
                    {dimension.rationale}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="m-0 text-[12px] text-warm-gray">{a.levelHint}</p>
        </Panel>
      ) : null}

      {outputs.roles.length ? (
        <Panel title={a.rolesTitle}>
          <ul className="m-0 grid list-none gap-8 p-0">
            {outputs.roles.map((role) => (
              <li
                key={role.role_id}
                className="flex flex-wrap items-center justify-between gap-8 text-[14px]"
              >
                <span className="flex items-center gap-8 text-ink-black">
                  {role.display_name}
                  {role.status === 'Primary' ? (
                    <span
                      className={cx(
                        'rounded-full px-8 py-4 text-[12px] font-medium',
                        'bg-teal-wash text-teal-text',
                      )}
                    >
                      {a.rolePrimary}
                    </span>
                  ) : null}
                </span>
                <span className="text-[13px] text-warm-gray tabular-nums">
                  {tr(a.roleMatch, { confidence: percent(role.confidence_score, locale) })}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
