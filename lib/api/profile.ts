import { z } from 'zod';

import { ProblemError } from './client';
import { profileSchema, type Profile } from '../schemas/profile';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
const requestTimeoutMs = 15_000;

async function fetchProfileResource(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function readProblem(response: Response): Promise<ProblemError> {
  const body = (await response.json().catch(() => ({}))) as Partial<{
    type: string;
    title: string;
    detail: string;
    instance: string;
    fields: Record<string, string>;
  }>;
  return new ProblemError({
    type: body.type,
    title: body.title,
    status: response.status,
    detail: body.detail,
    instance: body.instance,
    fields: body.fields,
  });
}

// GET /v1/profile (US3): the own profile's public shape behind a Bearer token.
export async function fetchProfile(accessToken: string): Promise<Profile> {
  const response = await fetchProfileResource(`${apiBaseUrl}/v1/profile`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw await readProblem(response);
  }

  const data: unknown = await response.json();
  return profileSchema.parse(data as z.infer<typeof profileSchema>);
}
