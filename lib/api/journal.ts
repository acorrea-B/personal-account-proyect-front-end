import type { z } from 'zod';

import { ProblemError, type Problem } from './client';
import {
  createJournalEntrySchema,
  journalConsentConfirmationSchema,
  journalConsentSchema,
  journalEntriesEnvelopeSchema,
  journalEntrySchema,
  journalListMax,
  type CreateJournalEntry,
  type JournalConsent,
  type JournalConsentConfirmation,
  type JournalEntry,
} from '../schemas/journal';

// The journal client (BC-003/BC-004): the active journal consent and its
// confirmation, and the user's entries (list, create, delete). Bearer only;
// answers are parsed fail-closed and a non-2xx answer is a ProblemError.

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
const requestTimeoutMs = 15_000;

async function send(
  path: string,
  accessToken: string,
  init: { method: 'GET' | 'POST' | 'DELETE'; body?: unknown } = { method: 'GET' },
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as Partial<Problem>;
      throw new ProblemError({
        type: body.type,
        title: body.title,
        status: body.status ?? response.status,
        detail: body.detail,
        fields: body.fields,
        retry_after_seconds: body.retry_after_seconds,
      });
    }
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function read<T extends z.ZodType>(response: Response, schema: T): Promise<z.infer<T>> {
  const data: unknown = await response.json();
  return schema.parse(data);
}

// GET /v1/consents/journal: the active version and its text.
export async function fetchJournalConsent(accessToken: string): Promise<JournalConsent> {
  return read(await send('/v1/consents/journal', accessToken), journalConsentSchema);
}

// POST /v1/consents/journal/confirm: idempotent on the api side (a second
// confirmation keeps the first timestamp).
export async function confirmJournalConsent(
  accessToken: string,
  consentVersion: string,
): Promise<JournalConsentConfirmation> {
  const response = await send('/v1/consents/journal/confirm', accessToken, {
    method: 'POST',
    body: { consent_version: consentVersion },
  });
  return read(response, journalConsentConfirmationSchema);
}

// GET /v1/journal/entries?limit=: newest first, at most 200.
export async function fetchJournalEntries(
  accessToken: string,
  limit = 50,
): Promise<JournalEntry[]> {
  const bounded = Math.min(Math.max(Math.trunc(limit), 1), journalListMax);
  const response = await send(`/v1/journal/entries?limit=${bounded}`, accessToken);
  return (await read(response, journalEntriesEnvelopeSchema)).entries;
}

// POST /v1/journal/entries: validated before anything leaves.
export async function createJournalEntry(
  accessToken: string,
  entry: CreateJournalEntry,
): Promise<JournalEntry> {
  const body = createJournalEntrySchema.parse(entry);
  const response = await send('/v1/journal/entries', accessToken, { method: 'POST', body });
  return read(response, journalEntrySchema);
}

// DELETE /v1/journal/entries/{id}: 204 on success.
export async function deleteJournalEntry(accessToken: string, id: string): Promise<void> {
  await send(`/v1/journal/entries/${encodeURIComponent(id)}`, accessToken, { method: 'DELETE' });
}
