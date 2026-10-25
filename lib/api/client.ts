import { z } from 'zod';

import {
  loginRequestSchema,
  registerRequestSchema,
  registerResponseSchema,
  tokenPairSchema,
  resendVerificationRequestSchema,
  resendVerificationResponseSchema,
  type User,
} from '../schemas/auth';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
const requestTimeoutMs = 15_000;

export interface Problem {
  type?: string;
  title?: string;
  status: number;
  detail?: string;
  instance?: string;
  fields?: Record<string, string>;
  can_resend?: boolean;
  retry_after_seconds?: number;
  current_updated_at?: string;
  max_bytes?: number;
}

export class ProblemError extends Error {
  readonly problem: Problem;

  constructor(problem: Problem) {
    super(problem.detail ?? problem.title ?? 'Request failed');
    this.name = 'ProblemError';
    this.problem = problem;
  }
}

async function readProblem(response: Response): Promise<ProblemError> {
  const body = (await response.json().catch(() => ({}))) as Partial<Problem>;
  return new ProblemError({
    type: body.type,
    title: body.title,
    status: body.status ?? response.status,
    detail: body.detail,
    instance: body.instance,
    fields: body.fields,
    can_resend: body.can_resend,
    retry_after_seconds: body.retry_after_seconds,
    current_updated_at: body.current_updated_at,
    max_bytes: body.max_bytes,
  });
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function register(input: z.infer<typeof registerRequestSchema>): Promise<User> {
  const payload = registerRequestSchema.parse(input);

  const response = await fetchWithTimeout(`${apiBaseUrl}/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await readProblem(response);
  }

  const data: unknown = await response.json();
  return registerResponseSchema.parse(data).user;
}

export async function login(
  input: z.infer<typeof loginRequestSchema>,
): Promise<z.infer<typeof tokenPairSchema>> {
  const payload = loginRequestSchema.parse(input);

  const response = await fetchWithTimeout(`${apiBaseUrl}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await readProblem(response);
  }

  const data: unknown = await response.json();
  return tokenPairSchema.parse(data);
}

export async function resendVerification(
  input: z.infer<typeof resendVerificationRequestSchema>,
): Promise<z.infer<typeof resendVerificationResponseSchema>> {
  const payload = resendVerificationRequestSchema.parse(input);

  const response = await fetchWithTimeout(`${apiBaseUrl}/v1/auth/resend-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await readProblem(response);
  }

  const data: unknown = await response.json();
  return resendVerificationResponseSchema.parse(data);
}
