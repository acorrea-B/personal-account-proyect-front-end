import type { z } from 'zod';

import { ProblemError, type Problem } from './client';
import {
  benchmarkSchema,
  profileRevisionsEnvelopeSchema,
  type Benchmark,
  type ProfileRevision,
} from '../schemas/benchmark';

// The benchmark client: the profile revisions (BC-002, newest first) and
// the benchmark computed for a revision (BC-007). Bearer only; answers
// parse fail-closed and a non-2xx answer is a ProblemError.

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
const requestTimeoutMs = 15_000;

async function get<T extends z.ZodType>(
  path: string,
  accessToken: string,
  schema: T,
): Promise<z.infer<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as Partial<Problem>;
      throw new ProblemError({
        type: body.type,
        title: body.title,
        status: body.status ?? response.status,
        detail: body.detail,
        retry_after_seconds: body.retry_after_seconds,
      });
    }
    const data: unknown = await response.json();
    return schema.parse(data);
  } finally {
    clearTimeout(timeoutId);
  }
}

// GET /v1/profile/revisions: the newest revision, or null before the first.
export async function fetchLatestRevision(accessToken: string): Promise<ProfileRevision | null> {
  const envelope = await get('/v1/profile/revisions', accessToken, profileRevisionsEnvelopeSchema);
  return envelope.revisions[0] ?? null;
}

// GET /v1/profile/benchmark?revision=: the benchmark of one revision, or null
// when none was computed for it yet (the contract's 404).
export async function fetchBenchmark(
  accessToken: string,
  revisionId: string,
): Promise<Benchmark | null> {
  const query = new URLSearchParams({ revision: revisionId });
  try {
    return await get(`/v1/profile/benchmark?${query.toString()}`, accessToken, benchmarkSchema);
  } catch (error) {
    if (error instanceof ProblemError && error.problem.status === 404) {
      return null;
    }
    throw error;
  }
}

// The benchmark of the newest revision, with that revision; null when the
// user has no revision yet.
export async function fetchLatestBenchmark(
  accessToken: string,
): Promise<{ revision: ProfileRevision; benchmark: Benchmark | null } | null> {
  const revision = await fetchLatestRevision(accessToken);
  if (!revision) {
    return null;
  }
  return { revision, benchmark: await fetchBenchmark(accessToken, revision.id) };
}
