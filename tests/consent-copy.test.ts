import { describe, expect, it } from 'vitest';

import { consentText } from '../lib/consent-copy';

const journalV1 = {
  version: 'v1',
  consent_text: 'I understand journal entries may inform a profile review after verifier approval.',
};

describe('consentText', () => {
  it('shows the reviewed Spanish translation of a known version', () => {
    expect(consentText('journal', journalV1, 'es')).toBe(
      'Entiendo que mis entradas del diario pueden informar una revisión de mi perfil después de la aprobación del verificador.',
    );
    expect(consentText('journal', journalV1, 'en')).toBe(journalV1.consent_text);
  });

  it('shows the backend text when it is not exactly the one translated', () => {
    const edited = { version: 'v1', consent_text: 'A revised draft of the journal consent.' };
    expect(consentText('journal', edited, 'es')).toBe(edited.consent_text);
    const unknown = { version: 'v2', consent_text: journalV1.consent_text };
    expect(consentText('journal', unknown, 'es')).toBe(journalV1.consent_text);
  });

  it('translates the catalog consent of its own kind only', () => {
    const catalog = {
      version: 'v1',
      consent_text:
        'I agree that the skills I declare or accept on my profile may be added, by name only and without being linked to me, to a shared catalog that suggests skill names to other users. I can withdraw this at any time.',
    };
    expect(consentText('catalog', catalog, 'es')).toMatch(/^Acepto que las skills/);
    expect(consentText('journal', catalog, 'es')).toBe(catalog.consent_text);
  });
});
