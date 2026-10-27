// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

const registerMock = vi.fn();
vi.mock('@/lib/api/client', async () => ({
  ...(await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client')),
  register: (...args: unknown[]) => registerMock(...args),
}));

import { ProblemError } from '@/lib/api/client';
import { labels } from '@/lib/i18n';
import { RegisterView } from '../components/register-view';

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

describe('RegisterView', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    pushMock.mockClear();
    registerMock.mockReset();
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
    await act(async () => {
      root = createRoot(container as HTMLDivElement);
      root.render(createElement(RegisterView, { locale }));
    });
  }

  it('speaks the english dictionary: copy, stepper and routes', async () => {
    await render('en');
    const t = labels('en').register;
    expect(document.querySelector('h1')?.textContent).toBe(t.heading);
    expect(document.body.textContent).toContain(t.kicker);
    expect(document.body.textContent).toContain(t.stepAccount);
    expect(document.body.textContent).toContain(t.stepVerify);
    expect(document.body.textContent).toContain(t.stepProfile);
    expect(anchorByLabel(t.loginEntry).getAttribute('href')).toBe('/login/');
    const languageEntry = anchorByLabel(t.otherLanguage);
    expect(languageEntry.getAttribute('href')).toBe('/es/');
    expect(languageEntry.getAttribute('hrefLang')).toBe('es');
  });

  it('speaks the spanish dictionary: copy, stepper and routes', async () => {
    await render('es');
    const t = labels('es').register;
    expect(document.querySelector('h1')?.textContent).toBe(t.heading);
    expect(anchorByLabel(t.loginEntry).getAttribute('href')).toBe('/es/login/');
    const languageEntry = anchorByLabel(t.otherLanguage);
    expect(languageEntry.getAttribute('href')).toBe('/');
    expect(languageEntry.getAttribute('hrefLang')).toBe('en');
  });

  it("registers and hands the account to the tree's confirm view", async () => {
    for (const locale of ['en', 'es'] as const) {
      const prefix = locale === 'es' ? '/es' : '';
      await render(locale);
      typeInto('email', 'juan@example.com');
      typeInto('password', 'contraseña1');
      registerMock.mockResolvedValueOnce(undefined);
      await submitForm();
      expect(registerMock).toHaveBeenCalledWith({
        email: 'juan@example.com',
        password: 'contraseña1',
      });
      expect(pushMock).toHaveBeenCalledWith(`${prefix}/register/confirm/`);
    }
  });

  it('maps the 409 conflict to the dictionary label of the tree', async () => {
    for (const locale of ['en', 'es'] as const) {
      await render(locale);
      typeInto('email', 'juan@example.com');
      typeInto('password', 'contraseña1');
      registerMock.mockRejectedValueOnce(new ProblemError({ status: 409, title: 'email taken' }));
      await submitForm();
      expect(document.querySelector('.form-error')?.textContent).toContain(
        labels(locale).register.conflict,
      );
    }
  });

  it('formats the 429 rate cap with the retry seconds and the tree voice', async () => {
    for (const locale of ['en', 'es'] as const) {
      await render(locale);
      typeInto('email', 'juan@example.com');
      typeInto('password', 'contraseña1');
      registerMock.mockRejectedValueOnce(new ProblemError({ status: 429, retry_after_seconds: 7 }));
      await submitForm();
      const expected = labels(locale).register.rateCappedWithSeconds.replace('{seconds}', '7');
      expect(document.querySelector('.form-error')?.textContent).toContain(expected);
    }
  });
});
