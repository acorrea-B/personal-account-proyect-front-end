import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProblemError } from '../lib/api/client';
import {
  declareEvolutionMode,
  fetchEvolutionHistory,
  fetchEvolutionMode,
} from '../lib/api/evolution';

const mode = {
  id: '11111111-1111-4111-8111-111111111111',
  user_id: '22222222-2222-4222-8222-222222222222',
  mode: 'can_evolve',
  rationale: 'I want to lead platform work.',
  target_role_id: 'Staff platform engineer',
  horizon_months: 12,
  success_criterion: 'Own the platform roadmap.',
  declared_at: '2026-10-31T10:00:00Z',
};

function respond(body: unknown, status = 200) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('evolution mode', () => {
  it('reads the active mode with the Bearer token', async () => {
    const fetchMock = respond(mode);
    const result = await fetchEvolutionMode('token');
    expect(result?.target_role_id).toBe('Staff platform engineer');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/v1\/evolution\/mode$/);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token');
  });

  it('reads the contract 404 as no mode declared', async () => {
    respond({ status: 404, title: 'Not Found' }, 404);
    await expect(fetchEvolutionMode('token')).resolves.toBeNull();
  });

  it('keeps other failures as ProblemErrors', async () => {
    respond({ status: 503 }, 503);
    await expect(fetchEvolutionMode('token')).rejects.toBeInstanceOf(ProblemError);
  });

  it('declares a mode with trimmed fields', async () => {
    const fetchMock = respond(mode, 201);
    await declareEvolutionMode('token', {
      mode: 'can_evolve',
      target_role_id: '  Staff platform engineer ',
      horizon_months: 12,
      success_criterion: ' Own the platform roadmap. ',
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      mode: 'can_evolve',
      target_role_id: 'Staff platform engineer',
      horizon_months: 12,
      success_criterion: 'Own the platform roadmap.',
    });
  });

  it('refuses the backend-invalid declarations before any request', async () => {
    const fetchMock = respond(mode, 201);
    const base = { mode: 'must_evolve' as const, target_role_id: 'Lead', success_criterion: 'x' };
    await expect(declareEvolutionMode('token', { ...base, horizon_months: 0 })).rejects.toThrow();
    await expect(declareEvolutionMode('token', { ...base, horizon_months: 37 })).rejects.toThrow();
    await expect(
      declareEvolutionMode('token', { ...base, horizon_months: 6, rationale: 'x'.repeat(1001) }),
    ).rejects.toThrow();
    await expect(
      declareEvolutionMode('token', { ...base, horizon_months: 6, target_role_id: '  ' }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('evolution history', () => {
  it('lists the loop results with a bounded limit', async () => {
    const fetchMock = respond({
      results: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          user_id: mode.user_id,
          verdict: 'fixable_deviation',
          metric: 'claim_supported_rate',
          delta: -0.1,
          action_type: 'add_evidence',
          target_ref: 'skill:rust',
          rationale: 'Two Rust claims lack evidence.',
          threshold_context: { min: 0.7 },
          created_at: '2026-10-31T10:00:00Z',
        },
      ],
    });
    const results = await fetchEvolutionHistory('token', 1000);
    expect(results[0]?.verdict).toBe('fixable_deviation');
    expect((fetchMock.mock.calls[0] as [string])[0]).toMatch(/history\?limit=200$/);
  });

  it('fails closed on an unknown verdict', async () => {
    respond({
      results: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          verdict: 'great',
          action_type: 'x',
          target_ref: 'y',
          rationale: 'z',
          created_at: '2026-10-31T10:00:00Z',
        },
      ],
    });
    await expect(fetchEvolutionHistory('token')).rejects.toThrow();
  });
});
