import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProblemError } from '../lib/api/client';
import { fetchHarnessOutputs, harnessOutputs, metricsWindow } from '../lib/api/harness';

const uuid = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;

const metrics = (completeness: number) => ({
  schema: 'profile-metrics/1.0.0',
  completeness_score: completeness,
  claim_supported_rate: 0.2,
  over_claimed_rate: 0,
  suggestions: { total: 5, supported: 1, partial: 4, blocked: 0, inferred: 0 },
  skill_suggestions: 12,
  cv: {
    ats_readiness: 0.83,
    structure: 0.85,
    clarity: 0.55,
    impact_metric: 1,
    keyword_coverage: 1,
  },
  level: { label: 'mid', weighted_score: 0.5 },
  model: { calls: 5, retries: 0, total_tokens: 18843 },
});

const revision = (n: number, at: string, output_type: string, content: unknown) => ({
  id: uuid(n),
  user_id: uuid(99),
  profile_revision: 'r1',
  created_at: at,
  profile: {},
  change_summary: { output_type, trace_id: `trace-${at}`, content },
});

const suggestion = {
  suggestion_id: 'model-summary-0',
  section: 'Summary',
  suggested_text: 'Lead with the backend scope.',
  rationale: 'Clearer first read.',
  verification_status: 'AllSupported',
  evidence_refs: ['headline-value'],
};

const level = {
  seniority_label: 'Mid',
  weighted_score: 0.5,
  rationale: 'private rationale',
  dimension_scores: [{ dimension: 'skill_depth', score: 0.15, rationale: 'no years' }],
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

describe('harnessOutputs', () => {
  it('takes the newest output of each type and the metrics oldest first', () => {
    const outputs = harnessOutputs([
      revision(1, '2026-11-01T10:00:00Z', 'profile_metrics', metrics(0.9)),
      revision(2, '2026-11-01T10:00:00Z', 'cv_suggestions', [suggestion]),
      revision(3, '2026-11-01T10:00:00Z', 'level_assessment', level),
      revision(4, '2026-10-20T10:00:00Z', 'profile_metrics', metrics(0.7)),
      revision(5, '2026-10-20T10:00:00Z', 'cv_suggestions', []),
    ]);
    expect(outputs.runAt).toBe('2026-11-01T10:00:00Z');
    expect(outputs.metrics.map((point) => point.metrics.completeness_score)).toEqual([0.7, 0.9]);
    expect(outputs.cvSuggestions).toEqual([
      {
        suggestion_id: 'model-summary-0',
        section: 'Summary',
        suggested_text: 'Lead with the backend scope.',
        rationale: 'Clearer first read.',
        verification_status: 'AllSupported',
      },
    ]);
    expect(outputs.level?.seniority_label).toBe('Mid');
    expect(outputs.roles).toEqual([]);
  });

  it('skips an output that breaks its shape and keeps the older valid one', () => {
    const outputs = harnessOutputs([
      revision(1, '2026-11-01T10:00:00Z', 'level_assessment', { seniority_label: 3 }),
      revision(2, '2026-10-20T10:00:00Z', 'level_assessment', level),
      revision(3, '2026-10-20T10:00:00Z', 'profile_metrics', { schema: 'other' }),
    ]);
    expect(outputs.level?.weighted_score).toBe(0.5);
    expect(outputs.metrics).toEqual([]);
  });

  it('keeps the metrics of a run that published no skill suggestions count', () => {
    const withoutCount: Record<string, unknown> = { ...metrics(0.9) };
    delete withoutCount.skill_suggestions;
    const outputs = harnessOutputs([
      revision(1, '2026-11-01T10:00:00Z', 'profile_metrics', withoutCount),
    ]);
    expect(outputs.metrics).toHaveLength(1);
    expect(outputs.metrics[0].metrics.skill_suggestions).toBeUndefined();
  });

  it('bounds the trend to the newest runs', () => {
    const many = Array.from({ length: metricsWindow + 3 }, (_, n) =>
      revision(
        n,
        `2026-10-${String(30 - n).padStart(2, '0')}T10:00:00Z`,
        'profile_metrics',
        metrics(0.5),
      ),
    );
    expect(harnessOutputs(many).metrics).toHaveLength(metricsWindow);
  });

  it('answers empty before the first run', () => {
    expect(harnessOutputs([])).toEqual({
      runAt: null,
      metrics: [],
      cvSuggestions: null,
      level: null,
      roles: [],
      profile: null,
    });
  });

  it('keeps the organized profile the harness separated', () => {
    const outputs = harnessOutputs([
      revision(1, '2026-11-01T10:00:00Z', 'canonical_profile', {
        completeness_score: 0.9,
        experience_items: [
          {
            title: 'Python Engineer',
            start: '2025-10',
            end: 'present',
            scope: 'Built payment integrations.',
            metrics: 'from 3 months to 15 person-days',
            technologies: ['Python', 'AWS'],
            evidence_refs: ['experience-evidence:cv-text'],
          },
        ],
        education_items: ['2017 - 2020 BSc Computer Science.'],
        canonical_skills: [{ display_name: 'Rust', claim_status: 'MissingEvidence' }],
      }),
    ]);
    expect(outputs.profile?.experience_items[0]).toEqual({
      title: 'Python Engineer',
      start: '2025-10',
      end: 'present',
      scope: 'Built payment integrations.',
      metrics: 'from 3 months to 15 person-days',
      technologies: ['Python', 'AWS'],
    });
    expect(outputs.profile?.education_items).toEqual(['2017 - 2020 BSc Computer Science.']);
    expect(outputs.profile?.canonical_skills).toEqual([{ display_name: 'Rust' }]);
  });
});

describe('fetchHarnessOutputs', () => {
  it('reads the revisions with the bearer token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        json({ revisions: [revision(1, '2026-11-01T10:00:00Z', 'profile_metrics', metrics(0.9))] }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const outputs = await fetchHarnessOutputs('token');
    expect(outputs.metrics).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/v1\/profile\/revisions$/);
    expect(init.headers).toEqual({ Authorization: 'Bearer token' });
  });

  it('throws a ProblemError on a non-2xx answer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ status: 503, title: 'down' }, 503)));
    await expect(fetchHarnessOutputs('token')).rejects.toBeInstanceOf(ProblemError);
  });
});
