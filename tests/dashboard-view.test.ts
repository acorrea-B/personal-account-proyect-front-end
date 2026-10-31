// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pushMock = vi.fn();
const replaceMock = vi.fn();
// One stable router object: the dashboard's callbacks depend on the
// useRouter() result by identity and the effect chain would loop on a
// mock that allocates per call.
const routerStub = { push: pushMock, replace: replaceMock };

vi.mock('next/navigation', () => ({
  useRouter: () => routerStub,
  usePathname: () => null,
}));

const requireAuthMock = vi.fn();
vi.mock('@/lib/auth/useRequireAuth', () => ({
  useRequireAuth: () => requireAuthMock(),
}));

const fetchProfileMock = vi.fn();
vi.mock('@/lib/api/profile', async () => ({
  ...(await vi.importActual<typeof import('@/lib/api/profile')>('@/lib/api/profile')),
  fetchProfile: (...args: unknown[]) => fetchProfileMock(...args),
}));

const fetchCvMock = vi.fn();
const getVersionsMock = vi.fn();
vi.mock('@/lib/api/cv', async () => ({
  ...(await vi.importActual<typeof import('@/lib/api/cv')>('@/lib/api/cv')),
  fetchCvText: (...args: unknown[]) => fetchCvMock(...args),
  getVersions: (...args: unknown[]) => getVersionsMock(...args),
}));

vi.mock('@/lib/auth/session', async () => ({
  ...(await vi.importActual<typeof import('@/lib/auth/session')>('@/lib/auth/session')),
  loadSession: vi.fn(),
  refreshSession: vi.fn(),
}));

import { ProblemError } from '@/lib/api/client';
import { formatWhen } from '@/components/cv-timeline';
import { labels, tr } from '@/lib/i18n';
import { DashboardView } from '../components/dashboard-view';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// next/link normalizes trailing slashes in the jsdom environment (no
// router config there) while the static export keeps them; compare the
// canonical path so the assertion is honest on both runtimes.
function hrefOf(anchor: HTMLAnchorElement | null): string {
  return (anchor?.getAttribute('href') ?? '').replace(/\/+$/, '') || '/';
}

const PROFILE = {
  id: 'profile-1',
  full_name: 'Juan Pérez',
  headline: 'Frontend craftsperson',
  bio: 'Building calm tools.',
  location: 'Bogotá',
  skills: ['TypeScript', 'Next.js'],
  links: [{ url: 'https://github.com/juan', type: 'github' }],
  updated_at: '2026-10-27T10:00:00.000Z',
};

const CV = { content: '# Juan', updated_at: '2026-10-27T09:00:00.000Z' };

describe('DashboardView', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    replaceMock.mockClear();
    fetchProfileMock.mockReset();
    fetchCvMock.mockReset();
    getVersionsMock.mockReset();
    window.sessionStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    fetchCvMock.mockResolvedValueOnce(CV);
    getVersionsMock.mockResolvedValueOnce([]);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => root?.unmount());
    }
    container?.remove();
    root = null;
  });

  function authorizedSession(): void {
    requireAuthMock.mockReturnValue({
      isHydrated: true,
      isAuthorized: true,
      session: {
        accessToken: 'token-1',
        refreshToken: 'refresh-1',
        user: {
          id: 'user-1',
          email: 'juan@example.com',
          verified: true,
          created_at: '2026-10-25T00:00:00.000Z',
        },
      },
    });
  }

  async function render(locale: 'en' | 'es'): Promise<void> {
    if (root) {
      const previous = root;
      root = null;
      await act(async () => previous.unmount());
    }
    await act(async () => {
      root = createRoot(container as HTMLDivElement);
      root.render(createElement(DashboardView, { locale }));
    });
  }

  it('greets the ready profile with the dictionary labels on the en tree', async () => {
    authorizedSession();
    fetchProfileMock.mockResolvedValueOnce(PROFILE);
    await render('en');
    const t = labels('en');
    expect(document.querySelector('h1')?.textContent).toBe(
      tr(t.workspace.greeting, { name: 'Juan' }),
    );
    expect(document.querySelector('header p')?.textContent).toBe(t.workspace.eyebrow);
    expect(document.body.textContent).toContain(
      t.workspace.signedInAs.replace('{email}', 'juan@example.com'),
    );
    expect(document.body.textContent).toContain(t.panel.fullName);
    expect(document.body.textContent).toContain(t.panel.headline);
    expect(document.body.textContent).toContain(t.workspace.skillSuggestions);
    const panel = document.querySelector<HTMLAnchorElement>(
      'section[aria-label] a[href*="/app/profile"]',
    );
    expect(hrefOf(panel)).toBe('/app/profile');
    expect(document.body.textContent).toContain(
      tr(t.panel.updatedNote, { date: formatWhen(PROFILE.updated_at) }),
    );
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('greets the ready profile with the dictionary labels on the es tree', async () => {
    authorizedSession();
    fetchProfileMock.mockResolvedValueOnce(PROFILE);
    await render('es');
    const t = labels('es');
    expect(document.querySelector('h1')?.textContent).toBe(
      tr(t.workspace.greeting, { name: 'Juan' }),
    );
    expect(document.querySelector('section[aria-label] > div > p')?.textContent).toBe(
      t.panel.eyebrow,
    );
    const panel = document.querySelector<HTMLAnchorElement>(
      'section[aria-label] a[href*="/app/profile"]',
    );
    expect(hrefOf(panel)).toBe('/es/app/profile');
    expect(document.body.textContent).toContain(t.workspace.skillSuggestionsCopy);
  });

  it("routes the incomplete profile to the tree's setup page", async () => {
    authorizedSession();
    // Persistent resolution: the seeded 'User' profile is incomplete and
    // two renders (en then es) each consume it.
    fetchProfileMock.mockResolvedValue({
      id: 'profile-1',
      full_name: 'User',
      updated_at: '2026-10-27T10:00:00.000Z',
    });
    await render('en');
    expect(replaceMock).toHaveBeenCalledWith('/app/profile/');
    await render('es');
    expect(replaceMock).toHaveBeenCalledWith('/es/app/profile/');
  });

  it('maps the profile 503 to the warming label and keeps the retry', async () => {
    authorizedSession();
    fetchProfileMock.mockRejectedValueOnce(new ProblemError({ status: 503, title: 'warming up' }));
    await render('en');
    expect(document.body.textContent).toContain(labels('en').workspace.profileWarming);
    const retry = [...document.querySelectorAll('button')].find((button) =>
      button.textContent?.includes(labels('en').cvCard.retry),
    );
    expect(retry).toBeDefined();
  });

  it('composes the problem detail with the tree suffix on unknown statuses', async () => {
    authorizedSession();
    fetchProfileMock.mockRejectedValueOnce(
      new ProblemError({ status: 418, detail: 'teapot overflow' }),
    );
    await render('es');
    const t = labels('es');
    expect(document.body.textContent).toContain('teapot overflow' + t.workspace.detailSuffix);
  });
});
