// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/cv', async () => ({
  ...(await vi.importActual<typeof import('@/lib/api/cv')>('@/lib/api/cv')),
  getVersionDetail: vi.fn(),
  saveCvText: vi.fn(),
}));

import { CvVersionDetail } from '../components/cv-version-detail';
import { ProblemError } from '@/lib/api/client';
import { getVersionDetail, saveCvText } from '@/lib/api/cv';
import { formatWhen } from '../components/cv-timeline';
import { labels } from '@/lib/i18n';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const DETAIL = {
  id: 'version-1',
  origin: 'user',
  archived_at: '2026-10-27T09:00:00.000Z',
  content: 'The archived text.',
};

describe('CvVersionDetail', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    vi.mocked(getVersionDetail).mockReset();
    vi.mocked(saveCvText).mockReset();
    vi.mocked(getVersionDetail).mockResolvedValue({
      ...DETAIL,
    } as unknown as Awaited<ReturnType<typeof getVersionDetail>>);
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
      root.render(
        createElement(CvVersionDetail, {
          id: 'version-1',
          accessToken: 'token-1',
          currentUpdatedAt: '2026-10-27T08:00:00.000Z',
          onClose: () => undefined,
          onRestored: () => undefined,
          locale,
        }),
      );
    });
  }

  it('speaks the english dictionary over the detail', async () => {
    await render('en');
    const t = labels('en').versionDetail;
    expect(document.querySelector('#cv-version-title')?.textContent).toBe(
      `Version from ${formatWhen(DETAIL.archived_at)}`,
    );
    expect(document.body.textContent).toContain(t.restore);
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(DETAIL.content);
  });

  it('speaks the spanish dictionary over the detail', async () => {
    await render('es');
    const t = labels('es').versionDetail;
    expect(document.querySelector('#cv-version-title')?.textContent).toBe(
      t.viewHeading.replace('{date}', formatWhen(DETAIL.archived_at, 'es')),
    );
    expect(document.body.textContent).toContain(t.restore);
    expect(document.body.textContent).toContain(t.origin.replace('{origin}', 'user'));
  });

  it('names the restore conflict on a 412 in the tree language', async () => {
    await render('es');
    vi.mocked(saveCvText).mockRejectedValueOnce(
      new ProblemError({ status: 412, current_updated_at: '2026-10-27T09:30:00.000Z' }),
    );
    const restore = [...document.querySelectorAll('button')].find((button) =>
      button.textContent?.includes(labels('es').versionDetail.restore),
    );
    await act(async () => {
      restore?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(document.body.textContent).toContain(labels('es').versionDetail.conflictNote);
  });
});
