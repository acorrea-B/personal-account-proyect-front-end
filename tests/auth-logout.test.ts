import { describe, expect, it, vi } from 'vitest';

import { ProblemError, revoke } from '../lib/api/client';

describe('auth logout', () => {
  it('sends bearer auth and resolves on 204', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await revoke('access-token');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/v1/auth/revoke'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
      }),
    );

    vi.unstubAllGlobals();
  });

  it('maps an invalid/expired access token (401) to a ProblemError', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'Unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Invalid access token.',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    try {
      await revoke('access-token');
      throw new Error('Expected revoke to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ProblemError);
      const problem = (error as { problem: { status: number } }).problem;
      expect(problem.status).toBe(401);
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
      await revoke('access-token');
      throw new Error('Expected revoke to throw');
    } catch (error) {
      const problem = (error as { problem: { status: number; retry_after_seconds?: number } })
        .problem;
      expect(problem.status).toBe(429);
      expect(problem.retry_after_seconds).toBe(60);
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
      await revoke('access-token');
      throw new Error('Expected revoke to throw');
    } catch (error) {
      const problem = (error as { problem: { status: number; type?: string } }).problem;
      expect(problem.status).toBe(503);
      expect(problem.type).toBe('dependency-unavailable');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('aborts after 15 seconds and exposes an AbortError', async () => {
    const fetchMock = vi.fn().mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();

    const promise = revoke('access-token');
    vi.advanceTimersByTime(15_000);

    await expect(promise).rejects.toBeInstanceOf(DOMException);

    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('sends a JSON body object on revoke', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await revoke('access-token');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ body: '{}' }),
    );

    vi.unstubAllGlobals();
  });
});
