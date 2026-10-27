import { describe, expect, it, vi } from 'vitest';

import { fetchProfile } from '../lib/api/profile';
import { profileSchema, updateProfileRequestSchema } from '../lib/schemas/profile';

describe('profile schema', () => {
  const validProfile = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'juan@example.com',
    full_name: 'Juan Pérez',
    created_at: '2026-10-27T00:00:00.000Z',
    updated_at: '2026-10-27T00:00:00.000Z',
  };

  it('accepts the api response with every optional field absent', () => {
    const result = profileSchema.safeParse(validProfile);
    expect(result.success).toBe(true);
  });

  it('accepts the api response with optional fields present', () => {
    const result = profileSchema.safeParse({
      ...validProfile,
      headline: 'Backend engineer',
      bio: 'Rust and TypeScript.',
      location: 'Bogotá',
      links: [{ type: 'github', url: 'https://github.com/juan' }],
      skills: ['rust', 'typescript'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed id or full_name', () => {
    expect(profileSchema.safeParse({ ...validProfile, id: 'no-uuid' }).success).toBe(false);
    expect(profileSchema.safeParse({ ...validProfile, full_name: '' }).success).toBe(false);
  });
});

describe('updateProfileRequestSchema', () => {
  it('accepts a complete update with links and skills', () => {
    const result = updateProfileRequestSchema.safeParse({
      full_name: '  Juan Pérez  ',
      headline: 'Backend engineer',
      bio: 'x'.repeat(2000),
      location: 'Bogotá',
      links: [{ type: 'github', url: 'https://github.com/juan' }],
      skills: ['Rust', 'TypeScript', 'Go'],
    });
    // full_name trims and the skills list is unique.
    expect(result.success).toBe(true);
  });

  it('rejects an over-long full_name, headline or bio', () => {
    expect(updateProfileRequestSchema.safeParse({ full_name: 'x'.repeat(201) }).success).toBe(
      false,
    );
    expect(
      updateProfileRequestSchema.safeParse({ full_name: 'Juan', headline: 'x'.repeat(121) })
        .success,
    ).toBe(false);
    expect(
      updateProfileRequestSchema.safeParse({ full_name: 'Juan', bio: 'x'.repeat(2001) }).success,
    ).toBe(false);
  });

  it('rejects more than 10 links, non-http links, and repeated skills', () => {
    const links = Array.from({ length: 11 }, (_, index) => ({
      type: `site-${index}`,
      url: 'https://example.com',
    }));
    expect(updateProfileRequestSchema.safeParse({ full_name: 'Juan', links }).success).toBe(false);
    expect(
      updateProfileRequestSchema.safeParse({
        full_name: 'Juan',
        links: [{ type: 'ftp', url: 'ftp://example.com' }],
      }).success,
    ).toBe(false);
    expect(
      updateProfileRequestSchema.safeParse({ full_name: 'Juan', skills: ['rust', 'Rust'] }).success,
    ).toBe(false);
  });
});

describe('fetchProfile', () => {
  const accessToken = 'access-token';

  it('GETs /v1/profile with the Bearer token and returns the parsed profile', async () => {
    const profile = {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'juan@example.com',
      full_name: 'Juan Pérez',
      created_at: '2026-10-27T00:00:00.000Z',
      updated_at: '2026-10-27T00:00:00.000Z',
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(profile), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchProfile(accessToken);

    expect(fetchMock).toHaveBeenCalledWith(
      '/v1/profile',
      expect.objectContaining({
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    );
    expect(result).toEqual(profile);
  });

  it('throws a ProblemError with the api problem on 401', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'https://api.example.com/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'The credential is invalid.',
          instance: '/v1/profile',
        }),
        { status: 401, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchProfile(accessToken)).rejects.toMatchObject({
      name: 'ProblemError',
      problem: { status: 401, detail: 'The credential is invalid.' },
    });
  });

  it('wraps a non-json failure as a ProblemError carrying the response status', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('boom', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchProfile(accessToken)).rejects.toMatchObject({
      name: 'ProblemError',
      problem: { status: 503 },
    });
  });
});
