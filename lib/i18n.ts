export type Locale = 'en' | 'es';

export function resolveLocale(input?: string | null): Locale {
  const normalized = (input ?? 'en').toLowerCase();
  return normalized.startsWith('es') ? 'es' : 'en';
}
