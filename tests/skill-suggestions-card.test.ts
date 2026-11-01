// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/suggestions', () => ({
  fetchSuggestionsSummary: vi.fn(),
  fetchSkillSuggestions: vi.fn(),
  decideSkillSuggestion: vi.fn(),
}));

import { SkillSuggestionsCard } from '../components/skill-suggestions-card';
import { ProblemError } from '../lib/api/client';
import {
  decideSkillSuggestion,
  fetchSkillSuggestions,
  fetchSuggestionsSummary,
} from '@/lib/api/suggestions';
import { labels, tr, type Locale } from '../lib/i18n';
import { suggestionsChangedEvent } from '../lib/suggestions-signal';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const REVISION = '22222222-2222-4222-8222-222222222222';

const summary = (skills: number, cv = 0) => ({
  skills: { pending: skills, revision_id: skills ? REVISION : null, created_at: null },
  cv: { pending: cv, revision_id: cv ? REVISION : null, created_at: null },
});

const rust = {
  skill_key: 'rust',
  display_name: 'Rust',
  evidence: { quote: 'Built payment services in Rust', cv_section: 'experience' },
};
const sql = {
  skill_key: 'sql',
  display_name: 'SQL',
  evidence: { quote: 'Tuned PostgreSQL queries', cv_section: 'experience' },
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;
const onAccepted = vi.fn();

async function render(locale: Locale = 'en') {
  await act(async () => {
    root = createRoot(container as HTMLDivElement);
    root.render(
      createElement(
        'ul',
        null,
        createElement(SkillSuggestionsCard, { accessToken: 'token', locale, onAccepted }),
      ),
    );
  });
}

async function click(label: string) {
  const target = [...document.querySelectorAll('button')].find(
    (button) => button.getAttribute('aria-label') === label || button.textContent === label,
  );
  if (!target) {
    throw new Error(`button not found: ${label}`);
  }
  await act(async () => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

beforeEach(() => {
  vi.mocked(fetchSuggestionsSummary).mockReset();
  vi.mocked(fetchSkillSuggestions).mockReset();
  vi.mocked(decideSkillSuggestion).mockReset();
  onAccepted.mockReset();
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

describe('SkillSuggestionsCard', () => {
  it('lists the pending suggestions with their CV evidence and count', async () => {
    vi.mocked(fetchSuggestionsSummary).mockResolvedValue(summary(2));
    vi.mocked(fetchSkillSuggestions).mockResolvedValue({
      revision_id: REVISION,
      suggestions: [rust, sql],
    });
    await render('en');
    const t = labels('en').suggestions;
    expect(document.body.textContent).toContain(tr(t.pending, { count: '2' }));
    expect(document.body.textContent).toContain('Rust');
    expect(document.body.textContent).toContain('Built payment services in Rust');
    expect(document.body.textContent).toContain(
      tr(t.evidence, { section: labels('en').cvSections.experience }),
    );
    expect(document.querySelector(`ul[aria-label="${t.listAria}"]`)).not.toBeNull();
  });

  it('names the CV section in the tree language and keeps an unknown key as sent', async () => {
    vi.mocked(fetchSuggestionsSummary).mockResolvedValue(summary(2));
    vi.mocked(fetchSkillSuggestions).mockResolvedValue({
      revision_id: REVISION,
      suggestions: [
        rust,
        { ...sql, evidence: { quote: 'Tuned queries', cv_section: 'volunteering' } },
      ],
    });
    await render('es');
    const t = labels('es').suggestions;
    expect(document.body.textContent).toContain(tr(t.evidence, { section: 'Experiencia' }));
    expect(document.body.textContent).toContain(tr(t.evidence, { section: 'volunteering' }));
  });

  it('accepts a suggestion for its revision, removes it and tells the dashboard', async () => {
    vi.mocked(fetchSuggestionsSummary).mockResolvedValue(summary(2));
    vi.mocked(fetchSkillSuggestions).mockResolvedValue({
      revision_id: REVISION,
      suggestions: [rust, sql],
    });
    vi.mocked(decideSkillSuggestion).mockResolvedValue({
      skill_key: 'rust',
      decision: 'accepted',
      revision_id: REVISION,
      decided_at: '2026-10-31T10:00:00Z',
    });
    await render('en');
    const t = labels('en').suggestions;
    const announced = vi.fn();
    window.addEventListener(suggestionsChangedEvent, announced);
    await click(tr(t.acceptAria, { skill: 'Rust' }));
    window.removeEventListener(suggestionsChangedEvent, announced);
    // The menu marker reads the count again after the decision.
    expect(announced).toHaveBeenCalledTimes(1);
    expect(decideSkillSuggestion).toHaveBeenCalledWith('token', 'rust', 'accepted', REVISION);
    expect(onAccepted).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain('Built payment services in Rust');
    expect(document.body.textContent).toContain(tr(t.pending, { count: '1' }));
  });

  it('dismisses a suggestion without touching the profile', async () => {
    vi.mocked(fetchSuggestionsSummary).mockResolvedValue(summary(1));
    vi.mocked(fetchSkillSuggestions).mockResolvedValue({
      revision_id: REVISION,
      suggestions: [rust],
    });
    vi.mocked(decideSkillSuggestion).mockResolvedValue({
      skill_key: 'rust',
      decision: 'rejected',
      revision_id: REVISION,
      decided_at: '2026-10-31T10:00:00Z',
    });
    await render('es');
    const t = labels('es').suggestions;
    await click(tr(t.rejectAria, { skill: 'Rust' }));
    expect(decideSkillSuggestion).toHaveBeenCalledWith('token', 'rust', 'rejected', REVISION);
    expect(onAccepted).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(t.allReviewed);
  });

  it('explains the empty state before the first revision', async () => {
    vi.mocked(fetchSuggestionsSummary).mockResolvedValue(summary(0));
    vi.mocked(fetchSkillSuggestions).mockResolvedValue({ revision_id: null, suggestions: [] });
    await render('en');
    expect(document.body.textContent).toContain(labels('en').suggestions.none);
  });

  it('keeps the suggestion and names the 100-skill cap on a 422', async () => {
    vi.mocked(fetchSuggestionsSummary).mockResolvedValue(summary(1));
    vi.mocked(fetchSkillSuggestions).mockResolvedValue({
      revision_id: REVISION,
      suggestions: [rust],
    });
    vi.mocked(decideSkillSuggestion).mockRejectedValue(
      new ProblemError({ status: 422, fields: { skills: 'over 100' } }),
    );
    await render('en');
    const t = labels('en').suggestions;
    await click(tr(t.acceptAria, { skill: 'Rust' }));
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(t.limit);
    expect(document.body.textContent).toContain('Built payment services in Rust');
    expect(onAccepted).not.toHaveBeenCalled();
  });

  it('reloads the latest suggestions when the revision changed (404)', async () => {
    vi.mocked(fetchSuggestionsSummary).mockResolvedValue(summary(1));
    vi.mocked(fetchSkillSuggestions)
      .mockResolvedValueOnce({ revision_id: REVISION, suggestions: [rust] })
      .mockResolvedValueOnce({ revision_id: REVISION, suggestions: [sql] });
    vi.mocked(decideSkillSuggestion).mockRejectedValue(new ProblemError({ status: 404 }));
    await render('en');
    await click(tr(labels('en').suggestions.acceptAria, { skill: 'Rust' }));
    expect(fetchSkillSuggestions).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).toContain('SQL');
    expect(document.body.textContent).toContain(labels('en').suggestions.changed);
  });

  it('offers a retry when loading fails and mentions new CV suggestions', async () => {
    vi.mocked(fetchSuggestionsSummary).mockRejectedValueOnce(new ProblemError({ status: 503 }));
    vi.mocked(fetchSkillSuggestions).mockResolvedValue({ revision_id: null, suggestions: [] });
    await render('en');
    const t = labels('en').suggestions;
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(t.busy);
    vi.mocked(fetchSuggestionsSummary).mockResolvedValue(summary(0, 4));
    await click(t.retry);
    expect(document.body.textContent).toContain(tr(t.cvNew, { count: '4' }));
  });

  it('does not reload when the session renews its access token', async () => {
    vi.mocked(fetchSuggestionsSummary).mockResolvedValue(summary(1));
    vi.mocked(fetchSkillSuggestions).mockResolvedValue({
      revision_id: REVISION,
      suggestions: [rust],
    });
    await render('en');
    expect(fetchSkillSuggestions).toHaveBeenCalledTimes(1);
    await act(async () => {
      root?.render(
        createElement(
          'ul',
          null,
          createElement(SkillSuggestionsCard, { accessToken: 'renewed', locale: 'en', onAccepted }),
        ),
      );
    });
    expect(fetchSkillSuggestions).toHaveBeenCalledTimes(1);
  });
});
