import type { z } from 'zod';

import { ProblemError, type Problem } from './client';
import {
  catalogConsentDecisionRequestSchema,
  catalogConsentDecisionSchema,
  catalogConsentSchema,
  profileSkillsEnvelopeSchema,
  skillCatalogEnvelopeSchema,
  skillSuggestionDecisionRequestSchema,
  skillSuggestionDecisionSchema,
  skillSuggestionDecisionsEnvelopeSchema,
  skillSuggestionsEnvelopeSchema,
  suggestionsSummarySchema,
  type CatalogConsent,
  type CatalogConsentDecision,
  type ProfileSkill,
  type SkillCatalogEntry,
  type SkillDecision,
  type SkillSuggestionDecision,
  type SkillSuggestions,
  type SuggestionsSummary,
} from '../schemas/suggestions';

// The BC-012 client: the review signal, the skill suggestions with their
// decisions, the de-identified skill catalog and its contribution consent.
// Every call carries the user's Bearer token (the harness never decides),
// times out, and parses the answer fail-closed; a non-2xx answer is a
// ProblemError and the views own the copy.

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
const requestTimeoutMs = 15_000;

// The catalog autocomplete bounds: the prefix is matched against a skill
// key (at most 40 characters) and a short list is all a dropdown shows.
export const catalogPrefixMax = 40;
export const catalogLimitMax = 20;

async function readProblem(response: Response): Promise<ProblemError> {
  const body = (await response.json().catch(() => ({}))) as Partial<Problem>;
  return new ProblemError({
    type: body.type,
    title: body.title,
    status: body.status ?? response.status,
    detail: body.detail,
    instance: body.instance,
    fields: body.fields,
    retry_after_seconds: body.retry_after_seconds,
  });
}

async function request<T extends z.ZodType>(
  path: string,
  accessToken: string,
  schema: T,
  init: { method: 'GET' | 'POST'; body?: unknown } = { method: 'GET' },
): Promise<z.infer<T>> {
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
      throw await readProblem(response);
    }
    const data: unknown = await response.json();
    return schema.parse(data);
  } finally {
    clearTimeout(timeoutId);
  }
}

// GET /v1/profile/suggestions/summary
export function fetchSuggestionsSummary(accessToken: string): Promise<SuggestionsSummary> {
  return request('/v1/profile/suggestions/summary', accessToken, suggestionsSummarySchema);
}

// GET /v1/profile/skill-suggestions: the pending suggestions of the latest
// revision (an empty list and a null revision before the first one).
export function fetchSkillSuggestions(accessToken: string): Promise<SkillSuggestions> {
  return request('/v1/profile/skill-suggestions', accessToken, skillSuggestionsEnvelopeSchema);
}

// POST /v1/profile/skill-suggestions/{skill_key}/decision: accepting adds the
// skill (origin accepted) and rewrites profiles.skills in one transaction.
export async function decideSkillSuggestion(
  accessToken: string,
  skillKey: string,
  decision: SkillDecision,
  revisionId: string,
): Promise<SkillSuggestionDecision> {
  const body = skillSuggestionDecisionRequestSchema.parse({ decision, revision_id: revisionId });
  return request(
    `/v1/profile/skill-suggestions/${encodeURIComponent(skillKey)}/decision`,
    accessToken,
    skillSuggestionDecisionSchema,
    { method: 'POST', body },
  );
}

// GET /v1/profile/skill-suggestions/decisions: the latest decision per key.
export async function fetchSkillSuggestionDecisions(
  accessToken: string,
): Promise<SkillSuggestionDecision[]> {
  const envelope = await request(
    '/v1/profile/skill-suggestions/decisions',
    accessToken,
    skillSuggestionDecisionsEnvelopeSchema,
  );
  return envelope.decisions;
}

// GET /v1/skills/catalog?prefix=&limit=: names confirmed by consenting
// users. A blank prefix asks nothing (the contract requires one).
export async function searchSkillCatalog(
  accessToken: string,
  prefix: string,
  limit = 8,
): Promise<SkillCatalogEntry[]> {
  const trimmed = prefix.trim().slice(0, catalogPrefixMax);
  if (!trimmed) {
    return [];
  }
  const bounded = Math.min(Math.max(Math.trunc(limit), 1), catalogLimitMax);
  const query = new URLSearchParams({ prefix: trimmed, limit: String(bounded) });
  const envelope = await request(
    `/v1/skills/catalog?${query.toString()}`,
    accessToken,
    skillCatalogEnvelopeSchema,
  );
  return envelope.skills;
}

// GET /v1/consents/skill-catalog: the active version and the caller's choice.
export function fetchCatalogConsent(accessToken: string): Promise<CatalogConsent> {
  return request('/v1/consents/skill-catalog', accessToken, catalogConsentSchema);
}

// POST /v1/consents/skill-catalog/decision: append-only; the version must be
// the active one, so the caller passes the version it showed the user.
export async function decideCatalogConsent(
  accessToken: string,
  consentVersion: string,
  granted: boolean,
): Promise<CatalogConsentDecision> {
  const body = catalogConsentDecisionRequestSchema.parse({
    consent_version: consentVersion,
    granted,
  });
  return request('/v1/consents/skill-catalog/decision', accessToken, catalogConsentDecisionSchema, {
    method: 'POST',
    body,
  });
}

// GET /v1/profile/skills: the skill rows with their origin (declared or
// accepted from a suggestion).
export async function fetchProfileSkills(accessToken: string): Promise<ProfileSkill[]> {
  const envelope = await request('/v1/profile/skills', accessToken, profileSkillsEnvelopeSchema);
  return envelope.skills;
}
