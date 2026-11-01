// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pushMock = vi.fn();
const replaceMock = vi.fn();
const routerStub = { push: pushMock, replace: replaceMock };

vi.mock('next/navigation', () => ({
  useRouter: () => routerStub,
  usePathname: () => null,
}));

const requireAuthMock = vi.fn();
vi.mock('@/lib/auth/useRequireAuth', () => ({
  useRequireAuth: () => requireAuthMock(),
}));

const fetchProfileMock = vi.fn();
const updateProfileMock = vi.fn();
vi.mock('@/lib/api/profile', async () => ({
  ...(await vi.importActual<typeof import('@/lib/api/profile')>('@/lib/api/profile')),
  fetchProfile: (...args: unknown[]) => fetchProfileMock(...args),
  updateProfile: (...args: unknown[]) => updateProfileMock(...args),
}));

const searchCitiesMock = vi.fn();
vi.mock('@/lib/api/suggestions', () => ({
  searchSkillCatalog: vi.fn().mockResolvedValue([]),
  fetchCatalogConsent: vi.fn().mockResolvedValue({
    version: 'catalog-v1',
    consent_text: 'Share your skill names, de-identified.',
    effective_from: '2026-10-01T00:00:00Z',
    granted: null,
    decided_at: null,
  }),
  decideCatalogConsent: vi.fn(),
}));

vi.mock('@/lib/api/geocoding', async () => ({
  ...(await vi.importActual<typeof import('@/lib/api/geocoding')>('@/lib/api/geocoding')),
  searchCities: (...args: unknown[]) => searchCitiesMock(...args),
}));

import { ProblemError } from '@/lib/api/client';
import { labels } from '@/lib/i18n';
import { ProfileView } from '../components/profile-view';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const LIVE_PROFILE = {
  id: 'profile-1',
  full_name: 'Juan Pérez',
  headline: 'Frontend craftsperson',
  bio: 'Building calm tools.',
  location: 'Bogotá',
  skills: ['TypeScript', 'Next.js'],
  links: [{ url: 'https://github.com/juan', type: 'github' }],
  updated_at: '2026-10-27T10:00:00.000Z',
};

const PLACEHOLDER_PROFILE = {
  id: 'profile-2',
  full_name: 'User',
  updated_at: '2026-10-27T10:00:00.000Z',
};

function authorizedSession(): void {
  requireAuthMock.mockReturnValue({
    isHydrated: true,
    isAuthorized: true,
    session: {
      accessToken: 'token-1',
      refreshToken: 'refresh-1',
      user: {
        id: 'user-1',
        email: 'juan@example.com',
        verified: true,
        created_at: '2026-10-25T00:00:00.000Z',
      },
    },
  });
}

// next/link normalizes trailing slashes in the jsdom environment (no
// router config there) while the static export keeps them; compare the
// canonical path so the assertion is honest on both runtimes.
function hrefOf(anchor: HTMLAnchorElement | null): string {
  return (anchor?.getAttribute('href') ?? '').replace(/\/+$/, '') || '/';
}

async function save(): Promise<void> {
  const button = [...document.querySelectorAll('button')].find(
    (button) => button.type === 'submit',
  );
  if (!button) {
    throw new Error('save button not found');
  }
  await act(async () => {
    button.click();
  });
  await act(async () => {
    await Promise.resolve();
  });
}

