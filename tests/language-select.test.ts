import { describe, expect, it } from 'vitest';

import { swapLocalePath } from '../components/language-select';

describe('swapLocalePath', () => {
  it('maps the landing root to the es tree', () => {
    expect(swapLocalePath('/', 'en')).toBe('/es/');
  });

  it('maps the es landing back to the english root', () => {
    expect(swapLocalePath('/es/', 'es')).toBe('/');
  });

  it('strips the es prefix from inner routes', () => {
    expect(swapLocalePath('/es/login/', 'es')).toBe('/login/');
    expect(swapLocalePath('/es/app/cv/', 'es')).toBe('/app/cv/');
  });

  it('prefixes inner routes when switching to es', () => {
    expect(swapLocalePath('/login/', 'en')).toBe('/es/login/');
    expect(swapLocalePath('/app/cv/', 'en')).toBe('/es/app/cv/');
  });

  it('never stacks a second prefix', () => {
    expect(swapLocalePath('/es/', 'en')).toBe('/');
    expect(swapLocalePath('/', 'es')).not.toMatch(/\/es\/es\//);
  });
});
