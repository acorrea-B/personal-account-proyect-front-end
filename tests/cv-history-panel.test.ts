// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getVersionsMock = vi.fn();
vi.mock('@/lib/api/cv', async () => ({
  ...(await vi.importActual<typeof import('@/lib/api/cv')>('@/lib/api/cv')),
  getVersions: (...args: unknown[]) => getVersionsMock(...args),
}));

import { CvHistoryPanel } from '../components/cv-history-panel';
import { ProblemError } from '@/lib/api/client';
import { labels } from '../lib/i18n';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const VERSION = {
  id: '11111111-1111-4111-8111-111111111111',
  origin: 'user' as const,
  archived_at: '2026-10-27T09:00:00.000Z',
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function render(accessToken: string, refreshKey: number) {
  await act(async () => {
    root ??= createRoot(container as HTMLDivElement);
    root.render(
      createElement(CvHistoryPanel, {
        accessToken,
        locale: 'es',
        currentUpdatedAt: undefined,
        refreshKey,
        onRestored: vi.fn(),
      }),
    );
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  getVersionsMock.mockReset();
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('CvHistoryPanel', () => {
  it('lists the archived versions with their view action', async () => {
    getVersionsMock.mockResolvedValue([VERSION]);
    await render('token-1', 0);
    const t = labels('es').history;
    expect(document.querySelector('aside')?.getAttribute('aria-label')).toBe(t.title);
    expect(document.querySelectorAll(`ol[aria-label="${t.listAria}"] li`)).toHaveLength(1);
    expect(getVersionsMock).toHaveBeenCalledWith('token-1');
  });

  it('reads the versions again on a new refresh key, never on a renewed token alone', async () => {
    getVersionsMock.mockResolvedValue([]);
    await render('token-1', 0);
    await render('token-2', 0);
    expect(getVersionsMock).toHaveBeenCalledTimes(1);
    await render('token-2', 1);
    expect(getVersionsMock).toHaveBeenCalledTimes(2);
    expect(getVersionsMock).toHaveBeenLastCalledWith('token-2');
  });

  it('keeps a failure inside the card and retries with the current token', async () => {
    getVersionsMock.mockRejectedValueOnce(new ProblemError({ status: 429 }));
    await render('token-1', 0);
    expect(document.body.textContent).toContain(labels('es').workspace.cvRateCapped);
    await render('token-2', 0);
    getVersionsMock.mockResolvedValue([VERSION]);
    const retry = [...document.querySelectorAll('button')].find(
      (button) => button.textContent === labels('es').cvCard.retry,
    );
    expect(retry).toBeDefined();
    await act(async () => retry?.click());
    expect(getVersionsMock).toHaveBeenLastCalledWith('token-2');
  });
});
