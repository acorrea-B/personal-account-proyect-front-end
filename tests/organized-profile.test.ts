// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/harness', () => ({ fetchHarnessOutputs: vi.fn() }));

import { OrganizedProfile } from '../components/organized-profile';
import { fetchHarnessOutputs } from '@/lib/api/harness';
import { labels, tr, type Locale } from '../lib/i18n';
import type { CanonicalProfile } from '../lib/schemas/harness';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const profile: CanonicalProfile = {
  experience_items: [
    {
      title: 'Python Engineer',
      start: '2025-10',
      end: 'present',
      scope: 'Built reusable payment integrations.',
      metrics: 'from 3 months to 15 person-days',
      technologies: ['Python', 'AWS', 'Python'],
    },
    {
      title: 'Backend Engineer',
      start: '2021-09',
      end: '2023-02',
      scope: null,
      metrics: null,
      technologies: [],
    },
  ],
  education_items: ['2017 - 2020 BSc Computer Science.'],
  canonical_skills: [{ display_name: 'Rust' }, { display_name: 'AWS' }],
};

function serve(value: CanonicalProfile | null) {
  vi.mocked(fetchHarnessOutputs).mockResolvedValue({
    runAt: '2026-11-01T10:00:00Z',
    metrics: [],
    cvSuggestions: null,
    level: null,
    roles: [],
    profile: value,
  });
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function render(locale: Locale = 'es') {
  await act(async () => {
    root = createRoot(container as HTMLDivElement);
    root.render(createElement(OrganizedProfile, { accessToken: 'token', locale }));
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.clearAllMocks();
});

describe('OrganizedProfile', () => {
  it('shows the experience, education and skills the harness separated', async () => {
    serve(profile);
    await render('es');
    const t = labels('es').organized;
    const section = document.querySelector(`section[aria-label="${t.title}"]`);
    expect(section).not.toBeNull();
    const roles = [...document.querySelectorAll('ol > li')];
    expect(roles).toHaveLength(2);
    expect(roles[0].textContent).toContain(`2025-10 – ${t.present}`);
    expect(roles[0].textContent).toContain(
      tr(t.impact, { metrics: 'from 3 months to 15 person-days' }),
    );
    expect(roles[0].querySelectorAll('ul li')).toHaveLength(2);
    expect(roles[1].textContent).toContain('2021-09 – 2023-02');
    expect(section?.textContent).toContain('2017 - 2020 BSc Computer Science.');
    expect(section?.textContent).toContain('Rust');
  });

  it('shows a profile that only has skills', async () => {
    serve({
      experience_items: [],
      education_items: [],
      canonical_skills: [{ display_name: 'Rust' }],
    });
    await render('en');
    const t = labels('en').organized;
    const section = document.querySelector(`section[aria-label="${t.title}"]`);
    expect(section?.textContent).toContain('Rust');
    expect(section?.textContent).not.toContain(t.experience);
  });

  it('shows nothing until the harness has read the CV', async () => {
    serve(null);
    await render('en');
    expect(document.querySelector('section')).toBeNull();
  });

  it('shows nothing when the harness results cannot load', async () => {
    vi.mocked(fetchHarnessOutputs).mockRejectedValue(new Error('down'));
    await render('en');
    expect(document.querySelector('section')).toBeNull();
  });
});
