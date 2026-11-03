import { describe, expect, it } from 'vitest';

import { journalCadence, weekStart } from '../lib/journal-cadence';

const day = (date: string, evidence = true) => ({
  occurred_at: `${date}T00:00:00Z`,
  user_confirmed_as_evidence: evidence,
});
// A Tuesday: its week starts on Monday 2026-11-02.
const now = new Date('2026-11-03T15:00:00Z');

describe('weekStart', () => {
  it('returns the Monday of the week, in UTC', () => {
    expect(weekStart(new Date('2026-11-03T00:00:00Z'))).toBe('2026-11-02');
    expect(weekStart(new Date('2026-11-02T00:00:00Z'))).toBe('2026-11-02');
    // Sunday belongs to the week that started six days before.
    expect(weekStart(new Date('2026-11-08T23:59:00Z'))).toBe('2026-11-02');
    expect(weekStart(new Date('2026-11-09T00:00:00Z'))).toBe('2026-11-09');
  });
});

describe('journalCadence', () => {
  it('counts entries and evidence per week, oldest week first, ending this week', () => {
    const cadence = journalCadence(
      [day('2026-11-03'), day('2026-11-02', false), day('2026-10-27'), day('2026-10-20')],
      now,
      false,
    );
    expect(cadence.weeks).toHaveLength(12);
    expect(cadence.weeks[11]).toEqual({
      start: '2026-11-02',
      entries: 2,
      evidence: 1,
      known: true,
      partial: false,
    });
    expect(cadence.weeks[10].entries).toBe(1);
    expect(cadence.weeks[9].start).toBe('2026-10-19');
    expect(cadence.weeks[0].start).toBe('2026-08-17');
    expect(cadence.entries).toBe(4);
    expect(cadence.evidence).toBe(3);
    expect(cadence.coveredFrom).toBeNull();
  });

  it('reads a week without entries as zero, not as unknown', () => {
    const cadence = journalCadence([day('2026-11-03')], now, false);
    expect(cadence.weeks[5]).toMatchObject({ entries: 0, known: true, partial: false });
  });

  it('leaves out entries outside the window', () => {
    const cadence = journalCadence([day('2026-08-16'), day('2026-11-09')], now, false);
    expect(cadence.entries).toBe(0);
  });

  it('marks the weeks older than a cut list as unknown and the cut week as partial', () => {
    // The read came back full: its oldest entry is 2026-10-21, so older
    // entries may exist that it did not load.
    const cadence = journalCadence([day('2026-11-03'), day('2026-10-21')], now, true);
    const cut = cadence.weeks.findIndex((week) => week.start === '2026-10-19');
    expect(cadence.weeks[cut]).toMatchObject({ known: true, partial: true, entries: 1 });
    expect(cadence.weeks.slice(0, cut).every((week) => !week.known)).toBe(true);
    expect(cadence.weeks.slice(cut + 1).every((week) => week.known && !week.partial)).toBe(true);
    expect(cadence.coveredFrom).toBe('2026-10-21');
  });

  it('keeps every week known when a full list already reaches past the window', () => {
    const cadence = journalCadence([day('2026-11-03'), day('2026-05-01')], now, true);
    expect(cadence.weeks.every((week) => week.known && !week.partial)).toBe(true);
    expect(cadence.coveredFrom).toBeNull();
  });

  it('reports the cover date when the cut falls in the first week of the window', () => {
    const cadence = journalCadence([day('2026-08-18')], now, true);
    expect(cadence.weeks[0]).toMatchObject({ partial: true, known: true });
    expect(cadence.coveredFrom).toBe('2026-08-18');
  });
});
