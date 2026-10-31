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
      option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(current).toBe('Rust, TypeScript, ');
    expect(document.querySelector('[role="listbox"]')).toBeNull();
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
