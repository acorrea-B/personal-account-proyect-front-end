import { z } from 'zod';

// Contract mirror of the revision-level benchmark (OpenAPI 0.1.7, BC-007)
// and of the profile revisions it hangs from (BC-002). Only the fields the
// dashboard reads are kept; the rates and the score are fractions in 0..1.

export const profileRevisionSchema = z.object({
  id: z.uuid(),
  profile_revision: z.string(),
  created_at: z.string(),
});

export const profileRevisionsEnvelopeSchema = z.object({
  revisions: z.array(profileRevisionSchema),
});

const fraction = z.number().min(0).max(1).nullish();

export const benchmarkSchema = z.object({
  id: z.uuid(),
  revision: z.uuid().nullish(),
  revision_at: z.string(),
  journal_entries_count: z.number().int().min(0),
  journal_confirmed_count: z.number().int().min(0),
  claim_supported_rate: fraction,
  over_claimed_rate: fraction,
  completeness_score: fraction,
  evolution_mode: z.string().nullish(),
  created_at: z.string(),
});

export type ProfileRevision = z.infer<typeof profileRevisionSchema>;
export type Benchmark = z.infer<typeof benchmarkSchema>;
