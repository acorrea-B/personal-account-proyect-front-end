'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Skeleton } from '@/components/skeleton';
import { cx, linkClass, workspacePanel } from '@/components/ui';
import { fetchJournalEntries } from '@/lib/api/journal';
import { type Locale, labels, tr } from '@/lib/i18n';
import { type JournalCadence, journalCadence } from '@/lib/journal-cadence';
import { journalListMax } from '@/lib/schemas/journal';

type CadenceState =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; cadence: JournalCadence };

function shortWeek(start: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es' : 'en', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${start}T00:00:00Z`));
}

// The home's journal chart: entries per week over the last 12 weeks, so
// the person sees whether the habit holds and how much of it counts as
// evidence. One series (entries); evidence is the headline and each
// week's readout. Loads once; a failed read leaves the rest of the home.
export function JournalCadenceChart({
  accessToken,
  locale,
  now = () => new Date(),
}: {
  accessToken: string;
  locale: Locale;
  now?: () => Date;
}) {
  const c = labels(locale).cadence;
  const [state, setState] = useState<CadenceState>({ kind: 'loading' });
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;
  const nowRef = useRef(now);

  const load = useCallback(async () => {
    try {
      const entries = await fetchJournalEntries(tokenRef.current, journalListMax);
      setState({
        kind: 'ready',
        cadence: journalCadence(entries, nowRef.current(), entries.length >= journalListMax),
      });
    } catch {
      setState({ kind: 'failed' });
    }
  }, []);

  const loaded = useRef(false);
  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      void load();
    }
  }, [load]);

  const base = locale === 'es' ? '/es' : '';
  return (
    <section className={workspacePanel} aria-label={c.title}>
      <div className="flex flex-wrap items-baseline justify-between gap-8">
        <h2 className="m-0 font-roobert text-title-sm font-medium text-ink-black">{c.title}</h2>
        <Link className={cx(linkClass, 'text-[14px] font-medium')} href={`${base}/app/journal/`}>
          {c.open}
        </Link>
      </div>
      {state.kind === 'loading' ? (
        <div className="grid gap-12" aria-label={c.loadingAria}>
          <Skeleton width={180} height={28} />
          <Skeleton width="100%" height={120} />
        </div>
      ) : state.kind === 'failed' ? (
        <p className="m-0 text-[14px] text-warm-gray">{c.failed}</p>
      ) : state.cadence.entries === 0 && state.cadence.coveredFrom === null ? (
        <p className="m-0 text-[14px] text-warm-gray">{c.empty}</p>
      ) : (
        <CadenceFigure cadence={state.cadence} locale={locale} />
      )}
    </section>
  );
}

function CadenceFigure({ cadence, locale }: { cadence: JournalCadence; locale: Locale }) {
  const c = labels(locale).cadence;
  const peak = Math.max(1, ...cadence.weeks.map((week) => week.entries));
  const last = cadence.weeks.length - 1;
  const ticks = [0, Math.floor(last / 2), last];
  return (
    <figure className="m-0 grid gap-12">
      <p className="m-0 flex flex-wrap items-baseline gap-x-8 text-[14px] text-soot">
        <span className="font-roobert text-[28px] leading-none font-medium text-ink-black tabular-nums">
          {cadence.entries}
        </span>
        <span>{tr(c.headline, { evidence: String(cadence.evidence) })}</span>
      </p>
      <div className="grid grid-cols-[24px_minmax(0,1fr)] gap-8">
        <div
          aria-hidden="true"
          className="relative h-[120px] text-right text-[12px] text-warm-gray tabular-nums"
        >
          <span className="absolute top-0 right-0 -translate-y-1/2">{peak}</span>
          <span className="absolute right-0 bottom-0 translate-y-1/2">0</span>
        </div>
        {/* Each week is a list item with its own readout, so the chart is
            also its table: a screen reader or keyboard walks the weeks. */}
        <ol
          aria-label={c.chartAria}
          className="m-0 grid h-[120px] list-none grid-cols-12 items-end border-b border-stone-muted p-0"
        >
          {cadence.weeks.map((week, index) => {
            const label = !week.known
              ? tr(c.weekUnknown, { week: shortWeek(week.start, locale) })
              : tr(week.partial ? c.weekPartial : c.week, {
                  week: shortWeek(week.start, locale),
                  entries: String(week.entries),
                  evidence: String(week.evidence),
                });
            return (
              <li
                key={week.start}
                tabIndex={0}
                aria-label={label}
                className="group relative flex h-full items-end justify-center outline-none focus-visible:ring-2 focus-visible:ring-cyan-text"
              >
                {week.known && week.entries > 0 ? (
                  <span
                    aria-hidden="true"
                    className={cx(
                      'block w-full max-w-[24px] rounded-t-[4px] group-hover:opacity-80',
                      week.partial
                        ? 'bg-[repeating-linear-gradient(45deg,var(--color-cyan-text-strong)_0_3px,var(--color-sky-wash)_3px_6px)]'
                        : 'bg-cyan-text-strong',
                    )}
                    style={{ height: `${(week.entries / peak) * 100}%` }}
                  />
                ) : null}
                {index === last && week.known ? (
                  <span
                    aria-hidden="true"
                    className="absolute left-1/2 -translate-x-1/2 text-[13px] font-semibold text-ink-black tabular-nums"
                    style={{ bottom: `calc(${(week.entries / peak) * 100}% + 4px)` }}
                  >
                    {week.entries}
                  </span>
                ) : null}
                <span
                  aria-hidden="true"
                  className={cx(
                    'pointer-events-none invisible absolute bottom-[calc(100%+8px)] z-10 w-max max-w-[200px] rounded-lg bg-ink-black px-8 py-4 text-[12px] text-pure-white group-hover:visible group-focus-visible:visible',
                    // The edge weeks open their readout inward, never past the panel.
                    index < 2
                      ? 'left-0'
                      : index > last - 2
                        ? 'right-0'
                        : 'left-1/2 -translate-x-1/2',
                  )}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <div
        aria-hidden="true"
        className="ml-[32px] flex justify-between text-[12px] text-warm-gray tabular-nums"
      >
        {ticks.map((index) => (
          <span key={index}>{shortWeek(cadence.weeks[index].start, locale)}</span>
        ))}
      </div>
      {cadence.coveredFrom ? (
        <figcaption className="text-[12px] text-warm-gray">
          {tr(c.coveredFrom, { day: shortWeek(cadence.coveredFrom, locale) })}
        </figcaption>
      ) : null}
    </figure>
  );
}
