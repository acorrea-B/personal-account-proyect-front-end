// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/es/app/evolution/',
}));

const requireAuthMock = vi.fn();
vi.mock('@/lib/auth/useRequireAuth', () => ({
  useRequireAuth: () => requireAuthMock(),
}));

vi.mock('@/lib/api/evolution', () => ({
  fetchEvolutionMode: vi.fn(),
  fetchEvolutionHistory: vi.fn(),
  declareEvolutionMode: vi.fn(),
}));

import { EvolutionView } from '../components/evolution-view';
import { fetchEvolutionHistory, fetchEvolutionMode } from '@/lib/api/evolution';
import { labels, type Locale } from '../lib/i18n';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function render(locale: Locale) {
  await act(async () => {
    root = createRoot(container as HTMLDivElement);
    root.render(createElement(EvolutionView, { locale }));
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  vi.mocked(fetchEvolutionMode).mockResolvedValue(null);
  vi.mocked(fetchEvolutionHistory).mockResolvedValue([]);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.clearAllMocks();
});

describe('EvolutionView', () => {
  it('waits behind the skeleton until the session is known', async () => {
    requireAuthMock.mockReturnValue({ isHydrated: false, isAuthorized: false, session: null });
    await render('es');
    expect(document.querySelector('main')?.getAttribute('aria-busy')).toBe('true');
    expect(fetchEvolutionMode).not.toHaveBeenCalled();
  });

  it('frames the evolution panel with the menu and the way home', async () => {
    requireAuthMock.mockReturnValue({
      isHydrated: true,
      isAuthorized: true,
      session: { accessToken: 'token', refreshToken: 'refresh', user: { email: 'a@b.co' } },
    });
    await render('es');
    const t = labels('es');
    expect(document.querySelector('h1')?.textContent).toBe(t.nav.evolution);
    expect(document.querySelector('main > a')?.textContent).toBe(t.nav.back);
    const current = document.querySelector('nav a[aria-current="page"]');
    expect(current?.textContent).toBe(t.nav.evolution);
    expect(document.querySelector(`section[aria-label="${t.evolution.title}"]`)).not.toBeNull();
    expect(fetchEvolutionMode).toHaveBeenCalledWith('token');
  });
});
