import { z } from 'zod';

// Contract mirror of the journal shapes (OpenAPI 0.1.7, BC-003/BC-004).
// The backend validates the text as 1..4000 characters and clamps the list
// limit to 1..200; the front checks the same bounds before sending.

export const journalTextMax = 4000;
export const journalListMax = 200;

export const journalConsentSchema = z.object({
  version: z.string().min(1),
  consent_text: z.string(),
  effective_from: z.string(),
  active: z.boolean(),
});

export const journalConsentConfirmationSchema = z.object({
  user_id: z.uuid(),
  consent_version: z.string().min(1),
  confirmed_at: z.string(),
});

export const journalEntrySchema = z.object({
  id: z.uuid(),
  occurred_at: z.string(),
  text: z.string(),
  user_confirmed_as_evidence: z.boolean(),
  linked_skill_ids: z.array(z.string()),
  consent_version: z.string().nullish(),
  created_at: z.string(),
});

export const journalEntriesEnvelopeSchema = z.object({
  entries: z.array(journalEntrySchema),
});

export const createJournalEntrySchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'The entry needs some text')
    .max(journalTextMax, `At most ${journalTextMax} characters`),
  occurred_at: z.iso.datetime({ offset: true }).optional(),
  user_confirmed_as_evidence: z.boolean(),
  linked_skill_ids: z.array(z.uuid()).max(100),
  consent_version: z.string().min(1),
});

export type JournalConsent = z.infer<typeof journalConsentSchema>;
export type JournalConsentConfirmation = z.infer<typeof journalConsentConfirmationSchema>;
export type JournalEntry = z.infer<typeof journalEntrySchema>;
export type CreateJournalEntry = z.input<typeof createJournalEntrySchema>;
