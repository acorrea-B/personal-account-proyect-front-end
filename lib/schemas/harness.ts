import { z } from 'zod';

// What the harness publishes as profile revisions (BC-002): each run writes
// one revision per output, `change_summary.output_type` names it and
// `content` carries it. Only the fields the workspace shows are kept; an
// output whose content does not parse is left out (fail-closed per output).

export const harnessRevisionSchema = z.object({
  id: z.uuid(),
  created_at: z.string(),
  change_summary: z
    .object({
      output_type: z.string(),
      trace_id: z.string().nullish(),
      content: z.unknown(),
    })
    .nullish(),
});

export const harnessRevisionsEnvelopeSchema = z.object({
  revisions: z.array(harnessRevisionSchema),
});

const fraction = z.number().min(0).max(1);
const count = z.number().int().min(0);

// profile-metrics/1.0.0: the run's numbers. The rates are null when the run
// had nothing to measure (not measurable is not zero).
export const profileMetricsSchema = z.object({
  schema: z.literal('profile-metrics/1.0.0'),
  completeness_score: fraction,
  claim_supported_rate: fraction.nullable(),
  over_claimed_rate: fraction.nullable(),
  suggestions: z.object({
    total: count,
    supported: count,
    partial: count,
    blocked: count,
    inferred: count,
  }),
  // Absent until the harness publishes skill suggestions with the metrics.
  skill_suggestions: count.nullish(),
  cv: z.object({
    ats_readiness: fraction,
    structure: fraction,
    clarity: fraction,
    impact_metric: fraction,
    keyword_coverage: fraction,
  }),
  level: z.object({ label: z.string(), weighted_score: fraction }),
  model: z.object({ calls: count, retries: count, total_tokens: count }),
});

// How verification left each CV suggestion: backed by the CV, partly
// backed, blocked (shown as what is missing, never as advice) or inferred.
export const verificationStatusSchema = z.enum(['AllSupported', 'Mixed', 'Blocked', 'AllInferred']);

export const cvSuggestionSchema = z.object({
  suggestion_id: z.string(),
  section: z.string(),
  suggested_text: z.string(),
  rationale: z.string(),
  verification_status: verificationStatusSchema,
});

export const levelAssessmentSchema = z.object({
  seniority_label: z.string(),
  weighted_score: fraction,
  dimension_scores: z.array(
    z.object({ dimension: z.string(), score: fraction, rationale: z.string() }),
  ),
});

export const targetRoleSchema = z.object({
  role_id: z.string(),
  display_name: z.string(),
  confidence_score: fraction,
  status: z.string(),
});

export type HarnessRevision = z.infer<typeof harnessRevisionSchema>;
export type ProfileMetricsOutput = z.infer<typeof profileMetricsSchema>;
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;
export type CvSuggestion = z.infer<typeof cvSuggestionSchema>;
export type LevelAssessment = z.infer<typeof levelAssessmentSchema>;
export type TargetRole = z.infer<typeof targetRoleSchema>;
