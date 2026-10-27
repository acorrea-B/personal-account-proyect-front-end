import { describe, expect, it } from 'vitest';

import { swapLocalePath } from '../components/language-select';

describe('swapLocalePath', () => {
  it('maps the landing root to the es tree', () => {
    expect(swapLocalePath('/')).toBe('/es/');
  });

  it('maps the es landing back to the english root', () => {
    expect(swapLocalePath('/es/')).toBe('/');
  });

  it('strips the es prefix from inner routes', () => {
    expect(swapLocalePath('/es/login/')).toBe('/login/');
    expect(swapLocalePath('/es/app/cv/')).toBe('/app/cv/');
  });

  it('prefixes inner routes when switching to es', () => {
    expect(swapLocalePath('/login/')).toBe('/es/login/');
    expect(swapLocalePath('/app/cv/')).toBe('/es/app/cv/');
  });

  it('never stacks a second prefix', () => {
    expect(swapLocalePath('/es/')).toBe('/');
    expect(swapLocalePath('/')).not.toMatch(/\/es\/es\//);
  });
});
