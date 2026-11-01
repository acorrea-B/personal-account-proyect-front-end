import type { z } from 'zod';

import { ProblemError, type Problem } from './client';
import {
  canonicalProfileSchema,
  cvSuggestionSchema,
  harnessRevisionsEnvelopeSchema,
  levelAssessmentSchema,
  profileMetricsSchema,
  targetRoleSchema,
  type CanonicalProfile,
  type CvSuggestion,
  type HarnessRevision,
  type LevelAssessment,
  type ProfileMetricsOutput,
  type TargetRole,
} from '../schemas/harness';

// The harness outputs, read from the caller's profile revisions (GET
// /v1/profile/revisions, Bearer, newest first). One request feeds every
// view: the latest output of each type and the metrics of the newest runs.

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
const requestTimeoutMs = 15_000;

// The most runs the metrics trend shows.
export const metricsWindow = 6;

export type MetricsPoint = { at: string; metrics: ProfileMetricsOutput };

export type HarnessOutputs = {
  // When the newest run published; null before the first run.
  runAt: string | null;
  // The newest runs' metrics, oldest first (the order a trend reads).
  metrics: MetricsPoint[];
  cvSuggestions: CvSuggestion[] | null;
  level: LevelAssessment | null;
  roles: TargetRole[];
  // How the harness organized the profile; absent from callers that do not
  // read it.
  profile?: CanonicalProfile | null;
};

// The content of the newest revision of `outputType` that parses, or null.
function latest<T extends z.ZodType>(
  revisions: HarnessRevision[],
  outputType: string,
  schema: T,
): z.infer<T> | null {
  for (const revision of revisions) {
    if (revision.change_summary?.output_type !== outputType) {
      continue;
    }
    const parsed = schema.safeParse(revision.change_summary.content);
    if (parsed.success) {
      return parsed.data;
    }
  }
  return null;
}

export function harnessOutputs(revisions: HarnessRevision[]): HarnessOutputs {
  const metrics = revisions
    .flatMap((revision) => {
      if (revision.change_summary?.output_type !== 'profile_metrics') {
        return [];
      }
      const parsed = profileMetricsSchema.safeParse(revision.change_summary.content);
      return parsed.success ? [{ at: revision.created_at, metrics: parsed.data }] : [];
    })
    .slice(0, metricsWindow)
    .reverse();
  return {
    runAt: revisions.find((revision) => revision.change_summary)?.created_at ?? null,
    metrics,
    cvSuggestions: latest(revisions, 'cv_suggestions', cvSuggestionSchema.array()),
    level: latest(revisions, 'level_assessment', levelAssessmentSchema),
    roles: latest(revisions, 'target_roles', targetRoleSchema.array()) ?? [],
    profile: latest(revisions, 'canonical_profile', canonicalProfileSchema),
  };
}

export async function fetchHarnessOutputs(accessToken: string): Promise<HarnessOutputs> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(`${apiBaseUrl}/v1/profile/revisions`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as Partial<Problem>;
      throw new ProblemError({
        type: body.type,
        title: body.title,
        status: body.status ?? response.status,
        detail: body.detail,
        retry_after_seconds: body.retry_after_seconds,
      });
    }
    const envelope = harnessRevisionsEnvelopeSchema.parse(await response.json());
    return harnessOutputs(envelope.revisions);
  } finally {
    clearTimeout(timeoutId);
  }
}
