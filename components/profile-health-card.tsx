'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { formatWhen } from '@/components/cv-timeline';
import { Skeleton } from '@/components/skeleton';
import { Eyebrow, cx, ghostButton, workspacePanel } from '@/components/ui';
import { fetchLatestBenchmark } from '@/lib/api/benchmark';
import { type Locale, labels, tr } from '@/lib/i18n';
import type { Benchmark, ProfileRevision } from '@/lib/schemas/benchmark';

type HealthState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; latest: { revision: ProfileRevision; benchmark: Benchmark | null } | null };

// Above this share of claims beyond the evidence the meter turns alert
// and names the action; below it stays the calm accent.
const overClaimedAlert = 0.2;

function percent(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'es' ? 'es' : 'en-US', {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(value);
}

// One ratio against its limit (the dataviz meter): label and value in text
// tokens, the fill carrying the state and the track a lighter step of the
// same ramp, so the number never rides on color alone.
function Meter({
  label,
  value,
  locale,
  alert,
  note,
  notMeasured,
}: {
  label: string;
  value: number | null | undefined;
  locale: Locale;
  alert?: boolean;
  note?: string;
  notMeasured: string;
}) {
  const measured = typeof value === 'number';
  return (
    <div className="grid gap-4">
      <div className="flex items-baseline justify-between gap-8">
        <span className="text-[14px] text-ink-black">{label}</span>
        <span className="text-[14px] font-semibold text-ink-black tabular-nums">
          {measured ? percent(value, locale) : notMeasured}
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={measured ? Math.round(value * 100) : undefined}
        aria-valuetext={measured ? percent(value, locale) : notMeasured}
        className={cx(
          'h-[8px] overflow-hidden rounded-full',
          alert ? 'bg-[rgba(185,28,28,0.12)]' : 'bg-sky-wash-soft',
        )}
      >
        {measured ? (
          <div
            className={cx('h-full rounded-full', alert ? 'bg-alert' : 'bg-cyan-text-strong')}
            style={{ width: `${Math.max(value * 100, value > 0 ? 2 : 0)}%` }}
          />
        ) : null}
      </div>
      {note ? (
        <span className="text-(length:--text-label) font-medium text-alert">{note}</span>
      ) : null}
    </div>
  );
}

// A count as a stat tile: label over the value.
function Tile({ label, value, locale }: { label: string; value: number; locale: Locale }) {
  return (
    <div className="grid gap-4 rounded-lg border border-stone-border p-12">
      <span className="text-(length:--text-label) text-warm-gray">{label}</span>
      <span className="font-roobert text-(length:--text-subheading) font-semibold text-ink-black tabular-nums">
        {new Intl.NumberFormat(locale === 'es' ? 'es' : 'en-US').format(value)}
      </span>
    </div>
  );
}

// The dashboard's profile health (BC-002/BC-007): the benchmark the harness
// computed for the newest profile revision — completeness, the share of
// claims backed by evidence and the share above it — and the journal
// counts behind it. It loads once per visit.
export function ProfileHealthCard({
  accessToken,
  locale,
}: {
  accessToken: string;
  locale: Locale;
}) {
  const t = labels(locale).health;
  const [state, setState] = useState<HealthState>({ kind: 'loading' });

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      setState({ kind: 'ready', latest: await fetchLatestBenchmark(accessToken) });
    } catch {
      setState({ kind: 'error' });
    }
  }, [accessToken]);

  const loaded = useRef(false);
  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      void load();
    }
  }, [load]);

  return (
    <section className={workspacePanel} aria-label={t.title}>
      <Eyebrow>{t.title}</Eyebrow>
      {state.kind === 'loading' ? (
        <div className="grid gap-12" aria-label={t.loadingAria}>
          <Skeleton width="100%" height={8} />
          <Skeleton width="100%" height={8} />
          <Skeleton width="100%" height={8} />
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
      ) : !state.latest ? (
        <p className="m-0 text-[14px] text-warm-gray">{t.none}</p>
      ) : !state.latest.benchmark ? (
        <p className="m-0 text-[14px] text-warm-gray">{t.pending}</p>
      ) : (
        <>
          <div className="grid gap-16">
            <Meter
              label={t.completeness}
              value={state.latest.benchmark.completeness_score}
              locale={locale}
              notMeasured={t.notMeasured}
            />
            <Meter
              label={t.supported}
              value={state.latest.benchmark.claim_supported_rate}
              locale={locale}
              notMeasured={t.notMeasured}
            />
            <Meter
              label={t.overClaimed}
              value={state.latest.benchmark.over_claimed_rate}
              locale={locale}
              notMeasured={t.notMeasured}
              alert={(state.latest.benchmark.over_claimed_rate ?? 0) > overClaimedAlert}
              note={
                (state.latest.benchmark.over_claimed_rate ?? 0) > overClaimedAlert
                  ? t.overClaimedHigh
                  : undefined
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-8">
            <Tile
              label={t.entries}
              value={state.latest.benchmark.journal_entries_count}
              locale={locale}
            />
            <Tile
              label={t.confirmed}
              value={state.latest.benchmark.journal_confirmed_count}
              locale={locale}
            />
          </div>
          <p className="m-0 text-(length:--text-label) text-warm-gray">
            {tr(t.asOf, { date: formatWhen(state.latest.revision.created_at, locale) })}
          </p>
        </>
      )}
    </section>
  );
}
