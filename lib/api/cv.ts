import { z } from 'zod';

import { ProblemError, type Problem } from './client';
import {
  cvSaveRequestSchema,
  cvSaveResponseSchema,
  cvEnvelopeSchema,
  cvVersionsEnvelopeSchema,
  cvVersionEnvelopeSchema,
  type Cv,
  type CvSaveResponse,
  type VersionSummary,
  type VersionDetail,
} from '../schemas/cv';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
const requestTimeoutMs = 15_000;

async function fetchCvResource(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function readProblem(response: Response): Promise<ProblemError> {
  const body = (await response.json().catch(() => ({}))) as Partial<Problem>;
  return new ProblemError({
    type: body.type,
    title: body.title,
    status: body.status ?? response.status,
    detail: body.detail,
    instance: body.instance,
    fields: body.fields,
    max_bytes: body.max_bytes,
    current_updated_at: body.current_updated_at,
  });
}

// GET /v1/cv/text (US4): the current cv text behind a Bearer token. A 404 is
// the contract's "no cv yet" answer for a first-time user - the workspace
// turns it into the empty state; everything else is a ProblemError too and
// the client stays dumb about the intent.
export async function fetchCvText(accessToken: string): Promise<Cv> {
  const response = await fetchCvResource(`${apiBaseUrl}/v1/cv/text`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw await readProblem(response);
  }

  const data: unknown = await response.json();
  return cvEnvelopeSchema.parse(data as z.infer<typeof cvEnvelopeSchema>).cv;
}

// POST /v1/cv/text (FR-015/016/017): transactional all-or-nothing save. The
// If-Unmodified-Since header is optional by contract (the first save does not
// require it); a 412 stale-version carries current_updated_at to re-resolve,
// a 413 cv-too-large carries max_bytes. The byte limit is enforced by the
// save schema before any request leaves the machine.
export async function saveCvText(
  accessToken: string,
  content: string,
  updatedAt?: string,
): Promise<CvSaveResponse> {
  const payload = cvSaveRequestSchema.parse({ content });
  const response = await fetchCvResource(`${apiBaseUrl}/v1/cv/text`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(updatedAt ? { 'If-Unmodified-Since': updatedAt } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await readProblem(response);
  }

  const data: unknown = await response.json();
  return cvSaveResponseSchema.parse(data as z.infer<typeof cvSaveResponseSchema>);
}

// The cv read failure voice for the dashboard's cv card, mirroring the
// profile read rule: a read failure never destroys the session; 429 gets its
// own rate-limit line because the endpoint is capped at 10 writes per user
// per minute on the save path.
export function cvLoadMessage(status?: number, fallback?: string): string {
  if (status === 429) {
    return 'The cv endpoint is rate limited (at most twice a minute). Wait a few seconds and try again.';
  }
  if (status === 401) {
    return 'The service did not accept the credential for now. Your session is kept; try again shortly.';
  }
  if (fallback) {
    // The api writes its details lowercase; the card speaks capitalized.
    return `${fallback.charAt(0).toUpperCase()}${fallback.slice(1)} — try again shortly.`;
  }
  return 'The cv failed to load. Please try again shortly.';
}

// GET /v1/cv/versions (FR-018): the archived cv versions, at most 10,
// newest first; an empty list answers a first-time saver.
export async function getVersions(accessToken: string): Promise<VersionSummary[]> {
  const response = await fetchCvResource(`${apiBaseUrl}/v1/cv/versions`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw await readProblem(response);
  }

  const data: unknown = await response.json();
  return cvVersionsEnvelopeSchema.parse(data as z.infer<typeof cvVersionsEnvelopeSchema>).versions;
}

// GET /v1/cv/versions/{id} (FR-018): one archived version with its content.
// The api answers 404 for a missing id AND for an id owned by another user
// (anti BOLA) - the client stays dumb and the 404 keeps its "not found"
// meaning for both cases.
export async function getVersionDetail(accessToken: string, id: string): Promise<VersionDetail> {
  const response = await fetchCvResource(`${apiBaseUrl}/v1/cv/versions/${id}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw await readProblem(response);
  }

  const data: unknown = await response.json();
  return cvVersionEnvelopeSchema.parse(data as z.infer<typeof cvVersionEnvelopeSchema>).version;
}
