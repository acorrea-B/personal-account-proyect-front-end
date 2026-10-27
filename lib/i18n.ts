import { z } from 'zod';
import enDictionary from './i18n/en.json';
import esDictionary from './i18n/es.json';

// The i18n dictionaries live as data files: lib/i18n/en.json and es.json hold
// every user-facing string of the shared components, keyed per locale. Both
// files parse through the same zod schema, so a missing or drifted
// translation fails the build instead of rendering a blank label on some
// page. The components take a `locale` prop (the trees own the locale) and
// read their labels from here - the strings live in the json, the trees stay
// thin.

// The shape shared by every locale file; the Labels type derives from it.
export const labelsSchema = z.object({
  account: z.string(),
  updateProfile: z.string(),
  signOut: z.string(),
  language: z.string(),
  cvCard: z.object({
    title: z.string(),
    live: z.string(),
    lastSaved: z.string(),
    edit: z.string(),
    empty: z.string(),
    write: z.string(),
    retry: z.string(),
  }),
  history: z.object({
    title: z.string(),
    empty: z.string(),
    retry: z.string(),
    viewLabel: z.string(),
  }),
  versionDetail: z.object({
    eyebrow: z.string(),
    viewHeading: z.string(),
    viewFallback: z.string(),
    origin: z.string(),
    restore: z.string(),
    restored: z.string(),
    restoredNote: z.string(),
    close: z.string(),
    dismiss: z.string(),
  }),
  panel: z.object({
    eyebrow: z.string(),
    fullName: z.string(),
    headline: z.string(),
    bio: z.string(),
    location: z.string(),
    skills: z.string(),
    links: z.string(),
    updatedNote: z.string(),
    updateLink: z.string(),
    comingUp: z.string(),
    liveCard: z.string(),
  }),
  clampedText: z.object({
    showMore: z.string(),
    showLess: z.string(),
  }),
  login: z.object({
    heading: z.string(),
    subtitle: z.string(),
    email: z.string(),
    password: z.string(),
    submit: z.string(),
    submitting: z.string(),
    invalid: z.string(),
    rateCappedWithSeconds: z.string(),
    rateCapped: z.string(),
    generic: z.string(),
    timeout: z.string(),
    unexpected: z.string(),
    registerEntry: z.string(),
    otherLanguage: z.string(),
  }),
  register: z.object({
    kicker: z.string(),
    heading: z.string(),
    subtitle: z.string(),
    stepAccount: z.string(),
    stepVerify: z.string(),
    stepProfile: z.string(),
    email: z.string(),
    password: z.string(),
    submit: z.string(),
    submitting: z.string(),
    conflict: z.string(),
    rateCappedWithSeconds: z.string(),
    rateCapped: z.string(),
    generic: z.string(),
    timeout: z.string(),
    unexpected: z.string(),
    loginQuestion: z.string(),
    loginEntry: z.string(),
    otherLanguage: z.string(),
  }),
});

export type Labels = z.infer<typeof labelsSchema>;
export type Locale = 'en' | 'es';

// Fills the {var} placeholders of a dictionary template; unknown variables
// keep their placeholder so a typo is visible on the page, not swallowed.
export function tr(template: string, vars: Record<string, string> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? vars[key] : match));
}

// The parsed dictionaries: en is the schema's voice, es must satisfy the
// same shape or the module import fails at load time.
const strings: Record<Locale, Labels> = {
  en: labelsSchema.parse(enDictionary),
  es: labelsSchema.parse(esDictionary),
};

// The locale's dictionary; undefined and other tags degrade to english.
export function labels(locale: Locale | undefined): Labels {
  return locale === 'es' ? strings.es : strings.en;
}

// Resolves a user agent language tag to a supported locale; unknown tags
// degrade to english (the account entry point's default).
export function resolveLocale(input?: string | null): Locale {
  const normalized = (input ?? 'en').toLowerCase();
  return normalized.startsWith('es') ? 'es' : 'en';
}
