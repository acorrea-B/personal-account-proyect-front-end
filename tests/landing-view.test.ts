// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pushMock = vi.fn();
const routerStub = { push: pushMock, replace: vi.fn() };

vi.mock('next/navigation', () => ({
  useRouter: () => routerStub,
  usePathname: () => null,
}));

const sessionState: { session: AuthSession | null; isHydrated: boolean } = {
  session: null,
  isHydrated: false,
};
vi.mock('@/lib/auth/useSession', async () => ({
  ...(await vi.importActual<typeof import('@/lib/auth/useSession')>('@/lib/auth/useSession')),
  useSession: () => sessionState,
}));

import { type AuthSession } from '@/lib/auth/session';
import { labels } from '@/lib/i18n';
import { LandingView } from '../components/landing-view';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// next/link normalizes trailing slashes in the jsdom environment (no
// router config there) while the static export keeps them; compare the
// canonical path so the assertion is honest on both runtimes.
function hrefOf(anchor: HTMLAnchorElement | null): string {
  return (anchor?.getAttribute('href') ?? '').replace(/\/+$/, '') || '/';
}

describe('LandingView', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    pushMock.mockClear();
    sessionState.session = null;
    sessionState.isHydrated = false;
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => root?.unmount());
    }
    container?.remove();
    root = null;
  });

  async function render(locale: 'en' | 'es'): Promise<void> {
    if (root) {
      const previous = root;
      root = null;
      await act(async () => previous.unmount());
    }
    await act(async () => {
      root = createRoot(container as HTMLDivElement);
      root.render(createElement(LandingView, { locale }));
    });
  }

  it('speaks the guest dictionary on the en tree and links its routes', async () => {
    sessionState.isHydrated = true;
    await render('en');
    const t = labels('en').landing;
    expect(document.querySelector('h1')?.textContent).toBe(t.heroTitle);
    expect(document.querySelector('.landing-hero .eyebrow')?.textContent).toBe(t.heroEyebrow);
    expect(document.body.textContent).toContain(t.feature1Title);
    expect(document.body.textContent).toContain(t.trust1Copy);
    const nav = [...document.querySelectorAll('a.nav-link')].map((element) =>
      hrefOf(element as HTMLAnchorElement),
    );
    expect(nav).toContain('/login');
    expect(nav).toContain('/register');
    const cta = [...document.querySelectorAll('a.button')].map((element) =>
      hrefOf(element as HTMLAnchorElement),
    );
    expect(cta).toContain('/register');
    expect(document.body.textContent).toContain(t.closingGuestCta);
  });

  it('speaks the guest dictionary on the es tree and links its routes', async () => {
    sessionState.isHydrated = true;
    await render('es');
    const t = labels('es').landing;
    expect(document.querySelector('h1')?.textContent).toBe(t.heroTitle);
    const nav = [...document.querySelectorAll('a.nav-link')].map((element) =>
      hrefOf(element as HTMLAnchorElement),
    );
    expect(nav).toContain('/es/login');
    expect(nav).toContain('/es/register');
    const cta = [...document.querySelectorAll('a.button')].map((element) =>
      hrefOf(element as HTMLAnchorElement),
    );
    expect(cta).toContain('/es/register');
    expect(document.body.textContent).toContain(t.feature1Title);
  });

  it('sets the document language on every mount so the switch never sticks', async () => {
    sessionState.isHydrated = true;
    await render('es');
    expect(document.documentElement.lang).toBe('es');
    await render('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('switches the calls to the signed-in set when a session hydrates', async () => {
    sessionState.isHydrated = true;
    sessionState.session = {
      accessToken: 'token-1',
      refreshToken: 'refresh-1',
      user: {
        id: 'user-1',
        email: 'juan@example.com',
        verified: true,
        created_at: '2026-10-25T00:00:00.000Z',
      },
    };
    await render('en');
    const t = labels('en').landing;
    const nav = [...document.querySelectorAll('a.nav-link')].map((element) =>
      hrefOf(element as HTMLAnchorElement),
    );
    expect(nav).toContain('/app');
    expect(document.body.textContent).toContain(t.openProfile);
    expect(document.body.textContent).toContain(t.closingSignInCopy);
  });

  it('degrades to the visible state when the reveal observer is missing', async () => {
    sessionState.isHydrated = true;
    await render('es');
    // The jsdom window has no IntersectionObserver: the useReveal guard
    // marks the sections visible immediately so the content stays readable.
    const hero = document.querySelector('.landing-hero');
    expect(hero?.className).toContain('is-visible');
  });
});
