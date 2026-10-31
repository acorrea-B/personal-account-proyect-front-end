// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => null,
}));

const requireAuthMock = vi.fn();
vi.mock('@/lib/auth/useRequireAuth', () => ({
  useRequireAuth: () => requireAuthMock(),
}));

vi.mock('@/lib/api/journal', () => ({
  fetchJournalConsent: vi.fn(),
  confirmJournalConsent: vi.fn(),
  fetchJournalEntries: vi.fn(),
  createJournalEntry: vi.fn(),
  deleteJournalEntry: vi.fn(),
}));
vi.mock('@/lib/api/suggestions', () => ({
  fetchProfileSkills: vi.fn(),
}));

import { JournalView } from '../components/journal-view';
import {
  confirmJournalConsent,
  createJournalEntry,
  deleteJournalEntry,
  fetchJournalConsent,
  fetchJournalEntries,
} from '@/lib/api/journal';
import { fetchProfileSkills } from '@/lib/api/suggestions';
import { labels, tr, type Locale } from '../lib/i18n';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const SKILL = '33333333-3333-4333-8333-333333333333';
const consent = {
  version: 'journal-v1',
  consent_text: 'Your entries stay private to you.',
  effective_from: '2026-10-01T00:00:00Z',
  active: true,
};
const entry = (id: string, text: string, version = 'journal-v1') => ({
  id,
  occurred_at: '2026-10-30T12:00:00Z',
  text,
  user_confirmed_as_evidence: true,
  linked_skill_ids: [SKILL],
  consent_version: version,
  created_at: '2026-10-30T12:01:00Z',
});
const E1 = '44444444-4444-4444-8444-444444444441';
const E2 = '44444444-4444-4444-8444-444444444442';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function render(locale: Locale = 'en') {
  await act(async () => {
    root = createRoot(container as HTMLDivElement);
    root.render(createElement(JournalView, { locale }));
  });
}

async function click(match: (button: HTMLButtonElement) => boolean) {
  const target = [...document.querySelectorAll('button')].find(match);
  if (!target) {
    throw new Error('button not found');
  }
  await act(async () => {
    target.click();
  });
}

const byText = (text: string) => (button: HTMLButtonElement) => button.textContent?.trim() === text;

