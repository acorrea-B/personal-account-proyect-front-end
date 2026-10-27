import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  cvLoadMessage,
  fetchCvText,
  getVersionDetail,
  getVersions,
  saveCvText,
} from '../lib/api/cv';
import { cvSchema, maxCvContentBytes, cvSaveRequestSchema } from '../lib/schemas/cv';

const cv = {
  id: '22222222-2222-4222-8222-222222222222',
  content: 'Juan Perez\nBackend engineer\n\nEXPERIENCIA\n...',
  created_at: '2026-10-27T00:00:00.000Z',
  updated_at: '2026-10-27T00:00:00.000Z',
};

describe('cv schema', () => {
  it('parses the api CV envelope payload', () => {
    expect(cvSchema.safeParse(cv).success).toBe(true);
  });

  it('rejects a non-uuid id', () => {
    expect(cvSchema.safeParse({ ...cv, id: 'not-a-uuid' }).success).toBe(false);
  });

  it('accepts the content at the contract limit (51200 bytes)', () => {
    const exact = 'a'.repeat(maxCvContentBytes);
    expect(cvSaveRequestSchema.safeParse({ content: exact }).success).toBe(true);
  });

  it('rejects content over 51200 utf-8 bytes (multibyte counts by bytes)', () => {
    const wide = 'ñ'.repeat(25601); // 25601 chars x 2 bytes > 51200
    expect(cvSaveRequestSchema.safeParse({ content: wide }).success).toBe(false);
  });
});

describe('fetchCvText', () => {
  it('GETs /v1/cv/text with the bearer and returns the parsed cv', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ cv }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchCvText('access-token');

    expect(fetchMock).toHaveBeenCalledWith(
      '/v1/cv/text',
      expect.objectContaining({
        method: 'GET',
        headers: { Authorization: 'Bearer access-token' },
      }),
    );
    expect(result).toEqual(cv);
  });

  it('throws a ProblemError with status 404 when no cv exists yet (empty state)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            type: 'https://api.example.com/errors/cv-not-found',
            title: 'Not Found',
            status: 404,
          }),
          { status: 404, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    );

    await expect(fetchCvText('access-token')).rejects.toMatchObject({
      name: 'ProblemError',
      problem: { status: 404 },
    });
  });

  it('throws a ProblemError on 401 so the page can clear the session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ type: 't', title: 'Unauthorized', status: 401 }), {
          status: 401,
          headers: { 'Content-Type': 'application/problem+json' },
        }),
      ),
    );

    await expect(fetchCvText('access-token')).rejects.toMatchObject({
      name: 'ProblemError',
      problem: { status: 401 },
    });
  });

  it('throws a ProblemError on 429 rate limiting', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ type: 't', title: 'Too Many Requests', status: 429 }), {
          status: 429,
          headers: { 'Content-Type': 'application/problem+json' },
        }),
      ),
    );

    await expect(fetchCvText('access-token')).rejects.toMatchObject({
      name: 'ProblemError',
      problem: { status: 429 },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });
});

describe('saveCvText', () => {
  it('POSTs the content with If-Unmodified-Since and returns the save response', async () => {
    const updated = { ...cv, updated_at: '2026-10-27T12:00:00.000Z' };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          cv: { id: cv.id, updated_at: updated.updated_at },
          previous_version_archived: true,
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await saveCvText('access-token', cv.content, updated.updated_at);

    expect(fetchMock).toHaveBeenCalledWith(
      '/v1/cv/text',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
          'Content-Type': 'application/json',
          'If-Unmodified-Since': '2026-10-27T12:00:00.000Z',
        }),
        body: JSON.stringify({ content: cv.content }),
      }),
    );
    expect(result).toEqual({
      cv: { id: cv.id, updated_at: '2026-10-27T12:00:00.000Z' },
      previous_version_archived: true,
    });
  });

  it('omits If-Unmodified-Since on the first save', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          cv: { id: cv.id, updated_at: cv.updated_at },
          previous_version_archived: false,
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await saveCvText('access-token', cv.content);

    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((call[1].headers as Record<string, string>)['If-Unmodified-Since']).toBeUndefined();
  });

  it('surfaces the 412 stale-version problem with current_updated_at', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            type: 'https://api.example.com/errors/stale-version',
            title: 'Precondition Failed',
            status: 412,
            current_updated_at: '2026-10-27T12:30:00.000Z',
          }),
          { status: 412, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    );

    await expect(saveCvText('access-token', cv.content, cv.updated_at)).rejects.toMatchObject({
      name: 'ProblemError',
      problem: { status: 412, current_updated_at: '2026-10-27T12:30:00.000Z' },
    });
  });

  it('surfaces the 413 too-large problem with max_bytes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            type: 'https://api.example.com/errors/cv-too-large',
            title: 'Payload Too Large',
            status: 413,
            max_bytes: 51200,
          }),
          { status: 413, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    );

    await expect(saveCvText('access-token', 'a'.repeat(10), cv.updated_at)).rejects.toMatchObject({
      name: 'ProblemError',
      problem: { status: 413, max_bytes: 51200 },
    });
  });

  it('does not call fetch when the content breaks the byte limit', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(saveCvText('access-token', 'ñ'.repeat(25601))).rejects.toThrow(/51200/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});

describe('cvLoadMessage', () => {
  it('explains the rate limit on 429', () => {
    expect(cvLoadMessage(429)).toMatch(/twice a minute|too quickly/i);
  });

  it('keeps the session framing on 401 read failures', () => {
    expect(cvLoadMessage(401)).toMatch(/session is kept/i);
  });

  it('prefers the api detail for other problems', () => {
    expect(cvLoadMessage(500, 'the cv storage hiccuped')).toBe(
      'The cv storage hiccuped — try again shortly.',
    );
    expect(cvLoadMessage(500)).toMatch(/try again shortly/i);
  });
});

describe('cv versions client', () => {
  const summary = {
    id: '33333333-3333-3333-8333-333333333333',
    origin: 'user',
    archived_at: '2026-10-26T09:00:00.000Z',
  };

  it('GETs /v1/cv/versions and returns the summaries newest first', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ versions: [summary] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const versions = await getVersions('access-token');

    expect(fetchMock).toHaveBeenCalledWith(
      '/v1/cv/versions',
      expect.objectContaining({ method: 'GET', headers: { Authorization: 'Bearer access-token' } }),
    );
    expect(versions).toEqual([summary]);
  });

  it('returns an empty array for a first-time saver (empty envelope)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ versions: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    expect(await getVersions('access-token')).toEqual([]);
  });

  it('GETs one version detail through its id path segment', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ version: { ...summary, content: 'old cv text' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const version = await getVersionDetail('access-token', summary.id);

    expect(fetchMock).toHaveBeenCalledWith(
      `/v1/cv/versions/${summary.id}`,
      expect.objectContaining({ method: 'GET' }),
    );
    expect(version).toEqual({ ...summary, content: 'old cv text' });
  });

  it('surfaces the 404 that masks other users ids (anti BOLA)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            type: 'https://api.example.com/errors/not-found',
            title: 'Not Found',
            status: 404,
          }),
          { status: 404, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    );
    await expect(getVersionDetail('access-token', summary.id)).rejects.toMatchObject({
      name: 'ProblemError',
      problem: { status: 404 },
    });
  });

  it('throws a ProblemError without json body fallbacks on 401/429', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('{}', { status: 401, headers: { 'Content-Type': 'application/json' } }),
        ),
    );
    await expect(getVersions('access-token')).rejects.toMatchObject({
      name: 'ProblemError',
      problem: { status: 401 },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });
});
