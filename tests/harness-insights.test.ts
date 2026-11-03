// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/harness', () => ({ fetchHarnessOutputs: vi.fn() }));

import { HarnessInsights } from '../components/harness-insights';
import { fetchHarnessOutputs } from '@/lib/api/harness';
import { labels, tr, type Locale } from '../lib/i18n';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const metrics = {
  schema: 'profile-metrics/1.0.0' as const,
  completeness_score: 0.9,
  claim_supported_rate: 0.2,
  over_claimed_rate: 0,
  suggestions: { total: 5, supported: 1, partial: 3, blocked: 1, inferred: 0 },
  skill_suggestions: 37,
  cv: {
    ats_readiness: 0.83,
    structure: 0.85,
    clarity: 0.55,
    impact_metric: 1,
    keyword_coverage: 1,
  },
  level: { label: 'junior', weighted_score: 0.38 },
  model: { calls: 3, retries: 1, total_tokens: 13130 },
};

const ready = {
  runAt: '2026-11-01T10:00:00Z',
  metrics: [{ at: '2026-11-01T10:00:00Z', metrics }],
  cvSuggestions: [],
  level: {
    seniority_label: 'Junior',
    weighted_score: 0.38,
    dimension_scores: [
      { dimension: 'project_complexity', score: 0.9, rationale: '31 technologies' },
      { dimension: 'leadership_signals', score: 0, rationale: 'no leadership signals' },
      { dimension: 'skill_depth', score: 0.15, rationale: 'no years reported' },
    ],
  },
  roles: [
    {
      role_id: 'backend',
      display_name: 'Backend Engineer',
      confidence_score: 0.7,
      status: 'Primary',
    },
    {
      role_id: 'platform',
      display_name: 'Platform Engineer',
      confidence_score: 0.65,
      status: 'Alternative',
    },
  ],
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function render(locale: Locale = 'en', token = 'token') {
  await act(async () => {
    root ??= createRoot(container as HTMLDivElement);
    root.render(createElement(HarnessInsights, { accessToken: token, locale }));
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

describe('HarnessInsights', () => {
  it('says how much of the AI output held up, with the model usage', async () => {
    vi.mocked(fetchHarnessOutputs).mockResolvedValue(ready);
    await render('es');
    const a = labels('es').ai;
    const text = document.body.textContent ?? '';
    expect(text).toContain(tr(a.qualityOf, { supported: '1', total: '5' }));
    expect(text).toContain(tr(a.qualityBlocked, { count: '1' }));
    expect(text).toContain(tr(a.qualitySkills, { count: '37' }));
    expect(text).toContain(tr(a.qualityModel, { calls: '3', retries: '1', tokens: '13.130' }));
  });

  it('lists the level dimensions lowest first, each as a meter', async () => {
    vi.mocked(fetchHarnessOutputs).mockResolvedValue(ready);
    await render('en');
    const a = labels('en').ai;
    const meters = [...document.querySelectorAll('[role="meter"]')];
    expect(meters.map((meter) => meter.getAttribute('aria-label'))).toEqual([
      a.dimension_leadership_signals,
      a.dimension_skill_depth,
      a.dimension_project_complexity,
    ]);
    expect(meters.map((meter) => meter.getAttribute('aria-valuenow'))).toEqual(['0', '15', '90']);
    expect(document.body.textContent).toContain(tr(a.levelScore, { score: '38%' }));
  });

  it('shows the judged level with each dimension state and its CV quote, no score', async () => {
    vi.mocked(fetchHarnessOutputs).mockResolvedValue({
      ...ready,
      levelJudgment: {
        label: 'senior',
        dimensions: {
          leadership: {
            state: 'evidenced',
            facts: ['Technical lead of a two-developer backend team', 'Mentored two engineers'],
            dropped_facts: [],
            rationale: 'r',
          },
          impact: {
            state: 'unknown',
            facts: [],
            dropped_facts: ['Invented'],
            rationale: 'No result stated',
          },
        },
        rationale: 'Leadership is evidenced',
        support: 'not_assessed',
      },
    });
    await render('en');
    const a = labels('en').ai;
    const text = document.body.textContent ?? '';
    expect(text).toContain(a.levelLabel_senior);
    expect(text).toContain(a.levelState_evidenced);
    expect(text).toContain('Technical lead of a two-developer backend team');
    expect(text).toContain(tr(a.levelEvidenceSummary, { count: '1', total: '2' }));
    // The quotes are behind one disclosure, so the panel stays compact.
    const details = document.querySelector('details');
    expect(details?.open).toBe(false);
    expect(details?.textContent).toContain('Mentored two engineers');
    expect(text).toContain(a.levelState_unknown);
    expect(text).toContain(tr(a.levelDropped, { count: '1' }));
    expect(document.querySelectorAll('[role="meter"]')).toHaveLength(0);
  });

  it('names the roles the profile fits, the main one marked', async () => {
    vi.mocked(fetchHarnessOutputs).mockResolvedValue(ready);
    await render('en');
    const a = labels('en').ai;
    const text = document.body.textContent ?? '';
    expect(text).toContain('Backend Engineer');
    expect(text).toContain(a.rolePrimary);
    expect(text).toContain(tr(a.roleMatch, { confidence: '65%' }));
  });

  it('says when the harness has not run yet', async () => {
    vi.mocked(fetchHarnessOutputs).mockResolvedValue({
      runAt: null,
      metrics: [],
      cvSuggestions: null,
      level: null,
      roles: [],
    });
    await render('en');
    expect(document.body.textContent).toContain(labels('en').ai.noRun);
  });

  it('retries with the current token and never reloads on renewal', async () => {
    vi.mocked(fetchHarnessOutputs).mockRejectedValueOnce(new Error('down'));
    await render('en', 'token-1');
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(labels('en').ai.loadFailed);
    await render('en', 'token-2');
    expect(fetchHarnessOutputs).toHaveBeenCalledTimes(1);
    vi.mocked(fetchHarnessOutputs).mockResolvedValueOnce(ready);
    const retry = [...document.querySelectorAll('button')].find(
      (button) => button.textContent === labels('en').ai.retry,
    );
    await act(async () => retry?.click());
    expect(fetchHarnessOutputs).toHaveBeenLastCalledWith('token-2');
  });
});
