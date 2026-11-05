import type { JournalEntry } from '@/lib/schemas/journal';

// How many weeks the home's journal chart covers, the current one included.
export const cadenceWeeks = 12;

const dayMs = 24 * 60 * 60 * 1000;

// One week of the chart. `known` is false for a week older than the
// entries the list could load (the api lists the newest by occurred_at up
// to a limit): its count is not zero, it is unknown. `partial` marks the
// week where the loaded entries stop, which may miss some of its entries.
export type CadenceWeek = {
  start: string;
  entries: number;
  evidence: number;
  known: boolean;
  partial: boolean;
};

export type JournalCadence = {
  weeks: CadenceWeek[];
  entries: number;
  evidence: number;
  // The first day the counts cover when the list was cut, else null.
  coveredFrom: string | null;
};

// The Monday (UTC) of the week holding `at`, as YYYY-MM-DD. The entries
// carry their day at midnight UTC, so weeks are read in UTC as well.
export function weekStart(at: Date): string {
  const day = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
  const sinceMonday = (new Date(day).getUTCDay() + 6) % 7;
  return new Date(day - sinceMonday * dayMs).toISOString().slice(0, 10);
}

// Entries per week (by the day they happened) for the last `weeks` weeks,
// oldest first. `listFull` says the read returned as many entries as it
// asked for, so older ones may exist that it did not load.
export function journalCadence(
  entries: Pick<JournalEntry, 'occurred_at' | 'user_confirmed_as_evidence'>[],
  now: Date,
  listFull: boolean,
  weeks = cadenceWeeks,
): JournalCadence {
  const current = Date.parse(`${weekStart(now)}T00:00:00Z`);
  const starts = Array.from({ length: weeks }, (_, index) =>
    new Date(current - (weeks - 1 - index) * 7 * dayMs).toISOString().slice(0, 10),
  );
  const oldest = entries.reduce<string | null>((found, entry) => {
    const day = entry.occurred_at.slice(0, 10);
    return found === null || day < found ? day : found;
  }, null);
  const cutWeek = listFull && oldest ? weekStart(new Date(`${oldest}T00:00:00Z`)) : null;

  const rows: CadenceWeek[] = starts.map((start) => ({
    start,
    entries: 0,
    evidence: 0,
    known: cutWeek === null || start >= cutWeek,
    partial: start === cutWeek,
  }));
  const index = new Map(starts.map((start, position) => [start, position]));
  for (const entry of entries) {
    const row = index.get(weekStart(new Date(entry.occurred_at)));
    if (row === undefined) {
      continue;
    }
    rows[row].entries += 1;
    if (entry.user_confirmed_as_evidence) {
      rows[row].evidence += 1;
    }
  }
  const covered = cutWeek !== null && cutWeek >= starts[0] ? oldest : null;
  return {
    weeks: rows,
    entries: rows.reduce((sum, row) => sum + row.entries, 0),
    evidence: rows.reduce((sum, row) => sum + row.evidence, 0),
    coveredFrom: covered,
  };
}
