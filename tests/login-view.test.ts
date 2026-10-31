// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

vi.mock('@/lib/auth/session', async () => ({
  ...(await vi.importActual<typeof import('@/lib/auth/session')>('@/lib/auth/session')),
  saveSession: vi.fn(),
  savePendingVerificationEmail: vi.fn(),
}));

const loginMock = vi.fn();
vi.mock('@/lib/api/client', async () => ({
  ...(await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client')),
  login: (...args: unknown[]) => loginMock(...args),
}));

import { ProblemError } from '@/lib/api/client';
import { savePendingVerificationEmail, saveSession } from '@/lib/auth/session';
import { labels } from '@/lib/i18n';
import { LoginView } from '../components/login-view';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

function anchorByLabel(text: string): HTMLAnchorElement {
  const anchor = [...document.querySelectorAll<HTMLAnchorElement>('a')].find((link) =>
    link.textContent?.includes(text),
  );
  if (!anchor) {
    throw new Error(`anchor not found: ${text}`);
  }
  return anchor;
}

function typeInto(field: string, value: string): void {
  const input = document.querySelector<HTMLInputElement>(`input[name="${field}"]`);
  if (!input) {
    throw new Error(`input not found: ${field}`);
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function submitForm(): Promise<void> {
  const form = document.querySelector('form');
  if (!form) {
    throw new Error('form not found');
  }
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

describe('LoginView', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    pushMock.mockClear();
    vi.mocked(saveSession).mockClear();
    vi.mocked(savePendingVerificationEmail).mockClear();
    loginMock.mockReset();
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
      root.render(createElement(LoginView, { locale }));
    });
  }

  it('speaks the english dictionary and links the en routes', async () => {
    await render('en');
    const t = labels('en').login;
    expect(document.querySelector('h1')?.textContent).toBe(t.heading);
    expect(document.body.textContent).toContain(t.subtitle);
    expect(document.body.textContent).toContain(t.email);
    expect(document.body.textContent).toContain(t.password);
    expect(anchorByLabel(t.registerEntry).getAttribute('href')).toBe('/register/');
    const languageEntry = anchorByLabel(t.otherLanguage);
    expect(languageEntry.getAttribute('href')).toBe('/es/');
    expect(languageEntry.getAttribute('hrefLang')).toBe('es');
  });

  it('speaks the spanish dictionary and links the es routes', async () => {
    await render('es');
    const t = labels('es').login;
    expect(document.querySelector('h1')?.textContent).toBe(t.heading);
    expect(anchorByLabel(t.registerEntry).getAttribute('href')).toBe('/es/register/');
    const languageEntry = anchorByLabel(t.otherLanguage);
    expect(languageEntry.getAttribute('href')).toBe('/');
    expect(languageEntry.getAttribute('hrefLang')).toBe('en');
  });

  it('maps the 401 problem to the dictionary label of the tree', async () => {
    for (const locale of ['en', 'es'] as const) {
      await render(locale);
      typeInto('email', 'juan@example.com');
      typeInto('password', 'contraseña1');
      loginMock.mockRejectedValueOnce(
        new ProblemError({ status: 401, title: 'invalid credentials' }),
      );
      await submitForm();
      expect(document.querySelector('div[role="alert"]')?.textContent).toContain(
        labels(locale).login.invalid,
      );
      expect(saveSession).not.toHaveBeenCalled();
      expect(pushMock).not.toHaveBeenCalled();
    }
  });

  it("hands the 403 unverified email to the tree's verification view", async () => {
    for (const locale of ['en', 'es'] as const) {
      const prefix = locale === 'es' ? '/es' : '';
      await render(locale);
      typeInto('email', 'juan@example.com');
      typeInto('password', 'contraseña1');
      loginMock.mockRejectedValueOnce(
        new ProblemError({ status: 403, title: 'email not verified' }),
      );
      await submitForm();
      expect(savePendingVerificationEmail).toHaveBeenCalledWith('juan@example.com');
      expect(pushMock).toHaveBeenCalledWith(`${prefix}/register/confirm/`);
      expect(saveSession).not.toHaveBeenCalled();
    }
  });

  it('formats the 429 rate cap with the retry seconds and the tree voice', async () => {
    for (const locale of ['en', 'es'] as const) {
      await render(locale);
      typeInto('email', 'juan@example.com');
      typeInto('password', 'contraseña1');
      loginMock.mockRejectedValueOnce(new ProblemError({ status: 429, retry_after_seconds: 12 }));
      await submitForm();
      const expected = labels(locale).login.rateCappedWithSeconds.replace('{seconds}', '12');
      expect(document.querySelector('div[role="alert"]')?.textContent).toContain(expected);
    }
  });
});
