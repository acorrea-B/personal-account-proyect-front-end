import { z } from 'zod';

// Contract mirror of the api cv DTOs (specs/001-beta-profile-api/contracts
// — schemas Cv, CvEnvelope, CvSaveRequest, CvSaveResponse). The CV text
// travels verbatim: no trimming and no normalization is applied by either
// side, so the schemas enforce only envelope shape and the byte limit.

export const maxCvContentBytes = 51_200;

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export const cvSchema = z.object({
  id: z.uuid(),
  content: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const cvEnvelopeSchema = z.object({ cv: cvSchema });

// The api counts UTF-8 bytes (51200 exact is accepted, 51201 is not), so the
// limit is measured on the encoded length, not the string length. An empty
// content is contract-valid (saving empty clears the cv) - no min length is
// invented client-side.
export const cvSaveRequestSchema = z.object({
  content: z.string().refine((content) => utf8ByteLength(content) <= maxCvContentBytes, {
    message: `The CV text is at most ${maxCvContentBytes} bytes`,
  }),
});

export const cvMetaSchema = z.object({
  id: z.uuid(),
  updated_at: z.string(),
});

export const cvSaveResponseSchema = z.object({
  cv: cvMetaSchema,
  previous_version_archived: z.boolean(),
});

export type Cv = z.infer<typeof cvSchema>;
export type CvMeta = z.infer<typeof cvMetaSchema>;
export type CvSaveResponse = z.infer<typeof cvSaveResponseSchema>;

// Version history (FR-018, ADR 0013): at most 10 archived versions, newest
// first; origin is reserved by D15 and carries 'user' in beta.
export const versionSummarySchema = z.object({
  id: z.uuid(),
  origin: z.enum(['user']),
  archived_at: z.string(),
});

export const cvVersionsEnvelopeSchema = z.object({
  versions: z.array(versionSummarySchema).max(10),
});

export const versionDetailSchema = versionSummarySchema.extend({
  content: z.string(),
});

export type VersionSummary = z.infer<typeof versionSummarySchema>;
export type VersionDetail = z.infer<typeof versionDetailSchema>;

export const cvVersionEnvelopeSchema = z.object({ version: versionDetailSchema });
