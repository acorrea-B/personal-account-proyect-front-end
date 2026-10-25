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
