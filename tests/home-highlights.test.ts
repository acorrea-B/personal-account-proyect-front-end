// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/suggestions', () => ({
  fetchSuggestionsSummary: vi.fn(),
}));
vi.mock('@/lib/api/evolution', () => ({
  fetchEvolutionMode: vi.fn(),
  fetchEvolutionHistory: vi.fn(),
}));

import { HomeHighlights, horizonMonth, nextStep } from '../components/home-highlights';
import { fetchEvolutionHistory, fetchEvolutionMode } from '@/lib/api/evolution';
import { fetchSuggestionsSummary } from '@/lib/api/suggestions';
import { labels, tr, type Locale } from '../lib/i18n';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const summary = (pending: number) => ({
  skills: { pending, revision_id: null, created_at: null },
  cv: { pending: 0, revision_id: null, created_at: null },
});
const mode = {
  id: '11111111-1111-4111-8111-111111111111',
  mode: 'can_evolve' as const,
  rationale: null,
  target_role_id: 'Staff engineer',
  horizon_months: 12,
  success_criterion: 'Own the roadmap.',
  declared_at: '2026-07-03T10:00:00Z',
};
const check = {
  id: '33333333-3333-4333-8333-333333333333',
  verdict: 'on_track' as const,
  metric: 'claim_supported_rate',
  delta: 0.1,
  action_type: 'none',
  target_ref: 'profile',
  rationale: 'Steady.',
  created_at: '2026-10-27T10:00:00Z',
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function render(hasCv: boolean, locale: Locale = 'en', token = 'token') {
  await act(async () => {
    root ??= createRoot(container as HTMLDivElement);
    root.render(createElement(HomeHighlights, { accessToken: token, locale, hasCv }));
  });
}

const hrefOf = (text: string) =>
  (
    [...document.querySelectorAll('a')]
      .find((link) => link.textContent === text)
      ?.getAttribute('href') ?? ''
  ).replace(/\/+$/, '');

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  vi.mocked(fetchSuggestionsSummary).mockReset().mockResolvedValue(summary(0));
  vi.mocked(fetchEvolutionMode).mockReset().mockResolvedValue(mode);
  vi.mocked(fetchEvolutionHistory).mockReset().mockResolvedValue([check]);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('nextStep', () => {
  it('recommends what unblocks the most first', () => {
    expect(nextStep({ hasCv: false, pendingSkills: 3, hasMode: false })).toBe('cv');
    expect(nextStep({ hasCv: true, pendingSkills: 3, hasMode: false })).toBe('suggestions');
    expect(nextStep({ hasCv: true, pendingSkills: 0, hasMode: false })).toBe('evolution');
    expect(nextStep({ hasCv: true, pendingSkills: 0, hasMode: true })).toBe('journal');
  });
});

describe('horizonMonth', () => {
  it('counts from month 1 and never passes the horizon', () => {
    const declared = '2026-07-03T10:00:00Z';
    expect(horizonMonth(declared, 12, Date.parse(declared))).toBe(1);
    expect(horizonMonth(declared, 12, Date.parse('2026-11-01T10:00:00Z'))).toBe(4);
    expect(horizonMonth(declared, 3, Date.parse('2027-11-01T10:00:00Z'))).toBe(3);
  });
});

describe('HomeHighlights', () => {
  it('sends a user without a cv to the editor first', async () => {
    vi.mocked(fetchSuggestionsSummary).mockResolvedValue(summary(3));
    await render(false, 'es');
    const h = labels('es').home;
    expect(document.body.textContent).toContain(h.cvTitle);
    expect(hrefOf(h.cvAction)).toBe('/es/app/cv');
  });

  it('asks to review the pending suggestions in the profile', async () => {
    vi.mocked(fetchSuggestionsSummary).mockResolvedValue(summary(3));
    await render(true);
    const h = labels('en').home;
    expect(document.body.textContent).toContain(tr(h.suggestionsOther, { count: '3' }));
    expect(hrefOf(h.suggestionsAction)).toBe('/app/profile');
  });

  it('summarizes the declared evolution with its horizon and last check', async () => {
    await render(true);
    const t = labels('en');
    expect(document.body.textContent).toContain(t.home.journalTitle);
    expect(document.body.textContent).toContain(t.evolution.on_track);
    expect(document.body.textContent).toContain('Staff engineer');
    const meter = document.querySelector('[role="meter"]');
    expect(meter?.getAttribute('aria-valuemax')).toBe('12');
    expect(hrefOf(t.home.openEvolution)).toBe('/app/evolution');
    expect(fetchEvolutionHistory).toHaveBeenCalledWith('token', 1);
  });

  it('invites to declare when no mode exists', async () => {
    vi.mocked(fetchEvolutionMode).mockResolvedValue(null);
    vi.mocked(fetchEvolutionHistory).mockResolvedValue([]);
    await render(true);
    const h = labels('en').home;
    expect(document.body.textContent).toContain(h.noMode);
    expect(document.body.textContent).toContain(h.evolutionTitle);
  });

  it('retries with the current token and never reloads on a renewal', async () => {
    vi.mocked(fetchSuggestionsSummary).mockRejectedValueOnce(new Error('down'));
    await render(true, 'en', 'token-1');
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(
      labels('en').home.loadFailed,
    );
    await render(true, 'en', 'token-2');
    expect(fetchSuggestionsSummary).toHaveBeenCalledTimes(1);
    const retry = [...document.querySelectorAll('button')].find(
      (button) => button.textContent === labels('en').home.retry,
    );
    await act(async () => retry?.click());
    expect(fetchSuggestionsSummary).toHaveBeenLastCalledWith('token-2');
  });
});
