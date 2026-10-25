import { describe, expect, it, vi } from 'vitest';

import { loginRequestSchema, tokenPairSchema } from '../lib/schemas/auth';
import { login } from '../lib/api/client';

describe('auth login', () => {
  it('accepts a valid login request', () => {
    const result = loginRequestSchema.safeParse({
      email: 'juan@example.com',
      password: 'contraseña1',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        email: 'juan@example.com',
        password: 'contraseña1',
      });
    }
  });

  it('rejects an empty email or password', () => {
    expect(loginRequestSchema.safeParse({ email: '', password: 'x' }).success).toBe(false);
    expect(loginRequestSchema.safeParse({ email: 'juan@example.com', password: '' }).success).toBe(
      false,
    );
  });

  it('POSTs to /v1/auth/login and returns the token pair on 200', async () => {
    const tokenPair = {
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_in: 3600,
      user: {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'juan@example.com',
        verified: true,
        created_at: '2026-10-25T00:00:00.000Z',
      },
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(tokenPair), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await login({ email: 'juan@example.com', password: 'contraseña1' });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/v1/auth/login'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result).toEqual(tokenPair);

    vi.unstubAllGlobals();
  });

  it('maps invalid credentials (401) to a generic ProblemError', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'invalid-credentials',
          title: 'Unauthorized',
          status: 401,
          detail: 'Email or password is invalid.',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    try {
      await login({ email: 'juan@example.com', password: 'wrong' });
      throw new Error('Expected login to throw');
    } catch (error) {
      const problem = (error as { problem: { status: number; type?: string } }).problem;
      expect(problem.status).toBe(401);
      expect(problem.type).toBe('invalid-credentials');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('maps unverified account (403) to an email-not-verified ProblemError', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'email-not-verified',
          title: 'Forbidden',
          status: 403,
          detail: 'Verify your email first.',
          can_resend: true,
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    try {
      await login({ email: 'juan@example.com', password: 'contraseña1' });
      throw new Error('Expected login to throw');
    } catch (error) {
      const problem = (
        error as { problem: { status: number; type?: string; can_resend?: boolean } }
      ).problem;
      expect(problem.status).toBe(403);
      expect(problem.type).toBe('email-not-verified');
      expect(problem.can_resend).toBe(true);
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
      await login({ email: 'juan@example.com', password: 'contraseña1' });
      throw new Error('Expected login to throw');
    } catch (error) {
      const problem = (error as { problem: { status: number; type?: string } }).problem;
      expect(problem.status).toBe(429);
      expect(problem.type).toBe('rate-limited');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('validates a token pair with an integer expires_in', () => {
    const result = tokenPairSchema.safeParse({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_in: 3600,
      user: {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'juan@example.com',
        verified: true,
        created_at: '2026-10-25T00:00:00.000Z',
      },
    });

    expect(result.success).toBe(true);
  });
});
