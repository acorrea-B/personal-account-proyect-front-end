import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProblemError } from '../lib/api/client';
import {
  catalogLimitMax,
  decideCatalogConsent,
  decideSkillSuggestion,
  fetchCatalogConsent,
  fetchProfileSkills,
  fetchSkillSuggestionDecisions,
  fetchSkillSuggestions,
  fetchSuggestionsSummary,
  searchSkillCatalog,
} from '../lib/api/suggestions';

const REVISION = '22222222-2222-4222-8222-222222222222';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function call(fetchMock: ReturnType<typeof vi.fn>, index = 0) {
  const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit];
  return { url, init, headers: init.headers as Record<string, string> };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchSuggestionsSummary', () => {
  it('GETs the summary with the Bearer token and parses both kinds', async () => {
    const fetchMock = mockFetch(
      jsonResponse({
        skills: { pending: 3, revision_id: REVISION, created_at: '2026-10-31T10:00:00Z' },
        cv: { pending: 0, revision_id: null, created_at: null },
      }),
    );
    const summary = await fetchSuggestionsSummary('token');
    expect(summary.skills.pending).toBe(3);
    expect(summary.cv.revision_id).toBeNull();
    const { url, init, headers } = call(fetchMock);
    expect(url).toMatch(/\/v1\/profile\/suggestions\/summary$/);
    expect(init.method).toBe('GET');
    expect(headers.Authorization).toBe('Bearer token');
  });

  it('fails closed on a negative pending count', async () => {
    mockFetch(
      jsonResponse({
        skills: { pending: -1, revision_id: null, created_at: null },
        cv: { pending: 0, revision_id: null, created_at: null },
      }),
    );
    await expect(fetchSuggestionsSummary('token')).rejects.toThrow();
  });
});

describe('fetchSkillSuggestions', () => {
  it('parses the pending suggestions with their verified evidence', async () => {
    mockFetch(
      jsonResponse({
        revision_id: REVISION,
        suggestions: [
          {
            skill_key: 'rust',
            display_name: 'Rust',
            evidence: { quote: 'Built services in Rust', cv_section: 'experience' },
          },
        ],
      }),
    );
    const result = await fetchSkillSuggestions('token');
    expect(result.revision_id).toBe(REVISION);
    expect(result.suggestions[0]?.evidence.quote).toBe('Built services in Rust');
  });

  it('accepts the empty answer before the first revision', async () => {
    mockFetch(jsonResponse({ revision_id: null, suggestions: [] }));
    await expect(fetchSkillSuggestions('token')).resolves.toEqual({
      revision_id: null,
      suggestions: [],
    });
  });

  it('fails closed on a suggestion without evidence', async () => {
    mockFetch(
      jsonResponse({ revision_id: REVISION, suggestions: [{ skill_key: 'x', display_name: 'X' }] }),
    );
    await expect(fetchSkillSuggestions('token')).rejects.toThrow();
  });
});

describe('decideSkillSuggestion', () => {
  it('POSTs the decision with the revision to the encoded skill key', async () => {
    const fetchMock = mockFetch(
      jsonResponse(
        {
          skill_key: 'c++',
          decision: 'accepted',
          revision_id: REVISION,
          decided_at: '2026-10-31T10:05:00Z',
        },
        201,
      ),
    );
    const decision = await decideSkillSuggestion('token', 'c++', 'accepted', REVISION);
    expect(decision.decision).toBe('accepted');
    const { url, init, headers } = call(fetchMock);
    expect(url).toMatch(/\/v1\/profile\/skill-suggestions\/c%2B%2B\/decision$/);
    expect(init.method).toBe('POST');
    expect(headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({
      decision: 'accepted',
      revision_id: REVISION,
    });
  });

  it('refuses a malformed revision before any request', async () => {
    const fetchMock = mockFetch(jsonResponse({}));
    await expect(decideSkillSuggestion('token', 'rust', 'rejected', 'nope')).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces the 422 skills cap as a ProblemError with its fields', async () => {
    mockFetch(
      jsonResponse(
        { status: 422, title: 'profile-invalid-field', fields: { skills: 'over 100' } },
        422,
      ),
    );
    const error = await decideSkillSuggestion('token', 'rust', 'accepted', REVISION).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(ProblemError);
    expect((error as ProblemError).problem.fields).toEqual({ skills: 'over 100' });
  });
});

describe('fetchSkillSuggestionDecisions', () => {
  it('returns the latest decision per key', async () => {
    mockFetch(
      jsonResponse({
        decisions: [
          {
            skill_key: 'rust',
            decision: 'rejected',
            revision_id: REVISION,
            decided_at: '2026-10-31T10:05:00Z',
          },
        ],
      }),
    );
    const decisions = await fetchSkillSuggestionDecisions('token');
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.decision).toBe('rejected');
  });
});