describe('ProfileView', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    pushMock.mockClear();
    replaceMock.mockClear();
    fetchProfileMock.mockReset();
    updateProfileMock.mockReset();
    searchCitiesMock.mockReset();
    window.sessionStorage.clear();
    authorizedSession();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => root?.unmount());
    }
    container?.remove();
    root = null;
  });

  async function render(locale: 'en' | 'es'): Promise<void> {
    if (root) {
      const previous = root;
      root = null;
      await act(async () => previous.unmount());
    }
    await act(async () => {
      root = createRoot(container as HTMLDivElement);
      root.render(createElement(ProfileView, { locale }));
    });
  }

  function typeInto(field: string, value: string): void {
    const input = document.querySelector<HTMLInputElement>(`input[name="${field}"]`);
    if (!input) {
      throw new Error(`input not found: ${field}`);
    }
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  it('opens the update flow with the english dictionary on the en route', async () => {
    fetchProfileMock.mockResolvedValueOnce(LIVE_PROFILE);
    await render('en');
    const t = labels('en');
    expect(document.querySelector('h1')?.textContent).toBe(t.profile.updateHeading);
    const name = document.querySelector<HTMLInputElement>('input[name="full_name"]');
    expect(name?.value).toBe('Juan Pérez');
    const home = [...document.querySelectorAll('header a[aria-label]')].map((element) =>
      hrefOf(element as HTMLAnchorElement),
    );
    expect(home).toContain('/app');
    expect(document.body.textContent).toContain(t.profile.updateCta);
    expect(document.body.textContent).toContain(
      t.workspace.signedInAs.replace('{email}', 'juan@example.com'),
    );
  });

  it('opens the update flow with the spanish dictionary on the es route', async () => {
    fetchProfileMock.mockResolvedValueOnce(LIVE_PROFILE);
    await render('es');
    const t = labels('es');
    expect(document.querySelector('h1')?.textContent).toBe(t.profile.updateHeading);
    const home = [...document.querySelectorAll('header a[aria-label]')].map((element) =>
      hrefOf(element as HTMLAnchorElement),
    );
    expect(home).toContain('/es/app');
    expect(document.body.textContent).toContain(t.profile.updateCta);
  });

  it('speaks the editor rules in the tree language (name lost on update)', async () => {
    fetchProfileMock.mockResolvedValueOnce(LIVE_PROFILE);
    await render('es');
    typeInto('full_name', '');
    await save();
    expect(document.body.textContent).toContain(labels('es').profile.nameRequiredUpdate);
    expect(updateProfileMock).not.toHaveBeenCalled();
  });

  it('runs the onboarding flow on the placeholder profile', async () => {
    fetchProfileMock.mockResolvedValueOnce(PLACEHOLDER_PROFILE);
    await render('en');
    const t = labels('en');
    expect(document.querySelector('h1')?.textContent).toBe(t.profile.onboardingHeading);
    expect(document.body.textContent).toContain(t.profile.onboardingKicker);
    expect(document.body.textContent).toContain(t.profile.onboardingCta);
    // The placeholder leaves the name empty; the editor's rule demands it
    // before the save can run.
    typeInto('full_name', 'Juan Pérez');
    updateProfileMock.mockResolvedValueOnce(LIVE_PROFILE);
    await save();
    expect(document.querySelector('div[role="status"]')?.textContent).toContain(
      t.profile.toastOnboarding,
    );
    const openWorkspace = [...document.querySelectorAll('form a')].map((element) =>
      hrefOf(element as HTMLAnchorElement),
    );
    expect(openWorkspace).toContain('/app');
  });

  it('names the conflict on a 412 and reloads the latest profile', async () => {
    fetchProfileMock.mockResolvedValueOnce(LIVE_PROFILE);
    await render('en');
    updateProfileMock.mockRejectedValueOnce(
      new ProblemError({ status: 412, current_updated_at: '2026-10-27T11:00:00.000Z' }),
    );
    fetchProfileMock.mockResolvedValueOnce(LIVE_PROFILE);
    await save();
    expect(document.querySelector('div[role="status"]')?.textContent).toContain(
      labels('en').profile.conflictNote,
    );
  });

  it('says the profile validation in the tree language', async () => {
    fetchProfileMock.mockResolvedValueOnce(LIVE_PROFILE);
    await render('es');
    const v = labels('es').validation;
    typeInto('skills', `rust, ${'x'.repeat(41)}`);
    await save();
    expect(document.getElementById('setup-skills-error')?.textContent).toBe(v.skillTooLong);
    typeInto('skills', 'rust, Rust');
    await save();
    expect(document.getElementById('setup-skills-error')?.textContent).toBe(v.skillsRepeat);
    expect(updateProfileMock).not.toHaveBeenCalled();
  });

  it('lets the keyboard and assistive tech pick a location option', async () => {
    fetchProfileMock.mockResolvedValueOnce(LIVE_PROFILE);
    searchCitiesMock.mockResolvedValue([{ label: 'Medellín, CO' }, { label: 'Madrid, ES' }]);
    await render('en');
    typeInto('location', 'Me');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    const input = document.getElementById('setup-location') as HTMLInputElement;
    const option = document.querySelector('[role="option"] button') as HTMLButtonElement;
    expect(option.tabIndex).toBe(-1);
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    const active = input.getAttribute('aria-activedescendant');
    expect(document.getElementById(active as string)?.textContent).toBe('Medellín, CO');
    await act(async () => {
      option.click();
    });
    expect(input.value).toBe('Medellín, CO');
  });
});
