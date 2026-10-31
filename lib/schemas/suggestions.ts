import { z } from 'zod';

// Contract mirror of the BC-012 shapes (OpenAPI 0.1.7): the harness writes
// skill suggestions as revisions, the user decides each one, and the
// summary is the front's review signal. Responses are parsed fail-closed.

export const skillSuggestionSchema = z.object({
  skill_key: z.string().min(1),
  display_name: z.string().min(1),
  evidence: z.object({
    // The verbatim CV line the harness verified for the suggestion.
    quote: z.string(),
    cv_section: z.string(),
  }),
});

export const skillSuggestionsEnvelopeSchema = z.object({
  // null until the harness wrote a first revision for the caller.
  revision_id: z.uuid().nullable(),
  suggestions: z.array(skillSuggestionSchema),
});

export const skillDecisionSchema = z.enum(['accepted', 'rejected']);

export const skillSuggestionDecisionRequestSchema = z.object({
  decision: skillDecisionSchema,
  revision_id: z.uuid(),
});

export const skillSuggestionDecisionSchema = z.object({
  skill_key: z.string().min(1),
  decision: skillDecisionSchema,
  revision_id: z.uuid(),
  decided_at: z.string(),
});

export const skillSuggestionDecisionsEnvelopeSchema = z.object({
  decisions: z.array(skillSuggestionDecisionSchema),
});

const suggestionKindSummarySchema = z.object({
  pending: z.number().int().min(0),
  revision_id: z.uuid().nullable(),
  created_at: z.string().nullable(),
});

// skills.pending falls as the user decides; cv.pending does not fall until
// CV suggestion decisions exist (BC-013): a changed cv.revision_id is "new".
export const suggestionsSummarySchema = z.object({
  skills: suggestionKindSummarySchema,
  cv: suggestionKindSummarySchema,
});

export const skillCatalogEnvelopeSchema = z.object({
  skills: z.array(
    z.object({
      skill_key: z.string().min(1),
      display_name: z.string().min(1),
    }),
  ),
});

export const catalogConsentSchema = z.object({
  version: z.string().min(1),
  consent_text: z.string(),
  effective_from: z.string(),
  // The caller's latest decision on this version; null when never decided.
  granted: z.boolean().nullable(),
  decided_at: z.string().nullable(),
});

export const catalogConsentDecisionRequestSchema = z.object({
  consent_version: z.string().min(1),
  granted: z.boolean(),
});

export const catalogConsentDecisionSchema = z.object({
  consent_version: z.string().min(1),
  granted: z.boolean(),
  decided_at: z.string(),
});

// GET /v1/profile/skills rows (BC-006, origin since 0.1.7). Only the fields
// the views read are kept; extra fields are stripped by the object parse.
export const profileSkillSchema = z.object({
  id: z.uuid(),
  skill_key: z.string().min(1),
  display_name: z.string().min(1),
  category: z.string(),
  claim_status: z.string(),
  origin: z.enum(['declared', 'accepted']),
});

export const profileSkillsEnvelopeSchema = z.object({
  skills: z.array(profileSkillSchema),
});

export type SkillSuggestion = z.infer<typeof skillSuggestionSchema>;
export type SkillSuggestions = z.infer<typeof skillSuggestionsEnvelopeSchema>;
export type SkillDecision = z.infer<typeof skillDecisionSchema>;
export type SkillSuggestionDecision = z.infer<typeof skillSuggestionDecisionSchema>;
export type SuggestionsSummary = z.infer<typeof suggestionsSummarySchema>;
export type SkillCatalogEntry = z.infer<typeof skillCatalogEnvelopeSchema>['skills'][number];
export type CatalogConsent = z.infer<typeof catalogConsentSchema>;
export type CatalogConsentDecision = z.infer<typeof catalogConsentDecisionSchema>;
export type ProfileSkill = z.infer<typeof profileSkillSchema>;
