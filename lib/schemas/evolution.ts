import { z } from 'zod';

// Contract mirror of the evolution shapes (OpenAPI 0.1.7, BC-005/BC-008)
// with the backend's own bounds: mode is can_evolve | must_evolve, the
// horizon 1..36 months, the rationale at most 1000 characters, and the
// loop verdict one of four values.

export const evolutionModes = ['can_evolve', 'must_evolve'] as const;
export const horizonMonthsMin = 1;
export const horizonMonthsMax = 36;
export const rationaleMax = 1000;

export const evolutionModeSchema = z.object({
  id: z.uuid(),
  mode: z.enum(evolutionModes),
  rationale: z.string().nullish(),
  target_role_id: z.string(),
  horizon_months: z.number().int(),
  success_criterion: z.string(),
  declared_at: z.string(),
});

export const declareEvolutionModeSchema = z.object({
  mode: z.enum(evolutionModes),
  target_role_id: z.string().trim().min(1, 'The target role is required').max(200),
  horizon_months: z.number().int().min(horizonMonthsMin).max(horizonMonthsMax),
  success_criterion: z.string().trim().min(1, 'The success criterion is required').max(2000),
  rationale: z.string().trim().max(rationaleMax).optional(),
});

export const loopVerdicts = [
  'on_track',
  'fixable_deviation',
  'structural',
  'unmeasurable',
] as const;

export const loopResultSchema = z.object({
  id: z.uuid(),
  verdict: z.enum(loopVerdicts),
  metric: z.string().nullish(),
  delta: z.number().nullish(),
  action_type: z.string(),
  target_ref: z.string(),
  rationale: z.string(),
  created_at: z.string(),
});

export const evolutionHistoryEnvelopeSchema = z.object({
  results: z.array(loopResultSchema),
});

export type EvolutionMode = z.infer<typeof evolutionModeSchema>;
export type DeclareEvolutionMode = z.input<typeof declareEvolutionModeSchema>;
export type LoopVerdict = (typeof loopVerdicts)[number];
export type LoopResult = z.infer<typeof loopResultSchema>;
