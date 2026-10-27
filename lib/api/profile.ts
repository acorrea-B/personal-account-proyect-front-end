import { z } from 'zod';

import { ProblemError, type Problem } from './client';
import {
  profileSchema,
  updateProfileRequestSchema,
  type Profile,
  type UpdateProfileRequest,
} from '../schemas/profile';

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
  const body = (await response.json().catch(() => ({}))) as Partial<Problem>;
  return new ProblemError({
    type: body.type,
    title: body.title,
    status: body.status ?? response.status,
    detail: body.detail,
    instance: body.instance,
    fields: body.fields,
    can_resend: body.can_resend,
    retry_after_seconds: body.retry_after_seconds,
    current_updated_at: body.current_updated_at,
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

// The api seeds every profile with the placeholder 'User' (the 1:1 insert
// of T003): the workspace treats that state as "the setup was never done"
// and gates the user into the complete-your-profile flow.
export function isProfileIncomplete(profile: Profile): boolean {
  const fullName = profile.full_name.trim();
  return fullName.length === 0 || fullName.toLowerCase() === 'user';
}

// PUT /v1/profile (FR-014): the update travels COMPLETE (omitted fields are
// emptied server-side) with the optimistic If-Unmodified-Since of the last
// read - a 412 problem carries current_updated_at for the conflict flow.
export async function updateProfile(
  accessToken: string,
  input: UpdateProfileRequest,
  ifUnmodifiedSince: string,
): Promise<Profile> {
  const payload = updateProfileRequestSchema.parse(input);

  const response = await fetchProfileResource(`${apiBaseUrl}/v1/profile`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'If-Unmodified-Since': ifUnmodifiedSince,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await readProblem(response);
  }

  const data: unknown = await response.json();
  return profileSchema.parse(data as z.infer<typeof profileSchema>);
}

// The workspace read message for a bearer problem. A 401 never reaches this
// helper: the page treats it as a session event (clear and go to login).
export function profileReadMessage(status: number, detail?: string): string {
  if (status === 429) {
    return 'Too many requests; please wait a moment and try again.';
  }
  if (status === 503) {
    return 'The service is warming up; try again shortly.';
  }
  if (status >= 500) {
    return 'The service could not be reached; please try again.';
  }
  if (detail?.trim()) {
    return `Alert: ${detail}`;
  }
  return 'The profile could not be loaded. Please try again.';
}
