import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchProfile,
  isProfileIncomplete,
  linkRowProblem,
  fullNameProblem,
  normalizeProfileLinkUrl,
  profileReadMessage,
  updateProfile,
} from '../lib/api/profile';
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

  it('accepts the null optional fields of the 0.1.7 contract as absent', () => {
    const result = profileSchema.safeParse({
      ...validProfile,
      headline: null,
      bio: null,
      location: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.headline).toBeUndefined();
      expect(result.data.bio).toBeUndefined();
      expect(result.data.location).toBeUndefined();
    }
  });

  it('accepts up to 100 skills and rejects 101 (0.1.7)', () => {
    const skills = (count: number) => Array.from({ length: count }, (_, index) => `skill-${index}`);
    expect(profileSchema.safeParse({ ...validProfile, skills: skills(100) }).success).toBe(true);
    expect(profileSchema.safeParse({ ...validProfile, skills: skills(101) }).success).toBe(false);
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

  it('accepts 100 skills and rejects 101 with the contract message (0.1.7)', () => {
    const skills = (count: number) => Array.from({ length: count }, (_, index) => `skill-${index}`);
    expect(
      updateProfileRequestSchema.safeParse({ full_name: 'Juan', skills: skills(100) }).success,
    ).toBe(true);
    const over = updateProfileRequestSchema.safeParse({ full_name: 'Juan', skills: skills(101) });
    expect(over.success).toBe(false);
    if (!over.success) {
      expect(over.error.issues[0]?.message).toBe('At most 100 skills are accepted');
    }
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
    // The api answers the ProfileEnvelope of the contract: { profile }.
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ profile }), {
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

  it('accepts the envelope fields the api added beside the profile (profile_revision, user_id)', async () => {
    const profile = {
      id: '11111111-1111-4111-8111-111111111111',
      profile_revision: '2026-10-31T01:33:39Z',
      user_id: '11111111-1111-4111-8111-111111111111',
      email: 'juan@example.com',
      full_name: 'Juan Pérez',
      created_at: '2026-10-27T00:00:00.000Z',
      updated_at: '2026-10-27T00:00:00.000Z',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ profile }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const result = await fetchProfile(accessToken);

    expect(result.full_name).toBe('Juan Pérez');
    expect(result.updated_at).toBe(profile.updated_at);
  });

  it('fails closed on a bare profile outside the envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: '11111111-1111-4111-8111-111111111111',
            email: 'juan@example.com',
            full_name: 'Juan Pérez',
            created_at: '2026-10-27T00:00:00.000Z',
            updated_at: '2026-10-27T00:00:00.000Z',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    await expect(fetchProfile(accessToken)).rejects.toThrow();
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

describe('profileReadMessage', () => {
  it('gives retryable copy for 429 and 503', () => {
    expect(profileReadMessage(429)).toContain('Too many requests');
    expect(profileReadMessage(503)).toContain('warming up');
  });

  it('keeps the api detail for client errors under the Alert convention', () => {
    expect(profileReadMessage(422, 'The email address is not well formed.')).toBe(
      'Alert: The email address is not well formed.',
    );
  });

  it('falls back to a plain retryable message without detail', () => {
    expect(profileReadMessage(400)).toBe('The profile could not be loaded. Please try again.');
  });
});

describe('linkRowProblem', () => {
  it('stays neutral for an unused row', () => {
    expect(linkRowProblem({ type: '', url: '' })).toBeNull();
  });

  it('names the missing half of a partial row', () => {
    expect(linkRowProblem({ type: 'github', url: '' })).toBe(
      'Add the link address, like https://example.com',
    );
    expect(linkRowProblem({ type: '', url: 'https://github.com/you' })).toBe(
      'Add the site name, like github, linkedin or x',
    );
  });

  it('marks garbage text and foreign schemes with the expected address shape', () => {
    expect(linkRowProblem({ type: 'github', url: 'asdadadadadasdsa' })).toBe(
      'An https address is expected, like https://example.com',
    );
    expect(linkRowProblem({ type: 'github', url: 'ftp://example.com' })).toBe(
      'An https address is expected, like https://example.com',
    );
  });

  it('accepts a base url, even deep-paste trimmed', () => {
    expect(
      linkRowProblem({
        type: 'github',
        url: 'https://github.com/example-org/example-repo/compare/main?expand=1',
      }),
    ).toBeNull();
  });
});

describe('isProfileIncomplete', () => {
  function profile(fullName: string) {
    return {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'juan@example.com',
      full_name: fullName,
      created_at: '2026-10-27T00:00:00.000Z',
      updated_at: '2026-10-27T00:00:00.000Z',
    };
  }

  it('treats the seeded placeholder as incomplete (always User on register)', () => {
    expect(isProfileIncomplete(profile('User'))).toBe(true);
    expect(isProfileIncomplete(profile('user'))).toBe(true);
    expect(isProfileIncomplete(profile('  User  '))).toBe(true);
  });

  it('treats a real name as complete', () => {
    expect(isProfileIncomplete(profile('Juan Pérez'))).toBe(false);
  });
});

describe('updateProfile', () => {
  const profile = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'juan@example.com',
    full_name: 'User',
    created_at: '2026-10-27T00:00:00.000Z',
    updated_at: '2026-10-27T00:00:00.000Z',
  };

  it('PUTs the full update with If-Unmodified-Since and returns the fresh profile', async () => {
    const updated = {
      ...profile,
      full_name: 'Juan Pérez',
      updated_at: '2026-10-27T12:19:19Z',
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ profile: updated }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await updateProfile(
      'access-token',
      { full_name: 'Juan Pérez', skills: ['rust'] },
      profile.updated_at,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/v1/profile',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
          'If-Unmodified-Since': profile.updated_at,
        }),
      }),
    );
    expect(result).toEqual(updated);
  });

  it('surfaces the 412 conflict with the current_updated_at of the problem', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'https://api.example.com/errors/stale-version',
          title: 'Precondition Failed',
          status: 412,
          detail: 'The resource changed since your last read; nothing was overwritten.',
          instance: '/v1/profile',
          current_updated_at: '2026-10-27T12:19:19Z',
        }),
        { status: 412, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      updateProfile('access-token', { full_name: 'Juan' }, profile.updated_at),
    ).rejects.toMatchObject({
      name: 'ProblemError',
      problem: { status: 412, current_updated_at: '2026-10-27T12:19:19Z' },
    });
  });
});

