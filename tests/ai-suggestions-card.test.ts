// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/harness', () => ({ fetchHarnessOutputs: vi.fn() }));

import { AiSuggestionsCard } from '../components/ai-suggestions-card';
import { fetchHarnessOutputs } from '@/lib/api/harness';
import { labels, tr, type Locale } from '../lib/i18n';
import type { CvSuggestion, VerificationStatus } from '../lib/schemas/harness';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const suggestion = (
  id: string,
  section: string,
  status: VerificationStatus,
  rationale = 'Clearer first read.',
): CvSuggestion => ({
  suggestion_id: id,
  section,
  suggested_text: `${section} text`,
  rationale,
  verification_status: status,
});

const outputs = (cvSuggestions: CvSuggestion[] | null) => ({
  runAt: cvSuggestions ? '2026-11-01T10:00:00Z' : null,
  metrics: [],
  cvSuggestions,
  level: null,
  roles: [],
});

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function render(locale: Locale = 'en', token = 'token') {
  await act(async () => {
    root ??= createRoot(container as HTMLDivElement);
    root.render(createElement(AiSuggestionsCard, { accessToken: token, locale }));
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

describe('AiSuggestionsCard', () => {
  it('lists the backed advice first, each with its verification status', async () => {
    vi.mocked(fetchHarnessOutputs).mockResolvedValue(
      outputs([
        suggestion('links', 'Links', 'Mixed'),
        suggestion('skills', 'Core Skills', 'AllInferred', '[inferred] No ref resolved.'),
        suggestion('summary', 'Summary', 'AllSupported'),
      ]),
    );
    await render('es');
    const a = labels('es').ai;
    const items = [...document.querySelectorAll(`ul[aria-label="${a.listAria}"] > li`)];
    expect(items.map((item) => item.querySelector('span')?.textContent)).toEqual([
      'Summary',
      'Links',
      'Core Skills',
    ]);
    const text = document.body.textContent ?? '';
    expect(text).toContain(a.statusSupported);
    expect(text).toContain(a.statusPartial);
    expect(text).toContain(a.statusInferred);
    expect(text).toContain(tr(a.why, { rationale: 'No ref resolved.' }));
    expect(text).not.toContain('[inferred]');
    expect(text).toContain(a.decideSoon);
  });

  it('keeps what verification blocked apart, as what the CV has to prove', async () => {
    vi.mocked(fetchHarnessOutputs).mockResolvedValue(
      outputs([
        suggestion('summary', 'Summary', 'AllSupported'),
        suggestion('projects', 'Projects', 'Blocked'),
      ]),
    );
    await render('en');
    const a = labels('en').ai;
    const advice = document.querySelector(`ul[aria-label="${a.listAria}"]`);
    expect(advice?.textContent).not.toContain('Projects');
    const missing = [...document.querySelectorAll('h3')].find(
      (heading) => heading.textContent === a.missingTitle,
    );
    expect(missing?.parentElement?.textContent).toContain('Projects text');
  });

  it('says when the harness has not read the CV yet', async () => {
    vi.mocked(fetchHarnessOutputs).mockResolvedValue(outputs(null));
    await render('en');
    expect(document.body.textContent).toContain(labels('en').ai.none);
  });

  it('retries with the current token and never reloads on renewal', async () => {
    vi.mocked(fetchHarnessOutputs).mockRejectedValueOnce(new Error('down'));
    await render('en', 'token-1');
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(labels('en').ai.loadFailed);
    await render('en', 'token-2');
    expect(fetchHarnessOutputs).toHaveBeenCalledTimes(1);
    vi.mocked(fetchHarnessOutputs).mockResolvedValueOnce(outputs(null));
    const retry = [...document.querySelectorAll('button')].find(
      (button) => button.textContent === labels('en').ai.retry,
    );
    await act(async () => retry?.click());
    expect(fetchHarnessOutputs).toHaveBeenLastCalledWith('token-2');
  });
});