beforeEach(() => {
  requireAuthMock.mockReturnValue({
    isHydrated: true,
    isAuthorized: true,
    session: { accessToken: 'token', refreshToken: 'refresh', user: { email: 'juan@example.com' } },
  });
  vi.mocked(fetchJournalConsent).mockReset().mockResolvedValue(consent);
  vi.mocked(fetchJournalEntries).mockReset();
  vi.mocked(confirmJournalConsent).mockReset();
  vi.mocked(createJournalEntry).mockReset();
  vi.mocked(deleteJournalEntry).mockReset();
  vi.mocked(fetchProfileSkills)
    .mockReset()
    .mockResolvedValue([
      {
        id: SKILL,
        skill_key: 'rust',
        display_name: 'Rust',
        category: 'language',
        claim_status: 'unverified',
        origin: 'declared',
      },
    ]);
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

describe('JournalView', () => {
  it('asks for the active journal consent before the first entry', async () => {
    vi.mocked(fetchJournalEntries).mockResolvedValue([]);
    vi.mocked(confirmJournalConsent).mockResolvedValue({
      user_id: '11111111-1111-4111-8111-111111111111',
      consent_version: 'journal-v1',
      confirmed_at: '2026-10-31T10:00:00Z',
    });
    await render('es');
    const j = labels('es').journal;
    expect(document.body.textContent).toContain('Your entries stay private to you.');
    expect(document.querySelector('textarea')).toBeNull();
    await click(byText(j.consentConfirm));
    expect(confirmJournalConsent).toHaveBeenCalledWith('token', 'journal-v1');
    expect(document.querySelector('textarea')).not.toBeNull();
    expect(document.body.textContent).toContain(j.empty);
  });

  it('treats an entry under the active version as consent and lists it with its skills', async () => {
    vi.mocked(fetchJournalEntries).mockResolvedValue([entry(E1, 'Shipped payments.')]);
    await render('en');
    const j = labels('en').journal;
    expect(document.body.textContent).not.toContain(j.consentConfirm);
    expect(document.body.textContent).toContain('Shipped payments.');
    expect(document.body.textContent).toContain(j.evidenceBadge);
    expect(document.querySelector(`ul[aria-label="${j.listAria}"]`)?.textContent).toContain('Rust');
  });

  it('asks again when the entries were written under an older version', async () => {
    vi.mocked(fetchJournalEntries).mockResolvedValue([entry(E1, 'Old one.', 'journal-v0')]);
    await render('en');
    expect(document.body.textContent).toContain(labels('en').journal.consentConfirm);
  });

  it('saves an entry with the linked skill and the consent version, newest first', async () => {
    vi.mocked(fetchJournalEntries).mockResolvedValue([entry(E1, 'Shipped payments.')]);
    vi.mocked(createJournalEntry).mockResolvedValue(entry(E2, 'Led the incident review.'));
    await render('en');
    const j = labels('en').journal;
    await act(async () => {
      const area = document.querySelector('textarea') as HTMLTextAreaElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(area, 'Led the incident review.');
      area.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click((button) => button.getAttribute('aria-pressed') !== null);
    await click(byText(j.save));
    expect(createJournalEntry).toHaveBeenCalledWith('token', {
      text: 'Led the incident review.',
      user_confirmed_as_evidence: true,
      linked_skill_ids: [SKILL],
      consent_version: 'journal-v1',
    });
    const items = [...document.querySelectorAll(`ul[aria-label="${j.listAria}"] > li`)];
    expect(items[0]?.textContent).toContain('Led the incident review.');
    expect(document.querySelector('[role="status"]')?.textContent).toBe(j.saved);
  });

  it('keeps an entry saved while a delete is in flight', async () => {
    vi.mocked(fetchJournalEntries).mockResolvedValue([entry(E1, 'Shipped payments.')]);
    let finishDelete: () => void = () => {};
    vi.mocked(deleteJournalEntry).mockReturnValue(
      new Promise<void>((resolve) => {
        finishDelete = resolve;
      }),
    );
    vi.mocked(createJournalEntry).mockResolvedValue(entry(E2, 'Led the incident review.'));
    await render('en');
    const j = labels('en').journal;
    await click(
      (button) => button.getAttribute('aria-label')?.startsWith('Delete the entry') ?? false,
    );
    await click(byText(j.deleteConfirm));
    await act(async () => {
      const area = document.querySelector('textarea') as HTMLTextAreaElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(area, 'Led the incident review.');
      area.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click(byText(j.save));
    await act(async () => {
      finishDelete();
    });
    const list = document.querySelector(`ul[aria-label="${j.listAria}"]`)?.textContent ?? '';
    expect(list).toContain('Led the incident review.');
    expect(list).not.toContain('Shipped payments.');
  });

  it('freezes the composer while its entry saves', async () => {
    vi.mocked(fetchJournalEntries).mockResolvedValue([]);
    vi.mocked(confirmJournalConsent).mockResolvedValue({
      user_id: '11111111-1111-4111-8111-111111111111',
      consent_version: 'journal-v1',
      confirmed_at: '2026-10-31T10:00:00Z',
    });
    vi.mocked(createJournalEntry).mockReturnValue(new Promise(() => {}));
    await render('en');
    const j = labels('en').journal;
    await click(byText(j.consentConfirm));
    await act(async () => {
      const area = document.querySelector('textarea') as HTMLTextAreaElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(area, 'Draft');
      area.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click(byText(j.save));
    expect((document.querySelector('fieldset') as HTMLFieldSetElement).disabled).toBe(true);
  });

  it('deletes an entry only after the confirmation', async () => {
    vi.mocked(fetchJournalEntries).mockResolvedValue([entry(E1, 'Shipped payments.')]);
    vi.mocked(deleteJournalEntry).mockResolvedValue(undefined);
    await render('en');
    const j = labels('en').journal;
    await click(
      (button) => button.getAttribute('aria-label')?.startsWith('Delete the entry') ?? false,
    );
    expect(deleteJournalEntry).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(j.confirmDelete);
    await click(byText(j.deleteConfirm));
    expect(deleteJournalEntry).toHaveBeenCalledWith('token', E1);
    expect(document.body.textContent).toContain(j.empty);
  });

  it('offers a retry when the journal fails to load', async () => {
    vi.mocked(fetchJournalEntries).mockRejectedValueOnce(new Error('network'));
    await render('en');
    const j = labels('en').journal;
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(j.loadFailed);
    vi.mocked(fetchJournalEntries).mockResolvedValue([entry(E1, 'Back.')]);
    await click(byText(j.retry));
    expect(document.body.textContent).toContain('Back.');
    expect(tr(j.counter, { count: '0', max: '4000' })).toContain('4000');
  });
});