describe('normalizeProfileLinkUrl', () => {
  it('trims a deep github paste to the owner profile, without query or fragment', () => {
    expect(
      normalizeProfileLinkUrl(
        'https://github.com/example-org/example-repo/compare/feat/workspace-profile?expand=1',
      ),
    ).toBe('https://github.com/example-org');
    expect(normalizeProfileLinkUrl('https://github.com/example-org/example-repo')).toBe(
      'https://github.com/example-org',
    );
  });

  it('prepends https and keeps the profile path of the owner', () => {
    expect(normalizeProfileLinkUrl('github.com/example-org')).toBe(
      'https://github.com/example-org',
    );
    expect(normalizeProfileLinkUrl('https://github.com/example-org?tab=repositories')).toBe(
      'https://github.com/example-org',
    );
  });

  it('trims linkedin to the identity slug and x to the handle', () => {
    expect(
      normalizeProfileLinkUrl('https://www.linkedin.com/in/juan-perez/?originalSubdomain=es'),
    ).toBe('https://linkedin.com/in/juan-perez');
    expect(normalizeProfileLinkUrl('https://x.com/juan/status/1234567890?s=20')).toBe(
      'https://x.com/juan',
    );
  });

  it('only strips query, hash and trailing slash on other hosts', () => {
    expect(
      normalizeProfileLinkUrl('https://blog.juan.dev/posts/2026/why-rust/?utm_source=x#top'),
    ).toBe('https://blog.juan.dev/posts/2026/why-rust');
  });

  it('leaves untouched the paste it cannot repair', () => {
    expect(normalizeProfileLinkUrl('ftp://example.com')).toBe('ftp://example.com');
    expect(normalizeProfileLinkUrl('   ')).toBe('');
  });

  it('never mints a url from garbage text', () => {
    // The operator pasted "asdadadadadasdsa": without dots it is not a
    // hostname, so it stays raw and the schema rejects it at save time.
    expect(normalizeProfileLinkUrl('asdadadadadasdsa')).toBe('asdadadadadasdsa');
    expect(normalizeProfileLinkUrl('asdas dasda.com')).toBe('asdas dasda.com');
  });

  it('still trusts dotted and localhost pastes', () => {
    expect(normalizeProfileLinkUrl('localhost:8080/profile')).toBe(
      'https://localhost:8080/profile',
    );
  });
});

describe('configured api base url', () => {
  it('prefixes the configured base url (mocked fetch, fake domain)', async () => {
    // The deploy validate job exports NEXT_PUBLIC_API_BASE_URL; the client
    // builds the absolute URL from it. Cover that branch hermetically: a fake
    // domain with fetch mocked, never a real endpoint.
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.example.test');
    const { fetchProfile: fetchProfileWithBase } = await import('../lib/api/profile');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          profile: {
            id: '11111111-1111-4111-8111-111111111111',
            email: 'juan@example.com',
            full_name: 'Juan Pérez',
            created_at: '2026-10-27T00:00:00.000Z',
            updated_at: '2026-10-27T00:00:00.000Z',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await fetchProfileWithBase('access-token');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/v1/profile',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
});

// The editor rules in the tree's language: the view passes the dictionary
// strings and the rules speak the tree voice; the omitted case keeps the
// english defaults the older tests on this file already cover.
describe('the editor rules overridable by the dictionary', () => {
  const NAME_ES = {
    nameRequired: 'El nombre completo es obligatorio',
    nameRequiredUpdate: 'El perfil no puede perder su nombre; escríbelo otra vez antes de guardar',
    namePlaceholderConflict: '"User" es el provisional; escribe tu nombre real',
  };
  const LINK_ES = {
    linkNeedsUrl: 'Falta la dirección del enlace, como https://example.com',
    linkNeedsType: 'Falta el nombre del sitio, como github, linkedin o x',
    linkNeedsScheme: 'Se espera una dirección https, como https://example.com',
  };

  it('speaks the es name rule of each flow', () => {
    expect(fullNameProblem('', 'onboarding', NAME_ES)).toBe(NAME_ES.nameRequired);
    expect(fullNameProblem('', 'update', NAME_ES)).toBe(NAME_ES.nameRequiredUpdate);
    expect(fullNameProblem('User', 'update', NAME_ES)).toBe(NAME_ES.namePlaceholderConflict);
    expect(fullNameProblem('Juan Pérez', 'update', NAME_ES)).toBeNull();
  });

  it('speaks the es link-row rules', () => {
    expect(linkRowProblem({ type: 'github', url: '' }, LINK_ES)).toBe(LINK_ES.linkNeedsUrl);
    expect(linkRowProblem({ type: '', url: 'https://example.com' }, LINK_ES)).toBe(
      LINK_ES.linkNeedsType,
    );
    expect(linkRowProblem({ type: 'github', url: 'ftp://example.com' }, LINK_ES)).toBe(
      LINK_ES.linkNeedsScheme,
    );
    expect(linkRowProblem({ type: '', url: '' }, LINK_ES)).toBeNull();
  });
});
