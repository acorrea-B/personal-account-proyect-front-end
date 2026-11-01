'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { cx, ghostButton, primaryButton } from '@/components/ui';
import { fetchHarnessOutputs } from '@/lib/api/harness';
import { fetchSkillSuggestions, fetchSuggestionsSummary } from '@/lib/api/suggestions';
import { type Locale, labels, tr } from '@/lib/i18n';
import type { CvSuggestion, VerificationStatus } from '@/lib/schemas/harness';
import { markCvRevisionSeen, readSeenCvRevision } from '@/lib/suggestions-signal';

type Step = { kind: 'suggestion'; suggestion: CvSuggestion } | { kind: 'skills'; names: string[] };

type TourData = { steps: Step[]; cvRevision: string | null };

// Backed advice first; what verification blocked is not advice, so it never
// becomes a step (the AI suggestions card lists it as what is missing).
const order: VerificationStatus[] = ['AllSupported', 'Mixed', 'AllInferred'];

// How many skill names the skills step shows before "+N".
export const skillsShown = 8;

const plainRationale = (rationale: string) => rationale.replace(/^\[inferred\]\s*/, '');

// The steps of the tour: one per CV suggestion worth acting on, then the
// skills the CV shows that the profile does not declare.
export function tourSteps(cvSuggestions: CvSuggestion[] | null, skillNames: string[]): Step[] {
  const advice = (cvSuggestions ?? [])
    .filter((suggestion) => suggestion.verification_status !== 'Blocked')
    .sort(
      (left, right) =>
        order.indexOf(left.verification_status) - order.indexOf(right.verification_status),
    )
    .map((suggestion): Step => ({ kind: 'suggestion', suggestion }));
  return skillNames.length ? [...advice, { kind: 'skills', names: skillNames }] : advice;
}

