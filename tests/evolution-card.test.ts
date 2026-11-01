// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/evolution', () => ({
  fetchEvolutionMode: vi.fn(),
  fetchEvolutionHistory: vi.fn(),
  declareEvolutionMode: vi.fn(),
}));

import { EvolutionCard } from '../components/evolution-card';
import {
  declareEvolutionMode,
  fetchEvolutionHistory,
  fetchEvolutionMode,
} from '@/lib/api/evolution';
import { labels, tr, type Locale } from '../lib/i18n';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const mode = {
  id: '11111111-1111-4111-8111-111111111111',
  mode: 'must_evolve' as const,
  rationale: null,
  target_role_id: 'Staff platform engineer',
  horizon_months: 12,
  success_criterion: 'Own the platform roadmap.',
  declared_at: '2026-10-31T10:00:00Z',
};
const result = {
  id: '33333333-3333-4333-8333-333333333333',
  verdict: 'fixable_deviation' as const,
  metric: 'claim_supported_rate',
  delta: -0.1,
  action_type: 'add_evidence',
  target_ref: 'skill:rust',
  rationale: 'Two Rust claims lack evidence.',
  created_at: '2026-10-31T10:00:00Z',
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function render(locale: Locale = 'en') {
  await act(async () => {
    root = createRoot(container as HTMLDivElement);
    root.render(createElement(EvolutionCard, { accessToken: 'token', locale }));
  });
}

async function setValue(selector: string, value: string) {
  await act(async () => {
    const element = document.querySelector(selector) as HTMLInputElement;
    const proto =
      element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function click(text: string) {
  const target = [...document.querySelectorAll('button')].find((b) => b.textContent === text);
  if (!target) {
    throw new Error(`button not found: ${text}`);
  }
  await act(async () => {
    target.click();
  });
}

// The path buttons carry a title and a hint; they are found by the title.
async function choose(title: string) {
  const target = [...document.querySelectorAll('button')].find((b) =>
    b.textContent?.startsWith(title),
  );
  if (!target) {
    throw new Error(`path not found: ${title}`);
  }
  await act(async () => {
    target.click();
  });
}

beforeEach(() => {
  vi.mocked(fetchEvolutionMode).mockReset();
  vi.mocked(fetchEvolutionHistory).mockReset().mockResolvedValue([]);
  vi.mocked(declareEvolutionMode).mockReset();
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

describe('EvolutionCard', () => {
  it('summarizes the declared mode and lists the latest checks with their verdict', async () => {
    vi.mocked(fetchEvolutionMode).mockResolvedValue(mode);
    vi.mocked(fetchEvolutionHistory).mockResolvedValue([result]);
    await render('en');
    const t = labels('en').evolution;
    expect(document.body.textContent).toContain(
      tr(t.summary, { mode: t.mustEvolve, role: 'Staff platform engineer', months: '12' }),
    );
    expect(document.body.textContent).toContain(t.fixable_deviation);
    expect(document.body.textContent).toContain('Two Rust claims lack evidence.');
    expect(fetchEvolutionHistory).toHaveBeenCalledWith('token', 5);
  });

  it('opens the declaration form when no mode exists and declares one', async () => {
    vi.mocked(fetchEvolutionMode).mockResolvedValue(null);
    vi.mocked(declareEvolutionMode).mockResolvedValue({ ...mode, mode: 'can_evolve' });
    await render('es');
    const t = labels('es').evolution;
    expect(document.body.textContent).toContain(t.historyEmpty);
    expect(document.body.textContent).toContain(t.pathTitle);
    await choose(t.pathTarget);
    expect(document.querySelector('#evolution-criterion')).toBeNull();
    await setValue('#evolution-role', 'Staff platform engineer');
    await click(t.declare);
    // The user is never asked how they will know: the criterion is derived.
    expect(declareEvolutionMode).toHaveBeenCalledWith('token', {
      mode: 'can_evolve',
      target_role_id: 'Staff platform engineer',
      horizon_months: 12,
      success_criterion: tr(t.criterionDerived, { role: 'Staff platform engineer', months: '12' }),
    });
    expect(document.body.textContent).toContain(
      tr(t.summary, { mode: t.canEvolve, role: 'Staff platform engineer', months: '12' }),
    );
  });

  it('refuses an incomplete declaration with the dictionary message', async () => {
    vi.mocked(fetchEvolutionMode).mockResolvedValue(null);
    await render('en');
    const t = labels('en').evolution;
    await choose(t.pathTarget);
    await setValue('#evolution-role', 'Lead');
    await setValue('#evolution-months', '40');
    await click(t.declare);
    expect(declareEvolutionMode).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(t.invalid);
  });

  it('changes a declared mode from the prefilled form', async () => {
    vi.mocked(fetchEvolutionMode).mockResolvedValue(mode);
    vi.mocked(declareEvolutionMode).mockResolvedValue({ ...mode, horizon_months: 18 });
    await render('en');
    const t = labels('en').evolution;
    await click(t.change);
    await choose(t.pathTarget);
    expect((document.querySelector('#evolution-role') as HTMLInputElement).value).toBe(
      'Staff platform engineer',
    );
    await setValue('#evolution-months', '18');
    await click(t.declare);
    expect(vi.mocked(declareEvolutionMode).mock.calls[0]?.[1]).toMatchObject({
      mode: 'must_evolve',
      horizon_months: 18,
    });
  });

  it('offers a retry when loading fails', async () => {
    vi.mocked(fetchEvolutionMode).mockRejectedValueOnce(new Error('network'));
    await render('en');
    const t = labels('en').evolution;
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(t.loadFailed);
    vi.mocked(fetchEvolutionMode).mockResolvedValue(mode);
    await click(t.retry);
    expect(document.body.textContent).toContain(
      tr(t.summary, { mode: t.mustEvolve, role: 'Staff platform engineer', months: '12' }),
    );
  });

  it('explains the horizon only when asked', async () => {
    vi.mocked(fetchEvolutionMode).mockResolvedValue(null);
    await render('es');
    const t = labels('es').evolution;
    await choose(t.pathTarget);
    const info = document.querySelector(`button[aria-label="${t.horizonInfoAria}"]`);
    expect(info?.getAttribute('aria-expanded')).toBe('false');
    expect(document.body.textContent).not.toContain(t.horizonInfo);
    await act(async () => (info as HTMLButtonElement).click());
    expect(info?.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('#evolution-horizon-info')?.textContent).toBe(t.horizonInfo);
    expect(document.querySelector('#evolution-months')?.getAttribute('aria-describedby')).toBe(
      'evolution-horizon-info',
    );
  });

  it('previews the AI roadmap as beta 1.1 examples and returns to the paths', async () => {
    vi.mocked(fetchEvolutionMode).mockResolvedValue(null);
    await render('en');
    const t = labels('en').evolution;
    await choose(t.pathAi);
    expect(document.body.textContent).toContain(t.roadmapBadge);
    expect(document.body.textContent).toContain(t.roadmapNote);
    expect(document.querySelectorAll(`ol[aria-label="${t.roadmapTitle}"] > li`)).toHaveLength(4);
    expect(declareEvolutionMode).not.toHaveBeenCalled();
    await click(t.roadmapBack);
    expect(document.body.textContent).toContain(t.pathTitle);
  });
});
