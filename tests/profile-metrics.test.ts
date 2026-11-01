// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/benchmark', () => ({
  fetchBenchmarkTrend: vi.fn(),
}));

import { ProfileMetrics, deltaPoints } from '../components/profile-metrics';
import { fetchBenchmarkTrend } from '@/lib/api/benchmark';
import { labels, tr, type Locale } from '../lib/i18n';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const point = (
  day: number,
  rates: { completeness: number; supported: number; over: number } | null,
  entries = 14,
  confirmed = 9,
) => ({
  revision: {
    id: `11111111-1111-4111-8111-${String(day).padStart(12, '0')}`,
    profile_revision: 'r',
    created_at: `2026-10-${String(day).padStart(2, '0')}T10:00:00Z`,
  },
  benchmark: rates
    ? {
        id: `33333333-3333-4333-8333-${String(day).padStart(12, '0')}`,
        revision_at: `2026-10-${String(day).padStart(2, '0')}T10:00:00Z`,
        journal_entries_count: entries,
        journal_confirmed_count: confirmed,
        completeness_score: rates.completeness,
        claim_supported_rate: rates.supported,
        over_claimed_rate: rates.over,
        created_at: `2026-10-${String(day).padStart(2, '0')}T10:05:00Z`,
      }
    : null,
});

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function render(locale: Locale = 'en', token = 'token') {
  await act(async () => {
    root ??= createRoot(container as HTMLDivElement);
    root.render(createElement(ProfileMetrics, { accessToken: token, locale }));
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  vi.mocked(fetchBenchmarkTrend).mockReset();
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('deltaPoints', () => {
  it('counts whole points and stays null when a side was not measured', () => {
    expect(deltaPoints(0.72, 0.66)).toBe(6);
    expect(deltaPoints(0.18, 0.21)).toBe(-3);
    expect(deltaPoints(0.5, null)).toBeNull();
    expect(deltaPoints(undefined, 0.5)).toBeNull();
  });
});

describe('ProfileMetrics', () => {
  it('shows the newest measured rates with the change since the previous revision', async () => {
    vi.mocked(fetchBenchmarkTrend).mockResolvedValue([
      point(1, { completeness: 0.66, supported: 0.6, over: 0.21 }),
      point(28, { completeness: 0.72, supported: 0.64, over: 0.18 }),
    ]);
    await render('en');
    const t = labels('en').metrics;
    const meters = [...document.querySelectorAll('[role="meter"]')];
    expect(meters.map((meter) => meter.getAttribute('aria-valuenow'))).toEqual(['72', '64', '18']);
    const text = document.body.textContent ?? '';
    expect(text).toContain(tr(t.up, { points: '6' }));
    // Fewer claims above the evidence is the good direction.
    expect(text).toContain(tr(t.down, { points: '3' }));
    expect(text).toContain(tr(t.evidenceOf, { total: '14' }));
    const confirm = [...document.querySelectorAll('a')].find(
      (link) => link.textContent === tr(t.confirmPending, { count: '5' }),
    );
    expect((confirm?.getAttribute('href') ?? '').replace(/\/+$/, '')).toBe('/app/journal');
  });

  it('draws the chosen rate across the revisions with the numbers as a table', async () => {
    vi.mocked(fetchBenchmarkTrend).mockResolvedValue([
      point(1, { completeness: 0.48, supported: 0.41, over: 0.34 }),
      point(15, { completeness: 0.6, supported: 0.5, over: 0.25 }),
      point(28, { completeness: 0.72, supported: 0.64, over: 0.18 }),
    ]);
    await render('es');
    const t = labels('es').metrics;
    expect(document.querySelector('caption')?.textContent).toBe(
      tr(t.trendTitle, { metric: t.completeness }),
    );
    expect(document.querySelectorAll('tbody tr')).toHaveLength(3);
    const over = [...document.querySelectorAll('button[aria-pressed]')].find(
      (button) => button.textContent === t.overClaimed,
    );
    await act(async () => (over as HTMLButtonElement).click());
    expect(over?.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('caption')?.textContent).toBe(
      tr(t.trendTitle, { metric: t.overClaimed }),
    );
    expect(document.querySelector('tbody tr td:last-child')?.textContent).toMatch(/34/);
  });

  it('turns the claims above the evidence alert past the limit', async () => {
    vi.mocked(fetchBenchmarkTrend).mockResolvedValue([
      point(28, { completeness: 0.7, supported: 0.5, over: 0.3 }),
    ]);
    await render('en');
    const t = labels('en').metrics;
    expect(document.body.textContent).toContain(t.overClaimedHigh);
    expect(document.body.textContent).toContain(t.trendNote);
  });

  it('says when nothing is measured yet', async () => {
    vi.mocked(fetchBenchmarkTrend).mockResolvedValueOnce([]);
    await render('en');
    expect(document.body.textContent).toContain(labels('en').metrics.none);
  });

  it('says when the newest revision waits for its benchmark', async () => {
    vi.mocked(fetchBenchmarkTrend).mockResolvedValueOnce([point(28, null)]);
    await render('en');
    expect(document.body.textContent).toContain(labels('en').metrics.pending);
  });

  it('retries a failed load with the current token and never reloads on renewal', async () => {
    vi.mocked(fetchBenchmarkTrend).mockRejectedValueOnce(new Error('down'));
    await render('en', 'token-1');
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(
      labels('en').metrics.loadFailed,
    );
    await render('en', 'token-2');
    expect(fetchBenchmarkTrend).toHaveBeenCalledTimes(1);
    vi.mocked(fetchBenchmarkTrend).mockResolvedValueOnce([]);
    const retry = [...document.querySelectorAll('button')].find(
      (button) => button.textContent === labels('en').metrics.retry,
    );
    await act(async () => retry?.click());
    expect(fetchBenchmarkTrend).toHaveBeenLastCalledWith('token-2');
  });
});
