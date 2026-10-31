// @vitest-environment jsdom
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/suggestions', () => ({
  searchSkillCatalog: vi.fn(),
}));

import { SkillCatalogInput, lastSkillToken } from '../components/skill-catalog-input';
import { searchSkillCatalog } from '@/lib/api/suggestions';
import { labels } from '../lib/i18n';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let current = '';

function Harness({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  current = value;
  return createElement(SkillCatalogInput, {
    id: 'skills',
    value,
    onValueChange: setValue,
    accessToken: 'token',
    locale: 'en',
  });
}

async function render(initial = '') {
  await act(async () => {
    root = createRoot(container as HTMLDivElement);
    root.render(createElement(Harness, { initial }));
  });
}

function input(): HTMLInputElement {
  return document.querySelector('input') as HTMLInputElement;
}

async function type(value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input(), value);
    input().dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => {
    vi.advanceTimersByTime(300);
  });
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(searchSkillCatalog).mockReset();
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
  }
  container?.remove();
  root = null;
  vi.useRealTimers();
});

describe('lastSkillToken', () => {
  it('reads the name being typed after the last comma', () => {
    expect(lastSkillToken('Rust, Ty')).toBe('Ty');
    expect(lastSkillToken('Rust,')).toBe('');
    expect(lastSkillToken('  go ')).toBe('go');
  });
});

describe('SkillCatalogInput', () => {
  it('searches the catalog for the last name and lists matches not already typed', async () => {
    vi.mocked(searchSkillCatalog).mockResolvedValue([
      { skill_key: 'rust', display_name: 'Rust' },
      { skill_key: 'typescript', display_name: 'TypeScript' },
    ]);
    await render('');
    await type('Rust, ty');
    expect(searchSkillCatalog).toHaveBeenCalledWith('token', 'ty');
    const list = document.querySelector(
      `[role="listbox"][aria-label="${labels('en').catalogInput.listAria}"]`,
    );
    expect(list).not.toBeNull();
    const options = [...document.querySelectorAll('[role="option"]')].map((o) => o.textContent);
    expect(options).toEqual(['TypeScript']);
    expect(input().getAttribute('aria-expanded')).toBe('true');
  });

  it('asks nothing for a name shorter than two characters', async () => {
    await render('');
    await type('Rust, t');
    expect(searchSkillCatalog).not.toHaveBeenCalled();
  });

  it('replaces the typed name with the picked catalog spelling', async () => {
    vi.mocked(searchSkillCatalog).mockResolvedValue([
      { skill_key: 'typescript', display_name: 'TypeScript' },
    ]);
    await render('');
    await type('Rust, typ');
    const option = document.querySelector('[role="option"] button') as HTMLButtonElement;
    await act(async () => {
      option.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(current).toBe('Rust, TypeScript, ');
    expect(document.querySelector('[role="listbox"]')).toBeNull();
  });

  it('drops a late answer for a token the user already erased', async () => {
    let resolveSearch: (entries: { skill_key: string; display_name: string }[]) => void = () => {};
    vi.mocked(searchSkillCatalog).mockReturnValue(
      new Promise((resolve) => {
        resolveSearch = resolve;
      }),
    );
    await render('');
    await type('ty');
    await type('t');
    await act(async () => {
      resolveSearch([{ skill_key: 'typescript', display_name: 'TypeScript' }]);
      await Promise.resolve();
    });
    expect(document.querySelector('[role="listbox"]')).toBeNull();
  });

  it('clears the old matches and highlight as soon as the token changes', async () => {
    vi.mocked(searchSkillCatalog).mockResolvedValue([{ skill_key: 'go', display_name: 'Go' }]);
    await render('');
    await type('go');
    await act(async () => {
      input().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    // A new token: before its debounced search answers, nothing stale is
    // listed or selectable.
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input(), 'gra');
      input().dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    expect(input().getAttribute('aria-activedescendant')).toBeNull();
  });

  it('exposes the highlighted option as the active descendant', async () => {
    vi.mocked(searchSkillCatalog).mockResolvedValue([
      { skill_key: 'go', display_name: 'Go' },
      { skill_key: 'graphql', display_name: 'GraphQL' },
    ]);
    await render('');
    await type('gr');
    expect(input().getAttribute('aria-activedescendant')).toBeNull();
    await act(async () => {
      input().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    const active = input().getAttribute('aria-activedescendant');
    expect(active).toBeTruthy();
    expect(document.getElementById(active as string)?.textContent).toBe('Go');
  });

  it('picks with the keyboard and closes on Escape', async () => {
    vi.mocked(searchSkillCatalog).mockResolvedValue([
      { skill_key: 'go', display_name: 'Go' },
      { skill_key: 'graphql', display_name: 'GraphQL' },
    ]);
    await render('');
    await type('gr');
    const key = async (name: string) =>
      act(async () => {
        input().dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
      });
    await key('ArrowDown');
    await key('ArrowDown');
    await key('Enter');
    expect(current).toBe('GraphQL, ');
    await type('GraphQL, go');
    await key('Escape');
    expect(document.querySelector('[role="listbox"]')).toBeNull();
  });
});
