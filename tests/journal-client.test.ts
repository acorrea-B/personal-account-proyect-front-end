import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProblemError } from '../lib/api/client';
import {
  confirmJournalConsent,
  createJournalEntry,
  deleteJournalEntry,
  fetchJournalConsent,
  fetchJournalEntries,
} from '../lib/api/journal';

const USER = '11111111-1111-4111-8111-111111111111';
const ENTRY = '22222222-2222-4222-8222-222222222222';
const SKILL = '33333333-3333-4333-8333-333333333333';

const entry = {
  id: ENTRY,
  user_id: USER,
  occurred_at: '2026-10-30T12:00:00Z',
  text: 'Shipped the payments migration.',
  user_confirmed_as_evidence: true,
  linked_skill_ids: [SKILL],
  linked_role_ids: [],
  evidence_refs: [],
  consent_version: 'journal-v1',
  created_at: '2026-10-30T12:01:00Z',
};

function respond(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function call(fetchMock: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { url, init, headers: init.headers as Record<string, string> };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('journal consent', () => {
  it('reads the active version with the Bearer token', async () => {
    const fetchMock = respond({
      version: 'journal-v1',
      consent_text: 'Your entries stay yours.',
      effective_from: '2026-10-01T00:00:00Z',
      active: true,
    });
    const consent = await fetchJournalConsent('token');
    expect(consent.version).toBe('journal-v1');
    const { url, headers } = call(fetchMock);
    expect(url).toMatch(/\/v1\/consents\/journal$/);
    expect(headers.Authorization).toBe('Bearer token');
  });

  it('confirms the version it showed', async () => {
    const fetchMock = respond(
      { user_id: USER, consent_version: 'journal-v1', confirmed_at: '2026-10-31T10:00:00Z' },
      201,
    );
    const confirmation = await confirmJournalConsent('token', 'journal-v1');
    expect(confirmation.consent_version).toBe('journal-v1');
    const { url, init } = call(fetchMock);
    expect(url).toMatch(/\/v1\/consents\/journal\/confirm$/);
    expect(JSON.parse(init.body as string)).toEqual({ consent_version: 'journal-v1' });
  });
});

describe('journal entries', () => {
  it('lists the entries with a bounded limit', async () => {
    const fetchMock = respond({ entries: [entry] });
    const entries = await fetchJournalEntries('token', 999);
    expect(entries[0]?.text).toBe('Shipped the payments migration.');
    expect(call(fetchMock).url).toMatch(/\/v1\/journal\/entries\?limit=200$/);
  });

  it('creates an entry with the trimmed text, links and consent version', async () => {
    const fetchMock = respond(entry, 201);
    await createJournalEntry('token', {
      text: '  Shipped the payments migration.  ',
      user_confirmed_as_evidence: true,
      linked_skill_ids: [SKILL],
      consent_version: 'journal-v1',
    });
    const { init } = call(fetchMock);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      text: 'Shipped the payments migration.',
      user_confirmed_as_evidence: true,
      linked_skill_ids: [SKILL],
      consent_version: 'journal-v1',
    });
  });

  it('refuses an empty or over-long text before any request', async () => {
    const fetchMock = respond(entry, 201);
    const base = { user_confirmed_as_evidence: false, linked_skill_ids: [], consent_version: 'v1' };
    await expect(createJournalEntry('token', { ...base, text: '   ' })).rejects.toThrow();
    await expect(
      createJournalEntry('token', { ...base, text: 'x'.repeat(4001) }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deletes by the encoded id and accepts the empty 204', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    await deleteJournalEntry('token', ENTRY);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(new RegExp(`/v1/journal/entries/${ENTRY}$`));
    expect(init.method).toBe('DELETE');
  });

  it('surfaces a 404 on delete as a ProblemError', async () => {
    respond({ status: 404, title: 'Not Found' }, 404);
    await expect(deleteJournalEntry('token', ENTRY)).rejects.toBeInstanceOf(ProblemError);
  });

  it('fails closed on an entry without its id', async () => {
    respond({ entries: [{ ...entry, id: undefined }] });
    await expect(fetchJournalEntries('token')).rejects.toThrow();
  });
});
