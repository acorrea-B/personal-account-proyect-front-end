import { describe, expect, it } from 'vitest';
import { resolveLocale } from '../lib/i18n';

describe('resolveLocale', () => {
  it('defaults to English', () => {
    expect(resolveLocale()).toBe('en');
    expect(resolveLocale(null)).toBe('en');
  });

  it('accepts Spanish variants', () => {
    expect(resolveLocale('es')).toBe('es');
    expect(resolveLocale('es-CO')).toBe('es');
  });

  it('falls back to English for other locales', () => {
    expect(resolveLocale('fr')).toBe('en');
  });
});
