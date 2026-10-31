import type { z } from 'zod';

import { ProblemError, type Problem } from './client';
import {
  declareEvolutionModeSchema,
  evolutionHistoryEnvelopeSchema,
  evolutionModeSchema,
  type DeclareEvolutionMode,
  type EvolutionMode,
  type LoopResult,
} from '../schemas/evolution';

// The evolution client (BC-005/BC-008): the user's declared evolution mode
// and the history of the evolution loop the harness records. Bearer only;
// answers parse fail-closed and a non-2xx answer is a ProblemError.

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
const requestTimeoutMs = 15_000;
export const historyLimitMax = 200;

async function send(
  path: string,
  accessToken: string,
  init: { method: 'GET' | 'POST'; body?: unknown } = { method: 'GET' },
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as Partial<Problem>;
      throw new ProblemError({
        type: body.type,
        title: body.title,
        status: body.status ?? response.status,
        detail: body.detail,
        fields: body.fields,
        retry_after_seconds: body.retry_after_seconds,
      });
    }
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function read<T extends z.ZodType>(response: Response, schema: T): Promise<z.infer<T>> {
  const data: unknown = await response.json();
  return schema.parse(data);
}

// GET /v1/evolution/mode: the active mode, or null when none was declared
// (the contract's 404).
export async function fetchEvolutionMode(accessToken: string): Promise<EvolutionMode | null> {
  try {
    return await read(await send('/v1/evolution/mode', accessToken), evolutionModeSchema);
  } catch (error) {
    if (error instanceof ProblemError && error.problem.status === 404) {
      return null;
    }
    throw error;
  }
}

// POST /v1/evolution/mode: a new declaration becomes the active mode.
export async function declareEvolutionMode(
  accessToken: string,
  declaration: DeclareEvolutionMode,
): Promise<EvolutionMode> {
  const body = declareEvolutionModeSchema.parse(declaration);
  const response = await send('/v1/evolution/mode', accessToken, { method: 'POST', body });
  return read(response, evolutionModeSchema);
}

// GET /v1/profile/evolution/history?limit=: the latest loop results.
export async function fetchEvolutionHistory(
  accessToken: string,
  limit = 20,
): Promise<LoopResult[]> {
  const bounded = Math.min(Math.max(Math.trunc(limit), 1), historyLimitMax);
  const response = await send(`/v1/profile/evolution/history?limit=${bounded}`, accessToken);
  return (await read(response, evolutionHistoryEnvelopeSchema)).results;
}