describe('searchSkillCatalog', () => {
  it('asks nothing for a blank prefix', async () => {
    const fetchMock = mockFetch(jsonResponse({ skills: [] }));
    await expect(searchSkillCatalog('token', '   ')).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the trimmed prefix and a bounded limit as query parameters', async () => {
    const fetchMock = mockFetch(
      jsonResponse({ skills: [{ skill_key: 'typescript', display_name: 'TypeScript' }] }),
    );
    const entries = await searchSkillCatalog('token', '  type ', 500);
    expect(entries[0]?.display_name).toBe('TypeScript');
    const url = new URL(call(fetchMock).url, 'http://localhost');
    expect(url.pathname).toBe('/v1/skills/catalog');
    expect(url.searchParams.get('prefix')).toBe('type');
    expect(url.searchParams.get('limit')).toBe(String(catalogLimitMax));
  });
});

describe('catalog consent', () => {
  it('reads the active version and the caller decision', async () => {
    mockFetch(
      jsonResponse({
        version: 'catalog-v1',
        consent_text: 'Share your skill names, de-identified.',
        effective_from: '2026-10-01T00:00:00Z',
        granted: null,
        decided_at: null,
      }),
    );
    const consent = await fetchCatalogConsent('token');
    expect(consent.version).toBe('catalog-v1');
    expect(consent.granted).toBeNull();
  });

  it('POSTs the decision for the version the user saw', async () => {
    const fetchMock = mockFetch(
      jsonResponse(
        { consent_version: 'catalog-v1', granted: true, decided_at: '2026-10-31T10:00:00Z' },
        201,
      ),
    );
    const decision = await decideCatalogConsent('token', 'catalog-v1', true);
    expect(decision.granted).toBe(true);
    const { url, init } = call(fetchMock);
    expect(url).toMatch(/\/v1\/consents\/skill-catalog\/decision$/);
    expect(JSON.parse(init.body as string)).toEqual({
      consent_version: 'catalog-v1',
      granted: true,
    });
  });
});

describe('fetchProfileSkills', () => {
  it('parses the skill rows with their origin', async () => {
    mockFetch(
      jsonResponse({
        skills: [
          {
            id: '33333333-3333-4333-8333-333333333333',
            skill_key: 'rust',
            display_name: 'Rust',
            category: 'language',
            self_reported_level: null,
            evidence_refs: null,
            claim_status: 'unverified',
            origin: 'accepted',
          },
        ],
      }),
    );
    const skills = await fetchProfileSkills('token');
    expect(skills[0]?.origin).toBe('accepted');
  });

  it('fails closed on an unknown origin', async () => {
    mockFetch(
      jsonResponse({
        skills: [
          {
            id: '33333333-3333-4333-8333-333333333333',
            skill_key: 'rust',
            display_name: 'Rust',
            category: 'language',
            claim_status: 'unverified',
            origin: 'harness',
          },
        ],
      }),
    );
    await expect(fetchProfileSkills('token')).rejects.toThrow();
  });
});
