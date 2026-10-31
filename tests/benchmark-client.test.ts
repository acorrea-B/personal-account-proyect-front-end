import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProblemError } from '../lib/api/client';
import { fetchBenchmark, fetchLatestBenchmark, fetchLatestRevision } from '../lib/api/benchmark';

const REV = '11111111-1111-4111-8111-111111111111';
const revision = {
  id: REV,
  user_id: '22222222-2222-4222-8222-222222222222',
  profile_revision: REV,
  created_at: '2026-10-31T10:00:00Z',
  profile: { full_name: 'Juan' },
};
const benchmark = {
  id: '33333333-3333-4333-8333-333333333333',
  user_id: revision.user_id,
  revision: REV,
  revision_at: '2026-10-31T10:00:00Z',
  journal_entries_count: 6,
  journal_confirmed_count: 4,
  claim_supported_rate: 0.75,
  over_claimed_rate: 0.1,
  completeness_score: 0.8,
  evolution_mode: 'can_evolve',
  created_at: '2026-10-31T10:05:00Z',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('benchmark client', () => {
  it('takes the newest revision and null before the first', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ revisions: [revision] })));
    await expect(fetchLatestRevision('token')).resolves.toMatchObject({ id: REV });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ revisions: [] })));
    await expect(fetchLatestRevision('token')).resolves.toBeNull();
  });

  it('reads the benchmark of a revision by query with the Bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(benchmark));
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchBenchmark('token', REV);
    expect(result?.completeness_score).toBe(0.8);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(url, 'http://localhost').searchParams.get('revision')).toBe(REV);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token');
  });

  it('reads the contract 404 as no benchmark yet and keeps other failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ status: 404 }, 404)));
    await expect(fetchBenchmark('token', REV)).resolves.toBeNull();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ status: 503 }, 503)));
    await expect(fetchBenchmark('token', REV)).rejects.toBeInstanceOf(ProblemError);
  });

  it('fails closed on a rate outside 0..1', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json({ ...benchmark, over_claimed_rate: 1.5 })),
    );
    await expect(fetchBenchmark('token', REV)).rejects.toThrow();
  });

  it('chains the newest revision to its benchmark', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json({ revisions: [revision] }))
        .mockResolvedValueOnce(json(benchmark)),
    );
    const latest = await fetchLatestBenchmark('token');
    expect(latest?.revision.id).toBe(REV);
    expect(latest?.benchmark?.journal_confirmed_count).toBe(4);
  });
});
