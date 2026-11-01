// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/benchmark', () => ({
  fetchLatestBenchmark: vi.fn(),
}));

import { ProfileHealthCard } from '../components/profile-health-card';
import { fetchLatestBenchmark } from '@/lib/api/benchmark';
import { labels, type Locale } from '../lib/i18n';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const REV = '11111111-1111-4111-8111-111111111111';
const revision = { id: REV, profile_revision: REV, created_at: '2026-10-31T10:00:00Z' };
const benchmark = (over: number) => ({
  id: '33333333-3333-4333-8333-333333333333',
  revision: REV,
  revision_at: '2026-10-31T10:00:00Z',
  journal_entries_count: 6,
  journal_confirmed_count: 4,
  claim_supported_rate: 0.75,
  over_claimed_rate: over,
  completeness_score: 0.8,
  evolution_mode: 'can_evolve',
  created_at: '2026-10-31T10:05:00Z',
});

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function render(locale: Locale = 'en') {
  await act(async () => {
    root = createRoot(container as HTMLDivElement);
    root.render(createElement(ProfileHealthCard, { accessToken: 'token', locale }));
  });
}

beforeEach(() => {
  vi.mocked(fetchLatestBenchmark).mockReset();
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
  }
  container?.remove();
  root = null;
});

describe('ProfileHealthCard', () => {
  it('shows the three meters with their values in text and the journal counts', async () => {
    vi.mocked(fetchLatestBenchmark).mockResolvedValue({ revision, benchmark: benchmark(0.1) });
    await render('en');
    const t = labels('en').health;
    const meters = [...document.querySelectorAll('[role="meter"]')];
    expect(meters.map((m) => m.getAttribute('aria-label'))).toEqual([
      t.completeness,
      t.supported,
      t.overClaimed,
    ]);
    expect(meters.map((m) => m.getAttribute('aria-valuenow'))).toEqual(['80', '75', '10']);
    expect(document.body.textContent).toContain('80%');
    expect(document.body.textContent).toContain(t.entries);
    expect(document.body.textContent).toContain('6');
    expect(document.body.textContent).not.toContain(t.overClaimedHigh);
  });

  it('names the action when the claims above the evidence pass the threshold', async () => {
    vi.mocked(fetchLatestBenchmark).mockResolvedValue({ revision, benchmark: benchmark(0.35) });
    await render('es');
    expect(document.body.textContent).toContain(labels('es').health.overClaimedHigh);
    expect(document.body.textContent).toContain('35');
  });

  it('explains the empty states before a revision and before its benchmark', async () => {
    vi.mocked(fetchLatestBenchmark).mockResolvedValueOnce(null);
    await render('en');
    expect(document.body.textContent).toContain(labels('en').health.none);
    act(() => root?.unmount());
    root = null;
    vi.mocked(fetchLatestBenchmark).mockResolvedValueOnce({ revision, benchmark: null });
    await render('en');
    expect(document.body.textContent).toContain(labels('en').health.pending);
  });

  it('marks an unmeasured rate instead of drawing it', async () => {
    vi.mocked(fetchLatestBenchmark).mockResolvedValue({
      revision,
      benchmark: { ...benchmark(0.1), claim_supported_rate: null },
    });
    await render('en');
    const meter = document.querySelectorAll('[role="meter"]')[1];
    expect(meter?.getAttribute('aria-valuenow')).toBeNull();
    expect(meter?.getAttribute('aria-valuetext')).toBe(labels('en').health.notMeasured);
  });

  it('offers a retry when loading fails', async () => {
    vi.mocked(fetchLatestBenchmark).mockRejectedValueOnce(new Error('network'));
    await render('en');
    const t = labels('en').health;
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(t.loadFailed);
    vi.mocked(fetchLatestBenchmark).mockResolvedValue({ revision, benchmark: benchmark(0.1) });
    await act(async () => {
      [...document.querySelectorAll('button')].find((b) => b.textContent === t.retry)?.click();
    });
    expect(document.querySelectorAll('[role="meter"]')).toHaveLength(3);
  });
});
