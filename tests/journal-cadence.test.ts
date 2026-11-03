// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/journal', () => ({
  fetchJournalEntries: vi.fn(),
}));

import { JournalCadenceChart } from '../components/journal-cadence';
import { fetchJournalEntries } from '@/lib/api/journal';
import { labels, tr } from '../lib/i18n';
import { journalCadence, weekStart } from '../lib/journal-cadence';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

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

const stored = (id: number, date: string, evidence = true) => ({
  id: `44444444-4444-4444-8444-${String(id).padStart(12, '0')}`,
  text: 'Entry.',
  occurred_at: `${date}T00:00:00Z`,
  created_at: '2026-11-03T10:00:00Z',
  user_confirmed_as_evidence: evidence,
  linked_skill_ids: [],
  consent_version: 'journal-v1',
});

describe('JournalCadenceChart', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    container?.remove();
    root = null;
    vi.mocked(fetchJournalEntries).mockReset();
  });

  async function render(locale: 'en' | 'es' = 'en') {
    container = document.createElement('div');
    document.body.appendChild(container);
    await act(async () => {
      root = createRoot(container as HTMLDivElement);
      root.render(
        createElement(JournalCadenceChart, { accessToken: 'token', locale, now: () => now }),
      );
    });
  }

  const weeks = () => [...document.querySelectorAll('ol > li')];

  it('reads up to 200 entries and shows the total, the evidence and one readout per week', async () => {
    vi.mocked(fetchJournalEntries).mockResolvedValue([
      stored(1, '2026-11-03'),
      stored(2, '2026-11-02', false),
      stored(3, '2026-10-21'),
    ]);
    await render('es');
    const c = labels('es').cadence;
    expect(fetchJournalEntries).toHaveBeenCalledWith('token', 200);
    expect(document.body.textContent).toContain(tr(c.headline, { evidence: '2' }));
    expect(weeks()).toHaveLength(12);
    const current = weeks()[11];
    expect(current.getAttribute('aria-label')).toContain('2 entradas, 1 como evidencia');
    expect(current.getAttribute('tabindex')).toBe('0');
    // A week without entries reads zero, never "not loaded".
    expect(weeks()[0].getAttribute('aria-label')).toContain('0 entradas');
    expect(document.querySelector('figcaption')).toBeNull();
  });

  it('says from which day the counts hold when the read was cut', async () => {
    vi.mocked(fetchJournalEntries).mockResolvedValue(
      Array.from({ length: 200 }, (_, index) =>
        stored(index, index < 100 ? '2026-11-03' : '2026-10-21'),
      ),
    );
    await render('en');
    const c = labels('en').cadence;
    expect(document.querySelector('figcaption')?.textContent).toContain('Oct 21');
    expect(weeks()[0].getAttribute('aria-label')).toBe(tr(c.weekUnknown, { week: 'Aug 17' }));
    const cut = weeks().find((week) => week.getAttribute('aria-label')?.includes('Oct 19'));
    expect(cut?.getAttribute('aria-label')).toContain('at least 100');
  });

  it('invites the first entry when the window is empty', async () => {
    vi.mocked(fetchJournalEntries).mockResolvedValue([]);
    await render('en');
    expect(document.body.textContent).toContain(labels('en').cadence.empty);
    expect(weeks()).toHaveLength(0);
  });

  it('says the journal could not be read instead of drawing zeros', async () => {
    vi.mocked(fetchJournalEntries).mockRejectedValue(new Error('network'));
    await render('en');
    expect(document.body.textContent).toContain(labels('en').cadence.failed);
    expect(weeks()).toHaveLength(0);
  });
});
