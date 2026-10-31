// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import { swapLocalePath } from '../components/language-select';
import { labels } from '../lib/i18n';

describe('swapLocalePath', () => {
  it('maps the landing root to the es tree', () => {
    expect(swapLocalePath('/')).toBe('/es/');
  });

  it('maps the es landing back to the english root', () => {
    expect(swapLocalePath('/es/')).toBe('/');
  });

  it('strips the es prefix from inner routes', () => {
    expect(swapLocalePath('/es/login/')).toBe('/login/');
    expect(swapLocalePath('/es/app/cv/')).toBe('/app/cv/');
  });

  it('prefixes inner routes when switching to es', () => {
    expect(swapLocalePath('/login/')).toBe('/es/login/');
    expect(swapLocalePath('/app/cv/')).toBe('/es/app/cv/');
  });

  it('never stacks a second prefix', () => {
    expect(swapLocalePath('/es/')).toBe('/');
    expect(swapLocalePath('/')).not.toMatch(/\/es\/es\//);
  });
});

describe('LanguageSelect navigation', () => {
  it('switches the locale with a full document load, not a client route', async () => {
    // The cross-tree switch re-fetches the document: no RSC payload/chunk
    // fetches from a stale shell (the 404 class the static export served
    // when the build changed underneath), and the fresh html carries the
    // browser's language directly.
    // @vitest-environment jsdom
    const { LanguageSelect } = await import('../components/language-select');
    const { act, createElement } = await import('react');
    const { createRoot } = await import('react-dom/client');
    // jsdom's location.assign is non-configurable (spy fails); the global
    // object is window itself, so stubbing `location` swaps the property.
    const assignMock = vi.fn();
    vi.stubGlobal('location', { assign: assignMock } as unknown as Location);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const { IS_REACT_ACT_ENVIRONMENT } = globalThis as Record<string, unknown>;
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

    try {
      await act(async () => {
        createRoot(container).render(
          createElement(LanguageSelect, { current: 'en', path: '/login/' }),
        );
      });

      const select = container.querySelector<HTMLSelectElement>('select');
      if (!select) {
        throw new Error('select not found');
      }
      expect(select.value).toBe('en');
      expect(select.getAttribute('aria-label')).toBe(labels('en').language);

      await act(async () => {
        select.value = 'es';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(assignMock).toHaveBeenCalledWith('/es/login/');
    } finally {
      vi.unstubAllGlobals();
      (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = IS_REACT_ACT_ENVIRONMENT;
      container.remove();
    }
  });
});
