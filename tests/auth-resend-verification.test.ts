import { describe, expect, it, vi } from 'vitest';

import { resendVerificationRequestSchema } from '../lib/schemas/auth';
import { resendVerification } from '../lib/api/client';

describe('auth resend verification', () => {
  it('accepts a valid resend verification request email', () => {
    const result = resendVerificationRequestSchema.safeParse({
      email: 'juan@example.com',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ email: 'juan@example.com' });
    }
  });

  it('rejects a resend request when email is empty or blank', () => {
    expect(resendVerificationRequestSchema.safeParse({ email: '' }).success).toBe(false);
    expect(resendVerificationRequestSchema.safeParse({ email: '   ' }).success).toBe(false);
  });

  it('POSTs to /v1/auth/resend-verification and returns the generic message on 200', async () => {
    const genericMessage = 'Si el email corresponde a una cuenta pendiente, se envió un enlace.';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: genericMessage }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await resendVerification({ email: 'juan@example.com' });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/v1/auth/resend-verification'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result).toEqual({ message: genericMessage });

    vi.unstubAllGlobals();
  });

  it('maps an email-malformed (422) Problem to a field-level validation error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'email-malformed',
          title: 'Validation failed',
          status: 422,
          detail: 'Email format is invalid.',
          fields: { email: 'Email format is invalid.' },
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    try {
      await resendVerification({ email: 'juan@example.com' });
      throw new Error('Expected resendVerification to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      const problem = (error as { problem: { status: number; fields?: Record<string, string> } })
        .problem;
      expect(problem.status).toBe(422);
      expect(problem.fields).toEqual({ email: 'Email format is invalid.' });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('maps a rate-limited (429) Problem to a rate-limit error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'rate-limited',
          title: 'Too many requests',
          status: 429,
          detail: 'Try again later.',
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    try {
      await resendVerification({ email: 'juan@example.com' });
      throw new Error('Expected resendVerification to throw');
    } catch (error) {
      const problem = (error as { problem: { status: number; type?: string } }).problem;
      expect(problem.status).toBe(429);
      expect(problem.type).toBe('rate-limited');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('maps a dependency-unavailable (503) Problem to a retryable dependency error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'dependency-unavailable',
          title: 'Service unavailable',
          status: 503,
          detail: 'Try again later.',
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    try {
      await resendVerification({ email: 'juan@example.com' });
      throw new Error('Expected resendVerification to throw');
    } catch (error) {
      const problem = (error as { problem: { status: number; type?: string } }).problem;
      expect(problem.status).toBe(503);
      expect(problem.type).toBe('dependency-unavailable');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
