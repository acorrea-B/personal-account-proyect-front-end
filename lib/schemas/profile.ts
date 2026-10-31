import { z } from 'zod';

// Contract mirror of the api profile DTOs (OpenAPI 0.1.7, Profile). The
// optional text fields may arrive absent or null (the contract types them
// string | null); both read as absent, so the views keep string | undefined.
// The contract caps skills at 100 (0.1.7).

export const maxProfileSkills = 100;

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .nullish()
    .transform((value) => value ?? undefined)
    .optional();

export const profileLinkSchema = z.object({
  type: z.string().min(1).max(40),
  url: z.url().refine((url) => url.startsWith('http://') || url.startsWith('https://'), {
    message: 'Only http and https links are accepted',
  }),
});

export const profileSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  full_name: z.string().min(1).max(200),
  headline: optionalText(120),
  bio: optionalText(2000),
  location: optionalText(120),
  links: z.array(profileLinkSchema).max(10).optional(),
  skills: z.array(z.string().min(1).max(40)).max(maxProfileSkills).optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

// GET and PUT /v1/profile answer the ProfileEnvelope of the contract: the
// profile travels under `profile`, never bare. The api's extra fields
// (profile_revision, user_id, ...) are stripped by the object parse.
export const profileEnvelopeSchema = z.object({
  profile: profileSchema,
});

export const updateProfileRequestSchema = z.object({
  // The api trims full_name and validates 1..200 AFTER the trim.
  full_name: z
    .string()
    .trim()
    .min(1, 'Full name is required')
    .max(200, 'Full name must be at most 200 characters'),
  headline: z.string().max(120).optional(),
  bio: z.string().max(2000).optional(),
  location: z.string().max(120).optional(),
  links: z.array(profileLinkSchema).max(10).optional(),
  skills: z
    .array(z.string().min(1).max(40))
    .max(maxProfileSkills, `At most ${maxProfileSkills} skills are accepted`)
    .optional()
    .refine(
      (skills) =>
        !skills ||
        skills.every(
          (skill, index) =>
            skills.findIndex((other) => other.toLowerCase() === skill.toLowerCase()) === index,
        ),
      { message: 'Skills must not repeat' },
    ),
});

export type ProfileLink = z.infer<typeof profileLinkSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;
