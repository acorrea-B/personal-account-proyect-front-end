// @vitest-environment jsdom
import { act } from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
  usePathname: () => null,
}));

vi.mock('@/lib/auth/session', async () => ({
  ...(await vi.importActual<typeof import('@/lib/auth/session')>('@/lib/auth/session')),
  signOut: vi.fn(),
}));

import { AccountMenu } from '../components/account-menu';
import { signOut } from '@/lib/auth/session';

function clickButton(label: string): void {
  const buttons = [...document.querySelectorAll('button')];
  const target = buttons.find((button) => button.textContent?.includes(label));
  if (!target) {
    throw new Error(`button not found: ${label}`);
  }
  target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

describe('AccountMenu sign out wiring', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    replaceMock.mockClear();
    vi.mocked(signOut).mockClear();
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

  it('routes to the logout page instead of signing out in place', async () => {
    await act(async () => {
      root = createRoot(container as HTMLDivElement);
      root.render(createElement(AccountMenu));
    });

    await act(async () => {
      clickButton('Account');
    });

    await act(async () => {
      clickButton('Sign out');
    });

    // Sign out navigates: the /logout/ route owns the revoke+clear+redirect
    // flow - the menu itself never mutates the session in place (the
    // mounted page would keep its in-memory session and look signed in).
    expect(replaceMock).toHaveBeenCalledWith('/logout/');
  });
});
