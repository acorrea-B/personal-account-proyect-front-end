// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let pathname: string | null = '/app/';

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}));

import { AppShell, activeSection } from '../components/app-shell';
import { labels, type Locale } from '../lib/i18n';

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
