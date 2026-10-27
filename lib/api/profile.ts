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

// The two write flows share PUT /v1/profile (a complete PUT with the
// optimistic header) but not their background rules, so each carries its
// own validation voice:
//
// - onboarding replaces the seeded placeholder: only a real name is
//   demanded, every optional field is allowed to stay empty.
// - update keeps a live profile: the name can neither be emptied nor be
//   the placeholder — a 200 that reinstalls 'User' would silently
//   re-qualify the profile as incomplete and re-gate the workspace.
export type ProfileFlow = 'onboarding' | 'update';

// Derives the flow from the profile the api returned at page load.
export function profileWriteFlow(profile: Profile): ProfileFlow {
  return isProfileIncomplete(profile) ? 'onboarding' : 'update';
}

// The full-name rule of each flow, shared by the submit validation and the
// real-time marking of the field.
export function fullNameProblem(value: string, flow: ProfileFlow): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return flow === 'onboarding'
      ? 'Full name is required'
      : 'The profile cannot lose its name; write it again before saving';
  }
  if (flow === 'update' && trimmed.toLowerCase() === 'user') {
    return '"User" is the placeholder; write your real name instead';
  }
  return null;
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

// The pasted urls from github/linkedin/x carry deep paths and query cruft
// (a compare view, a blob, a status, tracking params): the profile wants
// the BASE. Known hosts truncate at their natural profile depth; anything
// else only loses query/hash/trailing slash.
export function normalizeProfileLinkUrl(raw: string): string {
  let candidate = raw.trim();
  if (!candidate) {
    return '';
  }
  // A paste with another scheme (ftp:, mailto:) returns untouched: the
  // schema rejects it later with its http(s) message.
  if (/^[a-z][a-z0-9+.\-]*:\/\//i.test(candidate) && !/^https?:\/\//i.test(candidate)) {
    return candidate;
  }
  if (!/^https?:\/\//i.test(candidate)) {
    // Text without dots or with spaces is not a hostname (the operator
    // pasted "asdadadadadasdsa"): keep it raw so the schema rejects it with
    // its own message instead of minting an invented url. localhost:
    // port/path pastes are the documented local exception.
    const firstSegment = candidate.split('/')[0];
    if (!candidate.includes('.') || /\s/.test(candidate)) {
      if (!/^localhost(:\d+)?$/i.test(firstSegment)) {
        return candidate;
      }
    }
    candidate = `https://${candidate}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return candidate;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return candidate;
  }

  const authority = `${parsed.hostname.replace(/^www\./i, '').toLowerCase()}${
    parsed.port ? `:${parsed.port}` : ''
  }`;
  const segments = parsed.pathname.split('/').filter(Boolean);

  let keep = segments.length;
  if (authority === 'github.com') {
    // The social github link is the owner profile: one segment, always
    // (the operator ruled it - repos and compare views are content, not
    // identity).
    keep = Math.min(segments.length, 1);
  } else if (authority === 'linkedin.com') {
    keep = Math.min(segments.length, 2); // in|company/<slug>
  } else if (authority === 'x.com' || authority === 'twitter.com') {
    keep = Math.min(segments.length, 1); // handle
  }

  const keptPath = segments.slice(0, keep).join('/');
  return `${parsed.protocol}//${authority}${keptPath ? `/${keptPath}` : ''}`;
}

// The live evaluator of one link row (evaluated while it is typed, like the
// email field): neutral when the row is empty, otherwise it names exactly
// what is expected - including the shape of the address - before the save
// even happens.
export function linkRowProblem(row: { type: string; url: string }): string | null {
  const type = row.type.trim();
  const url = normalizeProfileLinkUrl(row.url.trim());
  if (!type && !url) {
    return null;
  }
  if (!url) {
    return 'Add the link address, like https://example.com';
  }
  if (!type) {
    return 'Add the site name, like github, linkedin or x';
  }
  if (!/^https?:\/\//i.test(url)) {
    return 'An https address is expected, like https://example.com';
  }
  return null;
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
