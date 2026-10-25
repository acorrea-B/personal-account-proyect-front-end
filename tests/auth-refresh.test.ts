import { describe, expect, it, vi } from 'vitest';

import { refreshRequestSchema } from '../lib/schemas/auth';
import { refresh } from '../lib/api/client';

describe('auth refresh', () => {
  it('accepts a non-empty refresh token', () => {
    const result = refreshRequestSchema.safeParse({ refresh_token: 'refresh-token' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ refresh_token: 'refresh-token' });
    }
  });

  it('rejects an empty refresh token', () => {
    expect(refreshRequestSchema.safeParse({ refresh_token: '' }).success).toBe(false);
  });

  it('POSTs to /v1/auth/refresh and returns the token pair', async () => {
    const tokenPair = {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
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

    const result = await refresh({ refresh_token: 'refresh-token' });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/v1/auth/refresh'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result).toEqual(tokenPair);

    vi.unstubAllGlobals();
  });

  it('maps an invalid refresh token (401) to a ProblemError', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'invalid-refresh-token',
          title: 'Unauthorized',
          status: 401,
          detail: 'Invalid.',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    try {
      await refresh({ refresh_token: 'refresh-token' });
      throw new Error('Expected refresh to throw');
    } catch (error) {
      const problem = (error as { problem: { status: number; type?: string } }).problem;
      expect(problem.status).toBe(401);
      expect(problem.type).toBe('invalid-refresh-token');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('maps a reused refresh token (401) to a ProblemError', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'refresh-token-reused',
          title: 'Unauthorized',
          status: 401,
          detail: 'Session invalidated.',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    try {
      await refresh({ refresh_token: 'refresh-token' });
      throw new Error('Expected refresh to throw');
    } catch (error) {
      const problem = (error as { problem: { status: number; type?: string } }).problem;
      expect(problem.status).toBe(401);
      expect(problem.type).toBe('refresh-token-reused');
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
          retry_after_seconds: 60,
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    try {
      await refresh({ refresh_token: 'refresh-token' });
      throw new Error('Expected refresh to throw');
    } catch (error) {
      const problem = (
        error as { problem: { status: number; type?: string; retry_after_seconds?: number } }
      ).problem;
      expect(problem.status).toBe(429);
      expect(problem.retry_after_seconds).toBe(60);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
