// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/suggestions', () => ({
  fetchCatalogConsent: vi.fn(),
  decideCatalogConsent: vi.fn(),
}));

import { CatalogConsent } from '../components/catalog-consent';
import { ProblemError } from '../lib/api/client';
import { decideCatalogConsent, fetchCatalogConsent } from '@/lib/api/suggestions';
import { labels, tr, type Locale } from '../lib/i18n';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const consent = (granted: boolean | null) => ({
  version: 'catalog-v1',
  consent_text: 'Your skill names join a de-identified catalog.',
  effective_from: '2026-10-01T00:00:00Z',
  granted,
  decided_at: granted === null ? null : '2026-10-20T00:00:00Z',
});

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function render(locale: Locale = 'en') {
  await act(async () => {
    root = createRoot(container as HTMLDivElement);
    root.render(createElement(CatalogConsent, { accessToken: 'token', locale }));
  });
}

async function click(label: string) {
  const target = [...document.querySelectorAll('button')].find((b) => b.textContent === label);
  if (!target) {
    throw new Error(`button not found: ${label}`);
  }
  await act(async () => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

beforeEach(() => {
  vi.mocked(fetchCatalogConsent).mockReset();
  vi.mocked(decideCatalogConsent).mockReset();
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

describe('CatalogConsent', () => {
  it('shows the active text and the undecided state with a grant action', async () => {
    vi.mocked(fetchCatalogConsent).mockResolvedValue(consent(null));
    await render('en');
    const t = labels('en').catalogConsent;
    expect(document.body.textContent).toContain('Your skill names join a de-identified catalog.');
    expect(document.body.textContent).toContain(t.undecided);
    expect(document.body.textContent).toContain(tr(t.version, { version: 'catalog-v1' }));
    expect([...document.querySelectorAll('button')].map((b) => b.textContent)).toEqual([t.grant]);
  });

  it('grants for the version it showed and flips to the shared state', async () => {
    vi.mocked(fetchCatalogConsent).mockResolvedValue(consent(null));
    vi.mocked(decideCatalogConsent).mockResolvedValue({
      consent_version: 'catalog-v1',
      granted: true,
      decided_at: '2026-10-31T10:00:00Z',
    });
    await render('es');
    const t = labels('es').catalogConsent;
    await click(t.grant);
    expect(decideCatalogConsent).toHaveBeenCalledWith('token', 'catalog-v1', true);
    expect(document.body.textContent).toContain(t.granted);
    expect([...document.querySelectorAll('button')].map((b) => b.textContent)).toEqual([
      t.withdraw,
    ]);
  });

  it('withdraws a granted consent', async () => {
    vi.mocked(fetchCatalogConsent).mockResolvedValue(consent(true));
    vi.mocked(decideCatalogConsent).mockResolvedValue({
      consent_version: 'catalog-v1',
      granted: false,
      decided_at: '2026-10-31T10:00:00Z',
    });
    await render('en');
    const t = labels('en').catalogConsent;
    await click(t.withdraw);
    expect(decideCatalogConsent).toHaveBeenCalledWith('token', 'catalog-v1', false);
    expect(document.body.textContent).toContain(t.withdrawn);
  });

  it('reloads the new version when the api refuses a stale one (400)', async () => {
    vi.mocked(fetchCatalogConsent)
      .mockResolvedValueOnce(consent(null))
      .mockResolvedValueOnce({
        ...consent(null),
        version: 'catalog-v2',
        consent_text: 'New text.',
      });
    vi.mocked(decideCatalogConsent).mockRejectedValue(new ProblemError({ status: 400 }));
    await render('en');
    const t = labels('en').catalogConsent;
    await click(t.grant);
    expect(document.body.textContent).toContain('New text.');
    expect(document.querySelector('[role="status"]')?.textContent).toBe(t.changed);
  });

  it('offers a retry when the consent fails to load', async () => {
    vi.mocked(fetchCatalogConsent).mockRejectedValueOnce(new ProblemError({ status: 503 }));
    await render('en');
    const t = labels('en').catalogConsent;
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(t.loadFailed);
    vi.mocked(fetchCatalogConsent).mockResolvedValue(consent(false));
    await click(t.retry);
    expect(document.body.textContent).toContain(t.withdrawn);
  });
});
