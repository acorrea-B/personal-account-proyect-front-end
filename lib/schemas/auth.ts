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

export const resendVerificationRequestSchema = z.object({
  email: z.email(),
});

export type ResendVerificationRequest = z.infer<typeof resendVerificationRequestSchema>;

export const resendVerificationResponseSchema = z.object({
  message: z.string(),
});

export type ResendVerificationResponse = z.infer<typeof resendVerificationResponseSchema>;

export const loginRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const tokenPairSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number().int().positive(),
  user: userSchema,
});

export type TokenPair = z.infer<typeof tokenPairSchema>;
