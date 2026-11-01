// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/harness', () => ({ fetchHarnessOutputs: vi.fn() }));
vi.mock('@/lib/api/suggestions', () => ({
  fetchSuggestionsSummary: vi.fn(),
  fetchSkillSuggestions: vi.fn(),
}));

import { SuggestionsTour, skillsShown, tourSteps } from '../components/suggestions-tour';
import { fetchHarnessOutputs } from '@/lib/api/harness';
import { fetchSkillSuggestions, fetchSuggestionsSummary } from '@/lib/api/suggestions';
import { labels, tr, type Locale } from '../lib/i18n';
import type { CvSuggestion, VerificationStatus } from '../lib/schemas/harness';
import {
  announceSuggestionsChanged,
  markCvRevisionSeen,
  readSeenCvRevision,
} from '../lib/suggestions-signal';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const suggestion = (section: string, status: VerificationStatus): CvSuggestion => ({
  suggestion_id: section,
  section,
  suggested_text: `${section} text`,
  rationale: `[inferred] ${section} reason`,
  verification_status: status,
});

const REV = '44444444-4444-4444-8444-444444444444';

function serve(cv: CvSuggestion[] | null, skills: string[]) {
  vi.mocked(fetchHarnessOutputs).mockResolvedValue({
    runAt: '2026-11-01T10:00:00Z',
    metrics: [],
    cvSuggestions: cv,
    level: null,
    roles: [],
  });
  vi.mocked(fetchSuggestionsSummary).mockResolvedValue({
    skills: { pending: skills.length, revision_id: REV, created_at: null },
    cv: { pending: cv?.length ?? 0, revision_id: cv ? REV : null, created_at: null },
  });
  vi.mocked(fetchSkillSuggestions).mockResolvedValue({
    revision_id: REV,
    suggestions: skills.map((name) => ({
      skill_key: name.toLowerCase(),
      display_name: name,
      evidence: { quote: `Used ${name}`, cv_section: 'skills' },
    })),
  });
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function render(locale: Locale = 'es') {
  await act(async () => {
    root = createRoot(container as HTMLDivElement);
    root.render(createElement(SuggestionsTour, { accessToken: 'token', locale }));
  });
}

async function press(text: string) {
  const button = [...document.querySelectorAll('button')].find((b) => b.textContent === text);
  if (!button) {
    throw new Error(`button not found: ${text}`);
  }
  await act(async () => button.click());
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe('tourSteps', () => {
  it('walks the backed advice first, never the blocked, then the skills', () => {
    const steps = tourSteps(
      [
        suggestion('Links', 'AllInferred'),
        suggestion('Projects', 'Blocked'),
        suggestion('Summary', 'AllSupported'),
        suggestion('Experience', 'Mixed'),
      ],
      ['Django'],
    );
    expect(
      steps.map((step) => (step.kind === 'suggestion' ? step.suggestion.section : 'skills')),
    ).toEqual(['Summary', 'Experience', 'Links', 'skills']);
    expect(tourSteps(null, [])).toEqual([]);
  });
});

describe('SuggestionsTour', () => {
  it('invites to start and walks every step with its progress', async () => {
    serve([suggestion('Summary', 'AllSupported'), suggestion('Experience', 'Mixed')], ['Django']);
    await render('es');
    const t = labels('es').tour;
    expect(document.body.textContent).toContain(t.bannerTitle);
    await press(t.start);
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.textContent).toContain(tr(t.progress, { step: '1', total: '3' }));
    expect(dialog?.textContent).toContain(tr(t.sectionTitle, { section: 'Summary' }));
    expect(dialog?.textContent).toContain('Summary reason');
    expect(dialog?.textContent).not.toContain('[inferred]');
    expect(document.activeElement?.tagName).toBe('H3');
    await press(t.next);
    expect(document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('2');
    await press(t.next);
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      tr(t.skillsCopy, { count: '1' }),
    );
    await press(t.finish);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.textContent).not.toContain(t.bannerTitle);
    expect(readSeenCvRevision()).toBe(REV);
  });

  it('is a modal outside the page: inert background and focus kept inside', async () => {
    serve([suggestion('Summary', 'AllSupported'), suggestion('Links', 'AllInferred')], []);
    await render('en');
    const t = labels('en').tour;
    await press(t.start);
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    // Rendered through a portal, so no transformed page wrapper contains it.
    expect(container?.contains(dialog)).toBe(false);
    expect(container?.hasAttribute('inert')).toBe(true);
    const buttons = [...dialog.querySelectorAll('button')].filter(
      (button) => !button.classList.contains('invisible'),
    );
    const last = buttons[buttons.length - 1];
    last.focus();
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    });
    expect(document.activeElement).toBe(buttons[0]);
    await press(t.close);
    expect(container?.hasAttribute('inert')).toBe(false);
  });

  it('keeps the verification status on each step', async () => {
    serve([suggestion('Summary', 'AllSupported'), suggestion('Links', 'AllInferred')], []);
    await render('es');
    const a = labels('es').ai;
    await press(labels('es').tour.start);
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(a.statusSupported);
    await press(labels('es').tour.next);
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(a.statusInferred);
  });

  it('follows the decisions taken in the skill suggestions card', async () => {
    serve(null, ['Django', 'Rust']);
    await render('en');
    vi.mocked(fetchSkillSuggestions).mockResolvedValue({ revision_id: REV, suggestions: [] });
    await act(async () => announceSuggestionsChanged());
    // Every skill was decided: nothing is left to walk.
    expect(document.body.textContent).not.toContain(labels('en').tour.bannerTitle);
  });

  it('shows a few skills and counts the rest', async () => {
    const names = Array.from({ length: skillsShown + 3 }, (_, n) => `Tool${n}`);
    serve(null, names);
    await render('en');
    await press(labels('en').tour.start);
    expect(document.querySelectorAll('[role="dialog"] li')).toHaveLength(skillsShown + 1);
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('+3');
  });

  it('closes on Escape and remembers the walked revision', async () => {
    serve([suggestion('Summary', 'AllSupported')], []);
    await render('en');
    await press(labels('en').tour.start);
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(readSeenCvRevision()).toBe(REV);
  });

  it('stays hidden when the CV revision was walked and no skills wait', async () => {
    markCvRevisionSeen(REV);
    serve([suggestion('Summary', 'AllSupported')], []);
    await render('en');
    expect(document.body.textContent).not.toContain(labels('en').tour.bannerTitle);
  });

  it('stays hidden when the suggestions cannot load', async () => {
    vi.mocked(fetchHarnessOutputs).mockRejectedValue(new Error('down'));
    vi.mocked(fetchSuggestionsSummary).mockRejectedValue(new Error('down'));
    vi.mocked(fetchSkillSuggestions).mockRejectedValue(new Error('down'));
    await render('en');
    expect(document.body.textContent).toBe('');
  });

  it('can be left for later', async () => {
    serve([suggestion('Summary', 'AllSupported')], []);
    await render('en');
    await press(labels('en').tour.later);
    expect(document.body.textContent).not.toContain(labels('en').tour.bannerTitle);
    expect(readSeenCvRevision()).toBeNull();
  });
});