// The profile's suggestions tour: a call to action above the profile while
// the newest harness run has advice the user has not walked, and a
// step-by-step window with a progress indicator. Finishing (or closing)
// remembers the CV revision walked, which also clears the menu marker.
export function SuggestionsTour({ accessToken, locale }: { accessToken: string; locale: Locale }) {
  const t = labels(locale).tour;
  const [data, setData] = useState<TourData | null>(null);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [index, setIndex] = useState(0);
  const startRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;

  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current) {
      return;
    }
    loaded.current = true;
    const token = tokenRef.current;
    void Promise.all([
      fetchHarnessOutputs(token),
      fetchSuggestionsSummary(token),
      fetchSkillSuggestions(token),
    ])
      .then(([outputs, summary, skills]) => {
        const cvRevision = summary.cv.revision_id;
        // A walked CV revision only offers the tour again for new skills.
        const walked = cvRevision !== null && cvRevision === readSeenCvRevision();
        const steps = tourSteps(
          walked ? [] : outputs.cvSuggestions,
          skills.suggestions.map((suggestion) => suggestion.display_name),
        );
        setData({ steps, cvRevision });
      })
      // The tour is an invitation: if it cannot load, the profile stays as is.
      .catch(() => setData({ steps: [], cvRevision: null }));
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setDismissed(true);
    if (data?.cvRevision) {
      markCvRevisionSeen(data.cvRevision);
    }
    startRef.current?.focus();
  }, [data]);

  useEffect(() => {
    if (!open) {
      return;
    }
    headingRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, index, close]);

  if (!data || !data.steps.length || dismissed) {
    return null;
  }

  const total = data.steps.length;
  const step = data.steps[index];
  const last = index === total - 1;
  const progress = tr(t.progress, { step: String(index + 1), total: String(total) });

  return (
    <>
      <section
        aria-label={t.bannerTitle}
        className="grid animate-content-resolve gap-12 rounded-2xl border border-cyan-edge bg-[linear-gradient(120deg,var(--color-sky-wash-soft),var(--color-pure-white)_70%)] p-24 motion-reduce:animate-none sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
      >
        <div className="grid gap-4">
          <h2 className="m-0 font-roobert text-title-sm font-medium text-ink-black">
            {t.bannerTitle}
          </h2>
          <p className="m-0 text-[14px] leading-[1.6] text-warm-gray">{t.bannerCopy}</p>
        </div>
        <div className="flex flex-wrap gap-8">
          <button
            ref={startRef}
            type="button"
            className={primaryButton}
            onClick={() => {
              setIndex(0);
              setOpen(true);
            }}
          >
            {t.start}
          </button>
          <button type="button" className={ghostButton} onClick={() => setDismissed(true)}>
            {t.later}
          </button>
        </div>
      </section>

      {open ? (
        <div className="fixed inset-0 z-50 grid animate-overlay-in place-items-center bg-[rgba(28,25,23,0.45)] p-16 motion-reduce:animate-none">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t.dialogAria}
            className="grid w-full max-w-[560px] animate-dialog-in gap-16 rounded-2xl bg-pure-white p-24 shadow-xl motion-reduce:animate-none"
          >
            <div className="grid gap-8">
              <div className="flex items-center justify-between gap-12 text-[13px] text-warm-gray">
                <span>{progress}</span>
                <button
                  type="button"
                  onClick={close}
                  className="cursor-pointer border-none bg-transparent p-4 [font-family:inherit] text-[13px] text-warm-gray hover:text-ink-black"
                >
                  {t.close}
                </button>
              </div>
              <div
                role="progressbar"
                aria-label={progress}
                aria-valuemin={1}
                aria-valuemax={total}
                aria-valuenow={index + 1}
                className="h-[6px] overflow-hidden rounded-full bg-sky-wash-soft"
              >
                <div
                  className="h-full rounded-full bg-cyan-text-strong transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
                  style={{ width: `${((index + 1) / total) * 100}%` }}
                />
              </div>
            </div>

            <div key={index} className="grid animate-step-in gap-12 motion-reduce:animate-none">
              {step.kind === 'suggestion' ? (
                <>
                  <h3
                    ref={headingRef}
                    tabIndex={-1}
                    className="m-0 font-roobert text-(length:--text-subheading) font-medium text-ink-black outline-none"
                  >
                    {tr(t.sectionTitle, { section: step.suggestion.section })}
                  </h3>
                  <div className="grid gap-4 rounded-lg bg-sky-wash-soft p-12">
                    <span className="text-(length:--text-label) font-semibold tracking-[0.08em] text-cyan-text-strong uppercase">
                      {t.suggestion}
                    </span>
                    <p className="m-0 text-[15px] leading-[1.6] text-ink-black">
                      {step.suggestion.suggested_text}
                    </p>
                  </div>
                  <div className="grid gap-4">
                    <span className="text-[13px] font-medium text-ink-black">{t.why}</span>
                    <p className="m-0 text-[14px] leading-[1.6] text-warm-gray">
                      {plainRationale(step.suggestion.rationale)}
                    </p>
                  </div>
                  <p className="m-0 rounded-lg bg-teal-wash px-12 py-8 text-[13px] leading-[1.6] text-teal-text">
                    {t.recruiters}
                  </p>
                </>
              ) : (
                <>
                  <h3
                    ref={headingRef}
                    tabIndex={-1}
                    className="m-0 font-roobert text-(length:--text-subheading) font-medium text-ink-black outline-none"
                  >
                    {t.skillsTitle}
                  </h3>
                  <p className="m-0 text-[14px] leading-[1.6] text-warm-gray">
                    {tr(t.skillsCopy, { count: String(step.names.length) })}
                  </p>
                  <ul className="m-0 flex list-none flex-wrap gap-8 p-0">
                    {step.names.slice(0, skillsShown).map((name) => (
                      <li
                        key={name}
                        className="rounded-full bg-sky-wash-soft px-12 py-4 text-[13px] font-medium text-cyan-text-strong"
                      >
                        {name}
                      </li>
                    ))}
                    {step.names.length > skillsShown ? (
                      <li className="rounded-full bg-stone-canvas px-12 py-4 text-[13px] text-warm-gray">
                        +{step.names.length - skillsShown}
                      </li>
                    ) : null}
                  </ul>
                  <p className="m-0 text-[13px] leading-[1.6] text-warm-gray">{t.skillsAction}</p>
                  <p className="m-0 rounded-lg bg-teal-wash px-12 py-8 text-[13px] leading-[1.6] text-teal-text">
                    {t.recruiters}
                  </p>
                </>
              )}
            </div>

            <div className="flex flex-wrap justify-between gap-8">
              <button
                type="button"
                className={cx(ghostButton, index === 0 && 'invisible')}
                onClick={() => setIndex((current) => Math.max(current - 1, 0))}
              >
                {t.back}
              </button>
              <button
                type="button"
                className={primaryButton}
                onClick={() => (last ? close() : setIndex((current) => current + 1))}
              >
                {last ? t.finish : t.next}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
