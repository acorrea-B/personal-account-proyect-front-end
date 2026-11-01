// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/harness', () => ({
  fetchHarnessOutputs: vi.fn(),
}));

import { ProfileMetrics, deltaPoints } from '../components/profile-metrics';
import { fetchHarnessOutputs } from '@/lib/api/harness';
import { labels, tr, type Locale } from '../lib/i18n';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const point = (
  day: number,
  rates: { completeness: number; supported: number | null; over: number | null },
  counts = { total: 5, supported: 1, partial: 4, blocked: 0, inferred: 0 },
) => ({
  at: `2026-10-${String(day).padStart(2, '0')}T10:00:00Z`,
  metrics: {
    schema: 'profile-metrics/1.0.0' as const,
    completeness_score: rates.completeness,
    claim_supported_rate: rates.supported,
    over_claimed_rate: rates.over,
    suggestions: counts,
    skill_suggestions: 12,
    cv: { ats_readiness: 0.8, structure: 0.8, clarity: 0.5, impact_metric: 1, keyword_coverage: 1 },
    level: { label: 'mid', weighted_score: 0.5 },
    model: { calls: 5, retries: 0, total_tokens: 18843 },
  },
});

// The trend points as the harness client answers them.
const runs = (points: ReturnType<typeof point>[]) =>
  vi.mocked(fetchHarnessOutputs).mockResolvedValue({
    runAt: points.length ? points[points.length - 1].at : null,
    metrics: points,
    cvSuggestions: null,
    level: null,
    roles: [],
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
  vi.mocked(fetchHarnessOutputs).mockReset();
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
  it('shows the newest run rates with the change since the previous run', async () => {
    runs([
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
    expect(text).toContain(tr(t.asOfRun, { date: 'Oct 28' }));
  });

  it('says how much of the AI output verification backed', async () => {
    runs([
      point(
        28,
        { completeness: 0.9, supported: 0.2, over: 0 },
        {
          total: 5,
          supported: 1,
          partial: 4,
          blocked: 0,
          inferred: 0,
        },
      ),
    ]);
    await render('es');
    const t = labels('es');
    const text = document.body.textContent ?? '';
    expect(text).toContain('1/5');
    expect(text).toContain(tr(t.metrics.aiOutputOf, { supported: '1', total: '5' }));
    expect(text).toContain(tr(t.ai.qualityPartial, { count: '4' }));
    const link = [...document.querySelectorAll('a')].find(
      (anchor) => anchor.textContent === t.ai.title,
    );
    expect((link?.getAttribute('href') ?? '').replace(/\/+$/, '')).toBe('/es/app/profile');
  });

  it('shows a rate the run could not measure as not measured', async () => {
    runs([point(28, { completeness: 0.9, supported: null, over: null })]);
    await render('en');
    const meters = [...document.querySelectorAll('[role="meter"]')];
    expect(meters.map((meter) => meter.getAttribute('aria-valuenow'))).toEqual(['90', null, null]);
    expect(document.body.textContent).toContain(labels('en').metrics.notMeasured);
  });

  it('draws the chosen rate across the revisions with the numbers as a table', async () => {
    runs([
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
    runs([point(28, { completeness: 0.7, supported: 0.5, over: 0.3 })]);
    await render('en');
    const t = labels('en').metrics;
    expect(document.body.textContent).toContain(t.overClaimedHigh);
    expect(document.body.textContent).toContain(t.trendNoteRuns);
  });

  it('says when the harness has not run yet', async () => {
    runs([]);
    await render('en');
    expect(document.body.textContent).toContain(labels('en').metrics.noRun);
  });

  it('retries a failed load with the current token and never reloads on renewal', async () => {
    vi.mocked(fetchHarnessOutputs).mockRejectedValueOnce(new Error('down'));
    await render('en', 'token-1');
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(
      labels('en').metrics.loadFailed,
    );
    await render('en', 'token-2');
    expect(fetchHarnessOutputs).toHaveBeenCalledTimes(1);
    runs([]);
    const retry = [...document.querySelectorAll('button')].find(
      (button) => button.textContent === labels('en').metrics.retry,
    );
    await act(async () => retry?.click());
    expect(fetchHarnessOutputs).toHaveBeenLastCalledWith('token-2');
  });
});
