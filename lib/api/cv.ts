import { z } from 'zod';

import { ProblemError, type Problem } from './client';
import {
  cvSaveRequestSchema,
  cvSaveResponseSchema,
  cvEnvelopeSchema,
  type Cv,
  type CvSaveResponse,
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
