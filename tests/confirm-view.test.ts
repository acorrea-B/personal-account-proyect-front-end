// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

const readPendingMock = vi.fn<() => string | null>(() => null);
vi.mock('@/lib/auth/session', async () => ({
  ...(await vi.importActual<typeof import('@/lib/auth/session')>('@/lib/auth/session')),
  readPendingVerificationEmail: () => readPendingMock(),
}));

const resendMock = vi.fn();
vi.mock('@/lib/api/client', async () => ({
  ...(await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client')),
  resendVerification: (...args: unknown[]) => resendMock(...args),
}));

import { ProblemError } from '@/lib/api/client';
import { labels, tr } from '@/lib/i18n';
import { ConfirmView } from '../components/confirm-view';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

function typeInto(field: string, value: string): void {
  const input = document.querySelector<HTMLInputElement>(`input[name="${field}"]`);
  if (!input) {
    throw new Error(`input not found: ${field}`);
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function submitForm(): Promise<HTMLButtonElement> {
  const form = document.querySelector('form');
  if (!form) {
    throw new Error('form not found');
  }
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  const button = document.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!button) {
    throw new Error('submit button not found');
  }
  return button;
}

// A fresh render always arms the three-minute resend cooldown; open the
// window again by draining the whole cooldown inside act.
async function drainCooldown(): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(181_000);
  });
}

describe('ConfirmView', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    pushMock.mockClear();
    resendMock.mockReset();
    readPendingMock.mockClear();
    window.sessionStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => root?.unmount());
    }
    container?.remove();
    root = null;
    vi.useRealTimers();
  });

  async function render(locale: 'en' | 'es'): Promise<void> {
    if (root) {
      const previous = root;
      root = null;
      await act(async () => previous.unmount());
    }
    await act(async () => {
      root = createRoot(container as HTMLDivElement);
      root.render(createElement(ConfirmView, { locale }));
    });
  }

  it('explains the login handoff with the pending email in both trees', async () => {
    for (const locale of ['en', 'es'] as const) {
      readPendingMock.mockReturnValueOnce('juan@example.com');
      await render(locale);
      const t = labels(locale).confirm;
      expect(document.querySelector('h1')?.textContent).toBe(t.heading);
      const intro = document.querySelector('section > p')?.textContent ?? '';
      expect(intro).toContain(t.pendingPrefix);
      expect(intro).toContain('juan@example.com');
      expect(intro).toContain(t.pendingSuffix);
      expect(document.body.textContent).toContain(t.pendingNote);
    }
  });

  it('explains the fresh registration path and arms the cooldown', async () => {
    await render('en');
    const t = labels('en').confirm;
    expect(document.body.textContent).toContain(t.freshCopy);
    expect(document.body.textContent).toContain(t.freshNote);
    const button = document.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(button?.disabled).toBe(true);
    expect(button?.textContent).toBe(tr(t.resendIn, { label: '03:00' }));
  });

  it('resends the verification message once the cooldown opens', async () => {
    await render('en');
    typeInto('email', 'juan@example.com');
    await drainCooldown();
    const buttonBefore = document.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(buttonBefore?.textContent).toBe(labels('en').confirm.resend);
    expect(buttonBefore?.disabled).toBe(false);
    resendMock.mockResolvedValueOnce({ message: 'Verification email sent' });
    const button = await submitForm();
    expect(resendMock).toHaveBeenCalled();
    expect(document.querySelector('div[role="status"]')?.textContent).toContain(
      'Verification email sent',
    );
    expect(button.disabled).toBe(true);
  });

  it("routes the 429 problem back to the tree's registration page", async () => {
    for (const locale of ['en', 'es'] as const) {
      const prefix = locale === 'es' ? '/es' : '';
      await render(locale);
      typeInto('email', 'juan@example.com');
      await drainCooldown();
      resendMock.mockRejectedValueOnce(new ProblemError({ status: 429, title: 'rate limited' }));
      await act(async () => {
        submitFormSafely();
      });
      await act(async () => {
        // The rejection settled and scheduled the router push; now the
        // 1200 ms delay expires on the controlled clock.
        vi.advanceTimersByTime(1201);
      });
      expect(document.querySelector('div[role="alert"]')?.textContent).toContain(
        labels(locale).confirm.rateCapped,
      );
      expect(pushMock).toHaveBeenCalledWith(`${prefix}/register/`);
    }
  });
});

function submitFormSafely(): void {
  const form = document.querySelector('form');
  if (form) {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }
}
