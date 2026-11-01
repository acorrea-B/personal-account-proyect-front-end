// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let pathname: string | null = '/app/';

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}));

let session: { accessToken: string } | null = null;
// The menu reads the stored session; it never starts a session lifecycle.
vi.mock('@/lib/auth/session', () => ({
  loadSession: () => session,
  sessionSavedEvent: 'auth:session-saved',
}));

vi.mock('@/lib/api/suggestions', () => ({ fetchSuggestionsSummary: vi.fn() }));

import { AppShell, activeSection } from '../components/app-shell';
import { fetchSuggestionsSummary } from '@/lib/api/suggestions';
import { labels, tr, type Locale } from '../lib/i18n';
import {
  announceSuggestionsChanged,
  markCvRevisionSeen,
  pendingCount,
} from '../lib/suggestions-signal';

const summary = (skills: number, cv: number, cvRevision: string | null = 'rev-cv-1') => ({
  skills: { pending: skills, revision_id: 'rev-skills', created_at: null },
  cv: { pending: cv, revision_id: cvRevision, created_at: null },
});

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function render(locale: Locale, back = false, busy = false) {
  await act(async () => {
    root = createRoot(container as HTMLDivElement);
    root.render(
      createElement(AppShell, { locale, back, busy }, createElement('p', null, 'content')),
    );
  });
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
  pathname = '/app/';
  session = null;
  window.localStorage.clear();
  vi.mocked(fetchSuggestionsSummary).mockReset();
});

describe('pendingCount', () => {
  it('counts the pending skills and the CV suggestions of a revision not walked yet', () => {
    expect(pendingCount(summary(2, 3), null)).toEqual({ skills: 2, cv: 3 });
    expect(pendingCount(summary(2, 3), 'rev-cv-1')).toEqual({ skills: 2, cv: 0 });
    expect(pendingCount(summary(0, 3, null), null)).toEqual({ skills: 0, cv: 0 });
  });
});

describe('the profile marker', () => {
  const markerOf = (path: string) => {
    const link = [...document.querySelectorAll('nav a')].find((anchor) =>
      anchor.getAttribute('href')?.endsWith(path),
    );
    return link?.querySelector('.sr-only')?.textContent ?? null;
  };
  const marker = () => markerOf('/app/profile');

  it('marks the profile while suggestions wait there', async () => {
    session = { accessToken: 'token' };
    vi.mocked(fetchSuggestionsSummary).mockResolvedValue(summary(2, 3));
    await render('es');
    // Skills mark the profile; the CV improvements mark the CV page.
    expect(marker()).toBe(tr(labels('es').nav.pendingAria, { count: '2' }));
    expect(markerOf('/app/cv')).toBe(tr(labels('es').nav.pendingAria, { count: '3' }));
    expect(fetchSuggestionsSummary).toHaveBeenCalledWith('token');
  });

  it('reads the count again after a decision and clears when none wait', async () => {
    session = { accessToken: 'token' };
    vi.mocked(fetchSuggestionsSummary).mockResolvedValueOnce(summary(1, 0));
    await render('en');
    expect(marker()).toBe(tr(labels('en').nav.pendingAria, { count: '1' }));
    vi.mocked(fetchSuggestionsSummary).mockResolvedValueOnce(summary(0, 0));
    await act(async () => announceSuggestionsChanged());
    expect(fetchSuggestionsSummary).toHaveBeenCalledTimes(2);
    expect(marker()).toBeNull();
  });

  it('stops counting a CV revision the tour already walked', async () => {
    session = { accessToken: 'token' };
    markCvRevisionSeen('rev-cv-1');
    vi.mocked(fetchSuggestionsSummary).mockResolvedValue(summary(0, 3));
    await render('en');
    expect(markerOf('/app/cv')).toBeNull();
    expect(marker()).toBeNull();
  });

  it('reads the count again once the page refreshes its session', async () => {
    // An expired stored token: the page refreshes it after the shell mounts.
    vi.mocked(fetchSuggestionsSummary).mockResolvedValue(summary(2, 0));
    await render('en');
    expect(fetchSuggestionsSummary).not.toHaveBeenCalled();
    session = { accessToken: 'fresh' };
    await act(async () => {
      window.dispatchEvent(new Event('auth:session-saved'));
    });
    expect(fetchSuggestionsSummary).toHaveBeenCalledWith('fresh');
    expect(marker()).toBe(tr(labels('en').nav.pendingAria, { count: '2' }));
  });

  it('stays quiet without a session or when the summary fails', async () => {
    await render('en');
    expect(fetchSuggestionsSummary).not.toHaveBeenCalled();
    act(() => root?.unmount());
    session = { accessToken: 'token' };
    vi.mocked(fetchSuggestionsSummary).mockRejectedValue(new Error('down'));
    await render('en');
    expect(marker()).toBeNull();
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });
});

describe('activeSection', () => {
  it('names the section of a workspace path in either locale tree', () => {
    expect(activeSection('/app/')).toBe('home');
    expect(activeSection('/app')).toBe('home');
    expect(activeSection('/es/app/')).toBe('home');
    expect(activeSection('/app/journal/')).toBe('journal');
    expect(activeSection('/es/app/evolution')).toBe('evolution');
    expect(activeSection('/app/cv/')).toBe('cv');
    expect(activeSection('/es/app/profile/')).toBe('profile');
  });

  it('names none outside the workspace', () => {
    expect(activeSection(null)).toBeNull();
    expect(activeSection('/')).toBeNull();
    expect(activeSection('/login/')).toBeNull();
    expect(activeSection('/estate/app/')).toBeNull();
  });
});

describe('AppShell', () => {
  it('links every section in the locale tree and marks the current one', async () => {
    pathname = '/es/app/journal/';
    await render('es');
    const nav = document.querySelector('nav');
    expect(nav?.getAttribute('aria-label')).toBe(labels('es').nav.label);
    const links = [...(nav?.querySelectorAll('a') ?? [])];
    // next/link renders the href without the trailing slash outside the
    // static export config.
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/es/app',
      '/es/app/profile',
      '/es/app/cv',
      '/es/app/journal',
      '/es/app/evolution',
    ]);
    const current = links.filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current.map((link) => link.textContent)).toEqual([labels('es').nav.journal]);
  });

  it('keeps the content in main, leading with the way home on inner pages', async () => {
    pathname = '/app/evolution/';
    await render('en', true, true);
    const main = document.querySelector('main');
    expect(main?.getAttribute('aria-busy')).toBe('true');
    const back = main?.querySelector('a');
    expect(back?.getAttribute('href')).toBe('/app');
    expect(back?.textContent).toBe(labels('en').nav.back);
    expect(main?.textContent).toContain('content');
  });

  it('shows no way back on the home page itself', async () => {
    await render('en');
    expect(document.querySelector('main a')).toBeNull();
    expect(document.querySelector('main')?.hasAttribute('aria-busy')).toBe(false);
  });
});
