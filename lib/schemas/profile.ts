import { z } from 'zod';

// Contract mirror of the api profile DTOs (personal-account-proyect
// src/domain/profile/dto.rs and handlers.rs ProfileResponse). The optional
// fields are ABSENT from the JSON when the api holds none of them (serde
// skip_serializing_if), so they are optional here, never null.

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
  headline: z.string().max(120).optional(),
  bio: z.string().max(2000).optional(),
  location: z.string().max(120).optional(),
  links: z.array(profileLinkSchema).max(10).optional(),
  skills: z.array(z.string().min(1).max(40)).max(30).optional(),
  created_at: z.string(),
  updated_at: z.string(),
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
    .max(30, 'At most 30 skills are accepted')
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
