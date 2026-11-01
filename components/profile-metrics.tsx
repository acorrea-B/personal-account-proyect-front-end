'use client';

import Link from 'next/link';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import { Skeleton } from '@/components/skeleton';
import { cx, ghostButton, linkClass, workspacePanel } from '@/components/ui';
import { type MetricsPoint, fetchHarnessOutputs } from '@/lib/api/harness';
import { type Locale, labels, tr } from '@/lib/i18n';
import type { ProfileMetricsOutput } from '@/lib/schemas/harness';

type MetricsState =
  { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; points: MetricsPoint[] };

type Rate = 'completeness_score' | 'claim_supported_rate' | 'over_claimed_rate';

// Above this share of claims beyond the evidence the tile turns alert and
// names the action; below it stays the calm accent.
export const overClaimedLimit = 0.2;

const rates: { key: Rate; label: 'completeness' | 'supported' | 'overClaimed' }[] = [
  { key: 'completeness_score', label: 'completeness' },
  { key: 'claim_supported_rate', label: 'supported' },
  { key: 'over_claimed_rate', label: 'overClaimed' },
];

// Lower is better only for the claims above the evidence.
const lowerIsBetter = (rate: Rate) => rate === 'over_claimed_rate';

const numberLocale = (locale: Locale) => (locale === 'es' ? 'es' : 'en-US');

