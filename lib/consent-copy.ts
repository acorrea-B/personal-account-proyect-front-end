import type { Locale } from '@/lib/i18n';

// The backend stores each consent version's text in English only (the
// contract has no locale). The text the user accepts is the backend's, bound
// to its version; this module only shows a reviewed translation of a known
// version, and only while the backend still sends exactly the English text
// it translates. Any other text (a new version, an edited draft) is shown as
// sent, so a translation never stands in for wording it was not made from.
type Kind = 'journal' | 'catalog';

const translations: Record<Kind, Record<string, { en: string; es: string }>> = {
  journal: {
    v1: {
      en: 'I understand journal entries may inform a profile review after verifier approval.',
      es: 'Entiendo que mis entradas del diario pueden informar una revisión de mi perfil después de la aprobación del verificador.',
    },
  },
  catalog: {
    v1: {
      en: 'I agree that the skills I declare or accept on my profile may be added, by name only and without being linked to me, to a shared catalog that suggests skill names to other users. I can withdraw this at any time.',
      es: 'Acepto que las skills que declaro o acepto en mi perfil puedan añadirse, solo por su nombre y sin vincularse a mí, a un catálogo compartido que sugiere nombres de skills a otras personas. Puedo retirar este consentimiento en cualquier momento.',
    },
  },
};

export function consentText(
  kind: Kind,
  consent: { version: string; consent_text: string },
  locale: Locale,
): string {
  const known = translations[kind][consent.version];
  if (locale === 'es' && known && known.en === consent.consent_text.trim()) {
    return known.es;
  }
  return consent.consent_text;
}
