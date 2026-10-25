import { z } from 'zod';

/**
 * Client-side validation for the registration payload.
 * Backend remains the authority for email normalization and password strength.
 */
export const registerRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const userSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  verified: z.boolean(),
  created_at: z.string(),
});

export const registerResponseSchema = z.object({
  user: userSchema,
});

export type User = z.infer<typeof userSchema>;
