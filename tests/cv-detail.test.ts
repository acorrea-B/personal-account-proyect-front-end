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
import { CvCard } from '../components/cv-card';
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

// next/link normalizes trailing slashes in the jsdom environment (no
// router config there) while the static export keeps them; compare the
// canonical path so the assertion is honest on both runtimes.
function hrefOf(anchor: HTMLAnchorElement | null): string {
  return (anchor?.getAttribute('href') ?? '').replace(/\/+$/, '') || '/';
}

describe('CvCard', () => {
  it("points both actions at the tree's cv editor", async () => {
    const { act, createElement } = await import('react');
    const { createRoot } = await import('react-dom/client');
    const container = document.createElement('div');
    document.body.appendChild(container);

    const saved = {
      kind: 'ready' as const,
      cv: {
        id: 'cv-1',
        content: 'text',
        created_at: '2026-10-26T09:00:00.000Z',
        updated_at: '2026-10-27T09:00:00.000Z',
      },
    };
    await act(async () => {
      createRoot(container).render(createElement(CvCard, { state: saved, locale: 'en' }));
    });
    expect([...container.querySelectorAll('a')].map(hrefOf)).toContain('/app/cv');

    const empty = { kind: 'empty' as const };
    await act(async () => {
      createRoot(container).render(createElement(CvCard, { state: empty, locale: 'en' }));
    });
    expect([...container.querySelectorAll('a')].map(hrefOf)).toContain('/app/cv');
    container.remove();
  });

  it('points the es tree at /es/app/cv (the english tree never takes over)', async () => {
    const { act, createElement } = await import('react');
    const { createRoot } = await import('react-dom/client');
    const container = document.createElement('div');
    document.body.appendChild(container);

    const saved = {
      kind: 'ready' as const,
      cv: {
        id: 'cv-1',
        content: 'texto',
        created_at: '2026-10-26T09:00:00.000Z',
        updated_at: '2026-10-27T09:00:00.000Z',
      },
    };
    await act(async () => {
      createRoot(container).render(createElement(CvCard, { state: saved, locale: 'es' }));
    });
    expect([...container.querySelectorAll('a')].map(hrefOf)).toContain('/es/app/cv');
    expect(container.textContent).toContain(labels('es').cvCard.edit);
    const empty = { kind: 'empty' as const };
    await act(async () => {
      createRoot(container).render(createElement(CvCard, { state: empty, locale: 'es' }));
    });
    expect([...container.querySelectorAll('a')].map(hrefOf)).toContain('/es/app/cv');
    expect(container.textContent).toContain(labels('es').cvCard.write);
    container.remove();
  });
});

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
    expect(document.querySelector('.cv-version-heading')?.textContent).toBe(
      `Version from ${formatWhen(DETAIL.archived_at)}`,
    );
    expect(document.body.textContent).toContain(t.restore);
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(DETAIL.content);
  });

  it('speaks the spanish dictionary over the detail', async () => {
    await render('es');
    const t = labels('es').versionDetail;
    expect(document.querySelector('.cv-version-heading')?.textContent).toBe(
      t.viewHeading.replace('{date}', formatWhen(DETAIL.archived_at)),
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
