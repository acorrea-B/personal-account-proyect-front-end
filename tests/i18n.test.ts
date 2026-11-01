import { describe, expect, it } from 'vitest';
import { labels, labelsSchema, resolveLocale, tr } from '../lib/i18n';

// Recursively lists the leaf paths of a labels tree; the en/es dictionaries
// must expose exactly the same keys or the parity test fails.
function deepKeys(value: unknown, prefix = ''): string[] {
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      deepKeys(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [prefix];
}

describe('the json dictionaries', () => {
  it('expose the same keys in every locale', () => {
    const en = labels('en');
    const es = labels('es');
    expect(deepKeys(es)).toEqual(deepKeys(en));
  });

  it('rejects a dictionary that lost a key', () => {
    const broken: Record<string, unknown> = { ...labels('es') };
    delete broken.account;
    expect(() => labelsSchema.parse(broken)).toThrow();
  });
});

describe('tr', () => {
  it('interpolates the template variables from a dictionary label', () => {
    expect(tr(labels('en').metrics.asOf, { date: 'Oct 30' })).toBe('From the revision of Oct 30');
    expect(tr(labels('es').metrics.asOf, { date: '30 oct' })).toBe('De la revisión del 30 oct');
  });

  it('keeps the placeholder when the variable is missing', () => {
    expect(tr(labels('en').metrics.asOf)).toBe('From the revision of {date}');
  });
});

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
