'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { formatWhen } from '@/components/cv-timeline';
import { Skeleton } from '@/components/skeleton';
import { workspacePanel } from '@/components/ui';
import { getVersions } from '@/lib/api/cv';
import { fetchEvolutionHistory } from '@/lib/api/evolution';
import { fetchJournalEntries } from '@/lib/api/journal';
import { type Locale, labels, tr } from '@/lib/i18n';

export type ActivityItem = { id: string; at: string; text: string };

// How many events the home lists, and how many each source contributes
// at most (the newest of each).
export const activityLimit = 5;

type ActivityState =
  { kind: 'loading' } | { kind: 'ready'; items: ActivityItem[]; partial: boolean };

// The home's recent activity: the newest events across the workspace
// (cv saves, journal entries, harness evolution checks), newest first.
// Each source answers on its own; one failing (a journal without consent,
// a rate cap) leaves the others listed with a short note. Loads once.
export function RecentActivity({ accessToken, locale }: { accessToken: string; locale: Locale }) {
  const t = labels(locale);
  const a = t.activity;
  const [state, setState] = useState<ActivityState>({ kind: 'loading' });
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;

  const load = useCallback(async () => {
    const token = tokenRef.current;
    const [versions, entries, checks] = await Promise.allSettled([
      getVersions(token),
      fetchJournalEntries(token, activityLimit),
      fetchEvolutionHistory(token, activityLimit),
    ]);
    const items: ActivityItem[] = [
      ...(versions.status === 'fulfilled'
        ? versions.value.slice(0, activityLimit).map((version) => ({
            id: `cv-${version.id}`,
            at: version.archived_at,
            text: a.cvSaved,
          }))
        : []),
      ...(entries.status === 'fulfilled'
        ? entries.value.map((entry) => ({
            id: `journal-${entry.id}`,
            at: entry.created_at,
            text: entry.user_confirmed_as_evidence ? a.journalEvidence : a.journalPlain,
          }))
        : []),
      ...(checks.status === 'fulfilled'
        ? checks.value.map((check) => ({
            id: `check-${check.id}`,
            at: check.created_at,
            text: tr(a.check, { verdict: t.evolution[check.verdict] }),
          }))
        : []),
    ]
      .sort((left, right) => Date.parse(right.at) - Date.parse(left.at))
      .slice(0, activityLimit);
    setState({
      kind: 'ready',
      items,
      partial: [versions, entries, checks].some((result) => result.status === 'rejected'),
    });
  }, [a, t.evolution]);

  const loaded = useRef(false);
  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      void load();
    }
  }, [load]);

  return (
    <section className={workspacePanel} aria-label={a.title}>
      <h2 className="m-0 font-roobert text-title-sm font-medium text-ink-black">{a.title}</h2>
      {state.kind === 'loading' ? (
        <div className="grid gap-12" aria-label={a.loadingAria}>
          <Skeleton width="100%" height={14} />
          <Skeleton width="80%" height={14} />
          <Skeleton width="90%" height={14} />
        </div>
      ) : state.items.length ? (
        <ul className="m-0 grid list-none p-0">
          {state.items.map((item) => (
            <li
              key={item.id}
              className="flex items-baseline justify-between gap-12 border-t border-stone-border py-12 text-[14px] text-ink-black first:border-t-0 first:pt-0"
            >
              <span>{item.text}</span>
              <time dateTime={item.at} className="shrink-0 text-[13px] text-warm-gray">
                {formatWhen(item.at, locale)}
              </time>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-[14px] text-warm-gray">{a.empty}</p>
      )}
      {state.kind === 'ready' && state.partial ? (
        <p className="m-0 text-[12px] text-warm-gray">{a.partial}</p>
      ) : null}
    </section>
  );
}
