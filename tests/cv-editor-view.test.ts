// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pushMock = vi.fn();
const replaceMock = vi.fn();
const routerStub = { push: pushMock, replace: replaceMock };

vi.mock('next/navigation', () => ({
  useRouter: () => routerStub,
  usePathname: () => null,
}));

const requireAuthMock = vi.fn();
vi.mock('@/lib/auth/useRequireAuth', () => ({
  useRequireAuth: () => requireAuthMock(),
}));

const fetchCvMock = vi.fn();
const saveCvMock = vi.fn();
vi.mock('@/lib/api/cv', async () => ({
  ...(await vi.importActual<typeof import('@/lib/api/cv')>('@/lib/api/cv')),
  fetchCvText: (...args: unknown[]) => fetchCvMock(...args),
  saveCvText: (...args: unknown[]) => saveCvMock(...args),
}));

import { ProblemError } from '@/lib/api/client';
import { maxCvContentBytes } from '@/lib/schemas/cv';
import { labels } from '@/lib/i18n';
import { CvEditorView } from '../components/cv-editor-view';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const LOADED_CV = { id: 'cv-1', content: '# Juan', updated_at: '2026-10-27T09:00:00.000Z' };

function typeContent(value: string): void {
  const area = document.querySelector<HTMLTextAreaElement>('textarea');
  if (!area) {
    throw new Error('textarea not found');
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  setter?.call(area, value);
  area.dispatchEvent(new Event('input', { bubbles: true }));
}

async function save(): Promise<void> {
  const button = [...document.querySelectorAll('button')].find(
    (button) => button.type === 'submit',
  );
  if (!button) {
    throw new Error('save button not found');
  }
  await act(async () => {
    button.click();
  });
  await act(async () => {
    await Promise.resolve();
  });
}

describe('CvEditorView', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    pushMock.mockClear();
    replaceMock.mockClear();
    fetchCvMock.mockReset();
    saveCvMock.mockReset();
    fetchCvMock.mockResolvedValue(LOADED_CV);
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
      root.render(createElement(CvEditorView, { locale }));
    });
  }

  it('opens the loaded cv with the dictionary chrome on the en tree', async () => {
    await render('en');
    const t = labels('en').cvEditor;
    expect(document.querySelector('h1')?.textContent).toBe(t.title);
    expect(document.querySelector('.workspace-identity .eyebrow')?.textContent).toBe(
      labels('en').workspace.eyebrow,
    );
    const area = document.querySelector<HTMLTextAreaElement>('textarea');
    expect(area?.value).toBe('# Juan');
    expect(area?.getAttribute('aria-label')).toBe(t.textareaAria);
    expect(document.body.textContent).toContain(
      `${LOADED_CV.content.length} / ${maxCvContentBytes} bytes`,
    );
    const back = [...document.querySelectorAll('a')].find((link) =>
      link.textContent?.includes(t.back),
    );
    expect((back?.getAttribute('href') ?? '').replace(/\/+$/, '')).toBe('/app');
  });

  it('opens the loaded cv with the dictionary chrome on the es tree', async () => {
    await render('es');
    const t = labels('es').cvEditor;
    expect(document.querySelector('h1')?.textContent).toBe(t.title);
    const saveButton = [...document.querySelectorAll('button')].find((button) =>
      button.textContent?.includes(t.save),
    );
    expect(saveButton).toBeDefined();
    const back = [...document.querySelectorAll('a')].find((link) =>
      link.textContent?.includes(t.back),
    );
    expect((back?.getAttribute('href') ?? '').replace(/\/+$/, '')).toBe('/es/app');
  });

  it('saves and notes the archived previous version with the toast', async () => {
    await render('en');
    typeContent('# Juan updated');
    saveCvMock.mockResolvedValueOnce({
      cv: { id: 'cv-1', updated_at: '2026-10-27T12:00:00.000Z' },
      previous_version_archived: true,
    });
    await save();
    expect(saveCvMock).toHaveBeenCalledWith('token-1', '# Juan updated', LOADED_CV.updated_at);
    expect(document.body.textContent).toContain(labels('en').cvEditor.savedNote);
    expect(document.querySelector('.save-toast')?.textContent).toContain(
      labels('en').versionDetail.restoredNote,
    );
  });

  it('keeps the draft untouched and offers the reload on a 412', async () => {
    await render('es');
    typeContent('# Mi borrador');
    saveCvMock.mockRejectedValueOnce(new ProblemError({ status: 412, title: 'conflict' }));
    await save();
    const area = document.querySelector<HTMLTextAreaElement>('textarea');
    expect(area?.value).toBe('# Mi borrador');
    expect(document.querySelector('.form-error')?.textContent).toContain(
      labels('es').cvEditor.stale,
    );
    const reload = [...document.querySelectorAll('button')].find((button) =>
      button.textContent?.includes(labels('es').cvEditor.reloadAction),
    );
    expect(reload).toBeDefined();
  });

  it('names the byte ceiling on a 413', async () => {
    await render('en');
    typeContent('x'.repeat(8));
    saveCvMock.mockRejectedValueOnce(
      new ProblemError({ status: 413, max_bytes: maxCvContentBytes, title: 'too large' }),
    );
    await save();
    expect(document.body.textContent).toContain(
      labels('en').cvEditor.limitNote.replace('{bytes}', String(maxCvContentBytes)),
    );
  });

  it('speaks the save rate cap on a 429 (the window the en mirror missed)', async () => {
    await render('en');
    typeContent('# Juan');
    saveCvMock.mockRejectedValueOnce(new ProblemError({ status: 429, title: 'rate limited' }));
    await save();
    expect(document.body.textContent).toContain(labels('en').cvEditor.saveRateCapped);
  });
});
