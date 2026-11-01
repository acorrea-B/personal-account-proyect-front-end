// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/cv', () => ({ getVersions: vi.fn(), fetchCvText: vi.fn() }));
vi.mock('@/lib/api/journal', () => ({ fetchJournalEntries: vi.fn() }));
vi.mock('@/lib/api/evolution', () => ({ fetchEvolutionHistory: vi.fn() }));

import { RecentActivity, activityLimit, cvSaves } from '../components/recent-activity';
import { ProblemError } from '@/lib/api/client';
import { fetchCvText, getVersions } from '@/lib/api/cv';
import { fetchEvolutionHistory } from '@/lib/api/evolution';
import { fetchJournalEntries } from '@/lib/api/journal';
import { labels, tr } from '../lib/i18n';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const uuid = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const version = (n: number, at: string) => ({
  id: uuid(n),
  origin: 'user' as const,
  archived_at: at,
});
const entry = (n: number, at: string, evidence: boolean) => ({
  id: uuid(100 + n),
  occurred_at: at,
  text: 'private text',
  user_confirmed_as_evidence: evidence,
  linked_skill_ids: [],
  consent_version: 'journal-v1',
  created_at: at,
});
const check = (n: number, at: string) => ({
  id: uuid(200 + n),
  verdict: 'on_track' as const,
  metric: 'completeness_score',
  delta: 0.1,
  action_type: 'keep_going',
  target_ref: 'profile',
  rationale: 'Steady.',
  created_at: at,
});

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function render(token = 'token') {
  await act(async () => {
    root ??= createRoot(container as HTMLDivElement);
    root.render(createElement(RecentActivity, { accessToken: token, locale: 'es' }));
  });
}

const rows = () =>
  [...document.querySelectorAll('li')].map((li) => li.querySelectorAll('span')[1]?.textContent);

const kinds = () =>
  [...document.querySelectorAll('li')].map((li) => li.querySelector('span')?.textContent);

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  vi.mocked(getVersions).mockReset().mockResolvedValue([]);
  vi.mocked(fetchCvText)
    .mockReset()
    .mockRejectedValue(new ProblemError({ status: 404 }));
  vi.mocked(fetchJournalEntries).mockReset().mockResolvedValue([]);
  vi.mocked(fetchEvolutionHistory).mockReset().mockResolvedValue([]);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('RecentActivity', () => {
  it('merges the sources newest first, bounded to the limit, without the entry text', async () => {
    vi.mocked(getVersions).mockResolvedValue([
      version(1, '2026-10-28T10:00:00Z'),
      version(2, '2026-09-01T10:00:00Z'),
    ]);
    vi.mocked(fetchJournalEntries).mockResolvedValue([
      entry(1, '2026-10-29T10:00:00Z', true),
      entry(2, '2026-10-20T10:00:00Z', false),
    ]);
    vi.mocked(fetchEvolutionHistory).mockResolvedValue([
      check(1, '2026-10-27T10:00:00Z'),
      check(2, '2026-08-01T10:00:00Z'),
    ]);
    await render();
    const a = labels('es').activity;
    expect(rows()).toEqual([
      a.journalEvidence,
      a.cvSaved,
      tr(a.check, { verdict: labels('es').evolution.on_track }),
      a.journalPlain,
      a.cvSaved,
    ]);
    expect(rows()).toHaveLength(activityLimit);
    // Each event carries a neutral label naming its kind.
    expect(kinds()).toEqual([a.kindJournal, a.kindCv, a.kindCheck, a.kindJournal, a.kindCv]);
    expect(document.body.textContent).not.toContain('private text');
    expect(fetchJournalEntries).toHaveBeenCalledWith('token', activityLimit);
  });

  it('lists what loaded when a source fails, with a short note', async () => {
    vi.mocked(fetchJournalEntries).mockRejectedValue(new ProblemError({ status: 403 }));
    vi.mocked(getVersions).mockResolvedValue([version(1, '2026-10-28T10:00:00Z')]);
    await render();
    const a = labels('es').activity;
    expect(rows()).toEqual([a.cvSaved]);
    expect(document.body.textContent).toContain(a.partial);
  });

  it('invites to use the workspace when there is no activity yet', async () => {
    await render();
    expect(document.body.textContent).toContain(labels('es').activity.empty);
  });

  it('never reloads when the session renews its token', async () => {
    await render('token-1');
    await render('token-2');
    expect(getVersions).toHaveBeenCalledTimes(1);
  });
  it('lists the first cv save, which leaves no archived version', async () => {
    vi.mocked(fetchCvText).mockResolvedValue({
      id: uuid(9),
      content: '# Juan',
      created_at: '2026-10-01T10:00:00Z',
      updated_at: '2026-10-30T10:00:00Z',
    });
    await render();
    expect(rows()).toEqual([labels('es').activity.cvSaved]);
    expect(document.body.textContent).not.toContain(labels('es').activity.partial);
  });
});

describe('cvSaves', () => {
  it('counts the current save and the archive it made once', () => {
    expect(
      cvSaves('2026-10-28T10:00:00.400Z', ['2026-10-28T10:00:00Z', '2026-09-01T10:00:00Z']),
    ).toEqual(['2026-10-28T10:00:00.400Z', '2026-09-01T10:00:00Z']);
    expect(cvSaves(null, [])).toEqual([]);
    expect(cvSaves('2026-10-30T10:00:00Z', [])).toEqual(['2026-10-30T10:00:00Z']);
  });
});
