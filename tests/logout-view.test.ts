// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: replaceMock }),
}));

const signOutMock = vi.fn();
vi.mock('@/lib/auth/session', async () => ({
  ...(await vi.importActual<typeof import('@/lib/auth/session')>('@/lib/auth/session')),
  signOut: (...args: unknown[]) => signOutMock(...args),
}));

import { labels } from '@/lib/i18n';
import { LogoutView } from '../components/logout-view';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

describe('LogoutView', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    replaceMock.mockClear();
    signOutMock.mockReset();
    // A resolved sign-out by default; individual tests override it.
    signOutMock.mockResolvedValue(undefined);
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

  it('signs out and hands the user to the english sign-in page', async () => {
    await act(async () => {
      root = createRoot(container as HTMLDivElement);
      root.render(createElement(LogoutView, { locale: 'en' }));
    });
    expect(document.querySelector('h1')?.textContent).toBe(labels('en').logout.heading);
    await act(async () => {
      await Promise.resolve();
    });
    expect(signOutMock).toHaveBeenCalled();
    expect(replaceMock).toHaveBeenCalledWith('/login/');
  });

  it('signs out and hands the user to the spanish sign-in page', async () => {
    await act(async () => {
      root = createRoot(container as HTMLDivElement);
      root.render(createElement(LogoutView, { locale: 'es' }));
    });
    expect(document.querySelector('h1')?.textContent).toBe(labels('es').logout.heading);
    await act(async () => {
      await Promise.resolve();
    });
    expect(replaceMock).toHaveBeenCalledWith('/es/login/');
  });

  it('still redirects when the session revoke fails', async () => {
    signOutMock.mockRejectedValueOnce(new Error('network down'));
    await act(async () => {
      root = createRoot(container as HTMLDivElement);
      root.render(createElement(LogoutView, { locale: 'en' }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(replaceMock).toHaveBeenCalledWith('/login/');
  });
});
