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
  suggestionsChangedEvent,
} from '../lib/suggestions-signal';
import { readTourChoices } from '../lib/tour-choices';

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
      steps.map((step) => (step.kind === 'suggestion' ? step.suggestion.section : step.kind)),
    ).toEqual(['Summary', 'Experience', 'Links', 'summary', 'skills']);
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
    expect(dialog?.textContent).toContain(tr(t.progress, { step: '1', total: '4' }));
    expect(dialog?.textContent).toContain(
      tr(t.sectionTitle, { section: labels('es').cvSections.summary }),
    );
    expect(dialog?.textContent).toContain('Summary reason');
    expect(dialog?.textContent).not.toContain('[inferred]');
    expect(document.activeElement?.tagName).toBe('H3');
    await press(t.apply);
    expect(document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('2');
    await press(t.skip);
    // The chosen improvements are gathered for the next CV version.
    const summary = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(summary.textContent).toContain(t.summaryTitle);
    expect(summary.textContent).toContain(tr(t.summaryCount, { count: '1' }));
    expect(summary.textContent).toContain('Summary text');
    expect(summary.textContent).not.toContain('Experience text');
    expect(summary.textContent).toContain(t.atsNote);
    const generate = [...summary.querySelectorAll('button')].find(
      (button) => button.textContent === t.generate,
    );
    expect(generate?.disabled).toBe(true);
    expect(summary.textContent).toContain(t.generateSoon);
    expect(readTourChoices(REV)).toEqual({ Summary: 'apply', Experience: 'skip' });
    await press(t.next);
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      tr(t.skillsCopy, { count: '1' }),
    );
    const announced = vi.fn();
    window.addEventListener(suggestionsChangedEvent, announced);
    await press(t.finish);
    window.removeEventListener(suggestionsChangedEvent, announced);
    // The menu marker reads the count again without the walked revision.
    expect(announced).toHaveBeenCalledTimes(1);
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
    await press(labels('es').tour.skip);
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

  it('releases the page when the last step disappears while open', async () => {
    serve(null, ['Django']);
    await render('en');
    await press(labels('en').tour.start);
    expect(container?.hasAttribute('inert')).toBe(true);
    vi.mocked(fetchSkillSuggestions).mockResolvedValue({ revision_id: REV, suggestions: [] });
    await act(async () => announceSuggestionsChanged());
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(container?.hasAttribute('inert')).toBe(false);
  });

  it('asks why in plain words, names the section and says when the AI wrote in English', async () => {
    serve([{ ...suggestion('Core Skills', 'AllSupported'), language: 'English' }], []);
    await render('es');
    const t = labels('es').tour;
    await press(t.start);
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.querySelector('h3')?.textContent).toBe(
      tr(t.sectionTitle, { section: labels('es').cvSections.skills }),
    );
    expect(dialog.querySelector('h4')?.textContent).toBe(t.why);
    expect(dialog.textContent).not.toContain('Por qué: vemos');
    expect(dialog.textContent).toContain(t.languageNote);
    expect(dialog.querySelector('[lang="en"]')?.textContent).toBe('Core Skills text');
  });

  it('adds no language note when the AI wrote in the UI language', async () => {
    serve([{ ...suggestion('Summary', 'AllSupported'), language: 'English' }], []);
    await render('en');
    await press(labels('en').tour.start);
    expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain(
      labels('en').tour.languageNote,
    );
  });

  it('says when no improvement was chosen and remembers the choices on return', async () => {
    serve([suggestion('Summary', 'AllSupported')], []);
    await render('en');
    const t = labels('en').tour;
    await press(t.start);
    await press(t.skip);
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(t.summaryNone);
    await press(t.back);
    expect(
      [...document.querySelectorAll('button')]
        .find((button) => button.textContent === t.skip)
        ?.getAttribute('aria-pressed'),
    ).toBe('true');
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(t.skipped);
  });

  it('shows a few skills and counts the rest', async () => {
    const names = Array.from({ length: skillsShown + 3 }, (_, n) => `Tool${n}`);
    serve(null, names);
    await render('en');
    await press(labels('en').tour.start);
    expect(document.querySelectorAll('[role="dialog"] li')).toHaveLength(skillsShown + 1);
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('+3');
  });

  it('closing decides nothing: the invitation stays and starts from the first step', async () => {
    serve([suggestion('Summary', 'AllSupported'), suggestion('Links', 'Mixed')], ['Django']);
    await render('en');
    const t = labels('en').tour;
    await press(t.start);
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.textContent).toContain(t.bannerTitle);
    expect(readSeenCvRevision()).toBeNull();
    await press(t.start);
    await press(t.close);
    expect(document.body.textContent).toContain(t.bannerTitle);
    expect(readSeenCvRevision()).toBeNull();
    await press(t.start);
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain(tr(t.progress, { step: '1', total: '4' }));
    expect(dialog?.textContent).toContain(
      tr(t.sectionTitle, { section: labels('en').cvSections.summary }),
    );
  });

  it('offers the CV steps again while an improvement waits, even after an old close', async () => {
    // A close under the previous behavior marked the revision as walked.
    markCvRevisionSeen(REV);
    serve([suggestion('Summary', 'AllSupported')], []);
    await render('en');
    expect(document.body.textContent).toContain(labels('en').tour.bannerTitle);
  });

  it('stays hidden once every improvement was decided and no skills wait', async () => {
    window.localStorage.setItem(
      'profile.tour.cvChoices',
      JSON.stringify({ revision: REV, choices: { Summary: 'apply' } }),
    );
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