function percent(value: number, locale: Locale): string {
  return new Intl.NumberFormat(numberLocale(locale), {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(value);
}

function shortDay(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(numberLocale(locale), {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(iso));
}

// The change between two measured rates in whole points; null when either
// side was not measured.
export function deltaPoints(
  current: number | null | undefined,
  previous: number | null | undefined,
): number | null {
  if (typeof current !== 'number' || typeof previous !== 'number') {
    return null;
  }
  return Math.round(current * 100) - Math.round(previous * 100);
}

// The change since the previous run: an arrow and the points in text
// (never color alone), the tone saying whether the move is good.
function Delta({ points, rate, locale }: { points: number | null; rate: Rate; locale: Locale }) {
  const t = labels(locale).metrics;
  if (points === null) {
    return null;
  }
  if (points === 0) {
    return <span className="text-[13px] text-warm-gray">{t.same}</span>;
  }
  const good = lowerIsBetter(rate) ? points < 0 : points > 0;
  const size = String(Math.abs(points));
  return (
    <span className={cx('text-[13px] font-medium', good ? 'text-teal-text' : 'text-alert')}>
      <span aria-hidden="true">
        {points > 0 ? '▲' : '▼'} {tr(t.deltaShort, { points: size })}
      </span>
      <span className="sr-only">{tr(points > 0 ? t.up : t.down, { points: size })}</span>
    </span>
  );
}

// The indicators are comparable, so they share one neutral anatomy
// (design-professional-ui): label, leading number, change, meter, and a
// state line. Color carries meaning only: a soft teal chip for a proven
// favorable state, amber for what waits for review, alert past a limit;
// every state also says so in words and with an icon.
function Tile({ children, order = 0 }: { children: ReactNode; order?: number }) {
  return (
    <div
      className="grid animate-tile-in content-start gap-8 rounded-2xl border border-stone-border bg-pure-white p-16 motion-reduce:animate-none"
      style={{ animationDelay: `${order * 90}ms` }}
    >
      {children}
    </div>
  );
}

type Chip = 'favorable' | 'pending' | 'alert';

const chipClass: Record<Chip, string> = {
  favorable: 'bg-teal-wash-soft text-teal-text',
  pending: 'bg-amber-wash text-amber-text',
  alert: 'bg-[rgba(185,28,28,0.08)] text-alert',
};

function StateChip({ tone, children }: { tone: Chip; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-4 justify-self-start rounded-full px-8 py-[3px] text-[12px] font-medium',
        chipClass[tone],
      )}
    >
      <svg
        aria-hidden="true"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {tone === 'favorable' ? (
          <path d="M5 12l5 5L20 7" />
        ) : (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d={tone === 'pending' ? 'M12 7v5l3 2' : 'M12 7v6M12 16.5v.5'} />
          </>
        )}
      </svg>
      {children}
    </span>
  );
}

// One rate as a stat tile with its meter (label and value in text tokens,
// the fill on a lighter track of the same ramp).
function RateTile({
  rate,
  label,
  current,
  previous,
  locale,
  order,
  since,
}: {
  rate: Rate;
  label: string;
  current: ProfileMetricsOutput;
  previous: ProfileMetricsOutput | null;
  locale: Locale;
  order: number;
  // The date of the run the change is measured from, when there is one.
  since: string | null;
}) {
  const t = labels(locale).metrics;
  const value = current[rate];
  const measured = typeof value === 'number';
  const alert = rate === 'over_claimed_rate' && measured && value > overClaimedLimit;
  return (
    <Tile order={order}>
      <span className="text-[13px] text-warm-gray">{label}</span>
      <div className="flex flex-wrap items-baseline gap-8">
        <span className="font-roobert text-[28px] leading-[1.1] font-semibold text-ink-black tabular-nums">
          {measured ? percent(value, locale) : t.notMeasured}
        </span>
        <Delta points={deltaPoints(value, previous?.[rate])} rate={rate} locale={locale} />
      </div>
      <div className="relative">
        <div
          role="meter"
          aria-label={
            rate === 'over_claimed_rate'
              ? `${label} · ${tr(t.limit, { limit: percent(overClaimedLimit, locale) })}`
              : label
          }
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={measured ? Math.round(value * 100) : undefined}
          aria-valuetext={measured ? percent(value, locale) : t.notMeasured}
          className="h-[6px] overflow-hidden rounded-full bg-sky-wash-soft"
        >
          {measured ? (
            <div
              className={cx(
                'h-full origin-left animate-meter-grow rounded-full motion-reduce:animate-none',
                alert ? 'bg-alert' : 'bg-cyan-text-strong',
              )}
              style={{
                width: `${Math.max(value * 100, value > 0 ? 2 : 0)}%`,
                animationDelay: `${order * 90 + 150}ms`,
              }}
            />
          ) : null}
        </div>
        {rate === 'over_claimed_rate' ? (
          <span
            aria-hidden="true"
            className="absolute -top-[3px] h-[12px] w-[2px] rounded-[1px] bg-warm-gray"
            style={{ left: `${overClaimedLimit * 100}%` }}
          />
        ) : null}
      </div>
      {rate === 'over_claimed_rate' && measured ? (
        alert ? (
          <StateChip tone="alert">{t.overClaimedHigh}</StateChip>
        ) : (
          <StateChip tone="favorable">
            {tr(t.belowLimit, { limit: percent(overClaimedLimit, locale) })}
          </StateChip>
        )
      ) : since && previous ? (
        <span className="text-[12px] text-warm-gray">
          {tr(t.sinceRun, { date: shortDay(since, locale) })}
        </span>
      ) : null}
    </Tile>
  );
}

// One rate across the measured revisions: a 2px line over a fixed 0-100%
// scale, a marker per revision (hover names its value), the newest value
// labelled, and the same numbers as a table for assistive tech.
function TrendChart({
  rate,
  label,
  points,
  locale,
}: {
  rate: Rate;
  label: string;
  points: { at: string; value: number }[];
  locale: Locale;
}) {
  const t = labels(locale).metrics;
  const last = points.length - 1;
  const x = (index: number) => (last === 0 ? 50 : (index / last) * 100);
  const y = (value: number) => 100 - value * 100;
  const line = points.map((point, index) => `${x(index)},${y(point.value)}`).join(' ');
  return (
    <figure className="m-0 grid gap-8">
      <div className="grid grid-cols-[40px_minmax(0,1fr)] gap-8">
        <div
          aria-hidden="true"
          className="relative h-[160px] text-right text-[12px] text-warm-gray tabular-nums"
        >
          <span className="absolute top-0 right-0 -translate-y-1/2">{percent(1, locale)}</span>
          <span className="absolute top-1/2 right-0 -translate-y-1/2">{percent(0.5, locale)}</span>
          <span className="absolute bottom-0 right-0 translate-y-1/2">{percent(0, locale)}</span>
        </div>
        <div className="relative mx-16 h-[160px]" aria-hidden="true">
          <svg
            key={rate}
            className="absolute inset-0 block size-full animate-reveal-x overflow-visible motion-reduce:animate-none"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <line
              x1="0"
              y1="0"
              x2="100"
              y2="0"
              stroke="var(--color-stone-border)"
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1="0"
              y1="50"
              x2="100"
              y2="50"
              stroke="var(--color-stone-border)"
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1="0"
              y1="100"
              x2="100"
              y2="100"
              stroke="var(--color-stone-muted)"
              vectorEffect="non-scaling-stroke"
            />
            <defs>
              <linearGradient id={`trend-fill-${rate}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-cyan-signal)" stopOpacity="0.22" />
                <stop offset="100%" stopColor="var(--color-cyan-signal)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon
              points={`${line} ${x(last)},100 ${x(0)},100`}
              fill={`url(#trend-fill-${rate})`}
              className="animate-content-resolve motion-reduce:animate-none"
            />
            <polyline
              points={line}
              fill="none"
              stroke="var(--color-cyan-text-strong)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {points.map((point, index) => (
            <span
              key={`${point.at}-${index}`}
              title={`${shortDay(point.at, locale)}: ${percent(point.value, locale)}`}
              className="absolute size-[10px] -translate-1/2 rounded-full border-2 border-pure-white bg-cyan-text-strong"
              style={{ left: `${x(index)}%`, top: `${y(point.value)}%` }}
            />
          ))}
          <span
            className="absolute -translate-x-1/2 -translate-y-[calc(100%+8px)] text-[13px] font-semibold text-ink-black tabular-nums"
            style={{ left: `${x(last)}%`, top: `${y(points[last].value)}%` }}
          >
            {percent(points[last].value, locale)}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-[40px_minmax(0,1fr)] gap-8" aria-hidden="true">
        <span />
        <div className="relative mx-16 h-[16px] text-[12px] text-warm-gray">
          {points.map((point, index) => (
            <span
              key={`${point.at}-${index}`}
              className="absolute -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${x(index)}%` }}
            >
              {shortDay(point.at, locale)}
            </span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>{tr(t.trendTitle, { metric: label })}</caption>
        <thead>
          <tr>
            <th scope="col">{t.run}</th>
            <th scope="col">{t.value}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point, index) => (
            <tr key={`${rate}-${point.at}-${index}`}>
              <td>{shortDay(point.at, locale)}</td>
              <td>{percent(point.value, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

// The home's numbers: the newest harness run's metrics (profile-metrics,
// read from the profile revisions) as stat tiles with the change since the
// previous run, how much of the AI output verification backed, and the
// chosen rate across the newest runs. It loads once per visit.
export function ProfileMetrics({
  accessToken,
  locale,
  between,
}: {
  accessToken: string;
  locale: Locale;
  // What the home places between the numbers and their trend (the next
  // step and the evolution summary), so the indicators lead the page.
  between?: ReactNode;
}) {
  const t = labels(locale).metrics;
  const base = locale === 'es' ? '/es' : '';
  const [state, setState] = useState<MetricsState>({ kind: 'loading' });
  const [rate, setRate] = useState<Rate>('completeness_score');
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      setState({ kind: 'ready', points: (await fetchHarnessOutputs(tokenRef.current)).metrics });
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

  // The next step and evolution stay on the page whatever the numbers do
  // (loading, failed, or no run yet).
  const withBetween = (node: ReactNode) => (
    <div className="grid gap-32">
      {node}
      {between}
    </div>
  );

  if (state.kind === 'loading') {
    return withBetween(
      <section
        aria-label={t.loadingAria}
        className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-12"
      >
        {[0, 1, 2, 3].map((index) => (
          <Tile key={index}>
            <Skeleton width={110} height={12} />
            <Skeleton width={80} height={28} />
            <Skeleton width="100%" height={6} />
          </Tile>
        ))}
      </section>,
    );
  }

  if (state.kind === 'error') {
    return withBetween(
      <section className={workspacePanel} aria-label={t.title}>
        <p role="alert" className="m-0 text-[14px] text-soot">
          {t.loadFailed}
        </p>
        <div>
          <button type="button" className={ghostButton} onClick={() => void load()}>
            {t.retry}
          </button>
        </div>
      </section>,
    );
  }

  const points = state.points;
  if (!points.length) {
    return withBetween(
      <section className={workspacePanel} aria-label={t.title}>
        <p className="m-0 text-[14px] text-warm-gray">{t.noRun}</p>
      </section>,
    );
  }

  const current = points[points.length - 1];
  const previous = points.length > 1 ? points[points.length - 2].metrics : null;
  const previousAt = points.length > 1 ? points[points.length - 2].at : null;
  const toReview = current.metrics.suggestions.partial + current.metrics.suggestions.inferred;
  const counts = current.metrics.suggestions;
  const ai = labels(locale).ai;
  const selected = rates.find((item) => item.key === rate) ?? rates[0];
  const series = points.flatMap((point) => {
    const value = point.metrics[selected.key];
    return typeof value === 'number' ? [{ at: point.at, value }] : [];
  });

  return (
    <div className="grid gap-32">
      <section aria-label={t.title} className="grid gap-8">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-12">
          {rates.map((item, index) => (
            <RateTile
              key={item.key}
              order={index}
              since={previousAt}
              rate={item.key}
              label={t[item.label]}
              current={current.metrics}
              previous={previous}
              locale={locale}
            />
          ))}
          <Tile order={rates.length}>
            <span className="text-[13px] text-warm-gray">{t.aiOutput}</span>
            <div className="flex flex-wrap items-baseline gap-8">
              <span className="font-roobert text-[28px] leading-[1.1] font-semibold text-ink-black tabular-nums">
                {`${counts.supported}/${counts.total}`}
              </span>
              <span className="sr-only">
                {tr(t.aiOutputOf, {
                  supported: String(counts.supported),
                  total: String(counts.total),
                })}
              </span>
            </div>
            {toReview > 0 ? (
              <StateChip tone="pending">{tr(t.aiPending, { count: String(toReview) })}</StateChip>
            ) : null}
            <span className="text-[12px] text-warm-gray">
              {[
                tr(ai.qualityPartial, { count: String(counts.partial) }),
                tr(ai.qualityBlocked, { count: String(counts.blocked) }),
              ].join(' · ')}
            </span>
            <Link
              className={cx(linkClass, 'text-[13px] font-medium')}
              href={`${base}/app/profile/`}
            >
              {ai.title}
            </Link>
          </Tile>
        </div>
        <p className="m-0 text-[12px] text-warm-gray">
          {tr(t.asOfRun, { date: shortDay(current.at, locale) })}
        </p>
      </section>

      {between}

      <section
        className={workspacePanel}
        aria-label={tr(t.trendTitle, { metric: t[selected.label] })}
      >
        <div className="flex flex-wrap items-center justify-between gap-12">
          <h2 className="m-0 font-roobert text-title-sm font-medium text-ink-black">
            {tr(t.trendTitle, { metric: t[selected.label] })}
          </h2>
          <div
            role="group"
            aria-label={t.trendGroup}
            className="flex flex-wrap gap-4 rounded-full bg-stone-canvas p-4"
          >
            {rates.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={item.key === rate}
                onClick={() => setRate(item.key)}
                className={cx(
                  'min-h-[36px] cursor-pointer rounded-full border-none px-12 [font-family:inherit] text-[13px] font-medium',
                  item.key === rate
                    ? 'bg-pure-white text-ink-black shadow-[0_1px_2px_rgba(0,0,0,0.08)]'
                    : 'bg-transparent text-warm-gray hover:text-ink-black',
                )}
              >
                {t[item.label]}
              </button>
            ))}
          </div>
        </div>
        {series.length >= 2 ? (
          <TrendChart
            rate={selected.key}
            label={t[selected.label]}
            points={series}
            locale={locale}
          />
        ) : (
          <p className="m-0 text-[14px] text-warm-gray">{t.trendNoteRuns}</p>
        )}
      </section>
    </div>
  );
}
