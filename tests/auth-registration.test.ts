import { describe, expect, it, vi } from 'vitest';
import { registerRequestSchema } from '../lib/schemas/auth';
import { ProblemError, register } from '../lib/api/client';

describe('auth registration', () => {
  it('accepts a valid registration request with email and password', () => {
    const result = registerRequestSchema.safeParse({
      email: 'juan@example.com',
      password: 'contraseña1',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ email: 'juan@example.com', password: 'contraseña1' });
    }
  });

  it('rejects registration when email is empty or blank', () => {
    expect(registerRequestSchema.safeParse({ email: '', password: 'contraseña1' }).success).toBe(
      false,
    );
    expect(registerRequestSchema.safeParse({ email: '   ', password: 'contraseña1' }).success).toBe(
      false,
    );
  });

  it('rejects registration when password is empty', () => {
    expect(
      registerRequestSchema.safeParse({ email: 'juan@example.com', password: '' }).success,
    ).toBe(false);
  });

  it('POSTs to /v1/auth/register and returns the created user on 201', async () => {
    const registeredUser = {
      id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
      email: 'juan@example.com',
      verified: false,
      created_at: '2026-10-21T12:00:00Z',
    };

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user: registeredUser }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const user = await register({ email: 'juan@example.com', password: 'contraseña1' });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/v1/auth/register'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(user).toEqual(registeredUser);

    vi.unstubAllGlobals();
  });

  it('maps an email-exists (409) Problem to a conflict error without leaking details', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'email-exists',
          title: 'Conflict',
          status: 409,
          detail: 'email exists',
        }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/problem+json' },
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    let thrown: unknown;
    try {
      await register({ email: 'juan@example.com', password: 'contraseña1' });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ProblemError);
    const problem = (thrown as ProblemError).problem;
    expect(problem.status).toBe(409);
    expect(problem.type).toBe('email-exists');

    vi.unstubAllGlobals();
  });

  it('maps a (422) Problem with fields to field-level validation errors', async () => {
    const fields = { email: 'email-malformed', password: 'weak-password' };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'email-malformed',
          title: 'Unprocessable Entity',
          status: 422,
          fields,
        }),
        {
          status: 422,
          headers: { 'Content-Type': 'application/problem+json' },
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    let thrown: unknown;
    try {
      await register({ email: 'juan@example.com', password: 'contraseña1' });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ProblemError);
    expect((thrown as ProblemError).problem.status).toBe(422);
    expect((thrown as ProblemError).problem.fields).toEqual(fields);

    vi.unstubAllGlobals();
  });
});
