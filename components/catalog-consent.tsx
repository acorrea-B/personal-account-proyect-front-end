'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Skeleton } from '@/components/skeleton';
import { AuthKicker, cx, ghostButton, inlineAlert, outlineButton } from '@/components/ui';
import { ProblemError } from '@/lib/api/client';
import { decideCatalogConsent, fetchCatalogConsent } from '@/lib/api/suggestions';
import { consentText } from '@/lib/consent-copy';
import { type Locale, labels, tr } from '@/lib/i18n';
import type { CatalogConsent as Consent } from '@/lib/schemas/suggestions';

type ConsentState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; consent: Consent };

// The skill catalog contribution consent (BC-012, ADR 0019): the user reads
// the active consent text and grants or withdraws sharing their skill names
// in the de-identified catalog. The decision is append-only and always for
// the version shown; a version that is no longer active is reloaded.
export function CatalogConsent({ accessToken, locale }: { accessToken: string; locale: Locale }) {
  const t = labels(locale).catalogConsent;
  const [state, setState] = useState<ConsentState>({ kind: 'loading' });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'alert' | 'status'; text: string } | null>(null);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      setState({ kind: 'ready', consent: await fetchCatalogConsent(accessToken) });
    } catch {
      setState({ kind: 'error' });
    }
  }, [accessToken]);

  // Loads once per visit: a renewed access token (the session refreshes it
  // in the background) must not reload under a decision in flight.
  const loaded = useRef(false);
  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      void load();
    }
  }, [load]);

  async function decide(granted: boolean) {
    if (state.kind !== 'ready') {
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const decision = await decideCatalogConsent(accessToken, state.consent.version, granted);
      setState({
        kind: 'ready',
        consent: { ...state.consent, granted: decision.granted, decided_at: decision.decided_at },
      });
    } catch (error) {
      if (error instanceof ProblemError && error.problem.status === 400) {
        await load();
        setNotice({ tone: 'status', text: t.changed });
      } else {
        setNotice({ tone: 'alert', text: t.failed });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="grid gap-8 border-t border-stone-border pt-16" aria-label={t.title}>
      <AuthKicker>{t.title}</AuthKicker>
      <p className="m-0 text-[14px] leading-[1.6] text-warm-gray">{t.intro}</p>
      {state.kind === 'loading' ? (
        <div className="grid gap-8" aria-label={t.loadingAria}>
          <Skeleton width="100%" height={12} />
          <Skeleton width="70%" height={12} />
        </div>
      ) : state.kind === 'error' ? (
        <div className="grid justify-items-start gap-8">
          <p role="alert" className="m-0 text-[14px] text-soot">
            {t.loadFailed}
          </p>
          <button type="button" className={ghostButton} onClick={() => void load()}>
            {t.retry}
          </button>
        </div>
      ) : (
        <>
          <blockquote className="m-0 max-h-[160px] overflow-y-auto rounded-lg border border-stone-border bg-stone-canvas p-12 text-[14px] leading-[1.6] whitespace-pre-wrap text-ink-black">
            {consentText('catalog', state.consent, locale)}
          </blockquote>
          <p className="m-0 text-(length:--text-label) text-warm-gray">
            {tr(t.version, { version: state.consent.version })}
          </p>
          <p className="m-0 font-medium text-ink-black">
            {state.consent.granted === true
              ? t.granted
              : state.consent.granted === false
                ? t.withdrawn
                : t.undecided}
          </p>
          <div>
            {state.consent.granted === true ? (
              <button
                type="button"
                className={ghostButton}
                disabled={saving}
                onClick={() => void decide(false)}
              >
                {saving ? t.saving : t.withdraw}
              </button>
            ) : (
              <button
                type="button"
                className={outlineButton}
                disabled={saving}
                onClick={() => void decide(true)}
              >
                {saving ? t.saving : t.grant}
              </button>
            )}
          </div>
        </>
      )}
      {notice ? (
        <p
          role={notice.tone}
          className={cx('m-0', inlineAlert, notice.tone === 'status' && 'border-cyan-text')}
        >
          {notice.text}
        </p>
      ) : null}
    </section>
  );
}
