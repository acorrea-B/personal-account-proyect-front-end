'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  type TourChoice,
  type TourChoices,
  readTourChoices,
  saveTourChoices,
} from '@/lib/tour-choices';

import { cx, ghostButton, primaryButton } from '@/components/ui';
import { fetchHarnessOutputs } from '@/lib/api/harness';
import { fetchSuggestionsSummary } from '@/lib/api/suggestions';
import { type Labels, type Locale, labels, tr } from '@/lib/i18n';
import type { CvSuggestion, VerificationStatus } from '@/lib/schemas/harness';
import { announceSuggestionsChanged, markCvRevisionSeen } from '@/lib/suggestions-signal';

type Step = { kind: 'suggestion'; suggestion: CvSuggestion } | { kind: 'summary' };

type TourData = {
  cvSuggestions: CvSuggestion[] | null;
  // Whether any CV improvement still waits for apply or skip (read once per
  // visit, so the tour does not shrink mid-walk).
  pendingCv: boolean;
  cvRevision: string | null;
};

// Backed advice first; what verification blocked is not advice, so it never
// becomes a step (the AI suggestions card lists it as what is missing).
const order: VerificationStatus[] = ['AllSupported', 'Mixed', 'AllInferred'];

const plainRationale = (rationale: string) => rationale.replace(/^\[inferred\]\s*/, '');

// The language the harness wrote a suggestion in, as a BCP 47 tag; null
// when it is not said or not known (nothing is assumed).
export function modelLang(language: string | null | undefined): string | undefined {
  const known: Record<string, string> = { english: 'en', spanish: 'es', español: 'es' };
  return language ? known[language.trim().toLowerCase()] : undefined;
}

// The model names CV sections in its own words ("Summary", "Core Skills");
// the known ones are shown with the CV section labels of the UI language,
// any other as written.
const sectionKeys: Record<string, keyof Labels['cvSections']> = {
  summary: 'summary',
  'professional summary': 'summary',
  profile: 'summary',
  experience: 'experience',
  'work experience': 'experience',
  education: 'education',
  skills: 'skills',
  'core skills': 'skills',
  'technical skills': 'skills',
  projects: 'projects',
  links: 'links',
  certifications: 'certifications',
  languages: 'languages',
};

export function sectionName(locale: Locale, section: string): string {
  const key = sectionKeys[section.trim().toLowerCase()];
  return key ? labels(locale).cvSections[key] : section;
}

// Each step keeps what verification said: backed, partly backed or with no
// evidence, so a claim the CV does not back never reads as settled advice.
const statusTone: Record<VerificationStatus, string> = {
  AllSupported: 'bg-teal-wash text-teal-text',
  Mixed: 'bg-sky-wash-soft text-cyan-text-strong',
  AllInferred: 'bg-stone-canvas text-warm-gray',
  Blocked: 'bg-stone-canvas text-warm-gray',
};

function statusLabel(locale: Locale, status: VerificationStatus): string {
  const a = labels(locale).ai;
  return {
    AllSupported: a.statusSupported,
    Mixed: a.statusPartial,
    AllInferred: a.statusInferred,
    Blocked: a.statusInferred,
  }[status];
}

// The steps of the tour: one per CV suggestion worth acting on, then the
// summary that gathers the chosen ones for the next CV version.
export function tourSteps(cvSuggestions: CvSuggestion[] | null): Step[] {
  const advice = (cvSuggestions ?? [])
    .filter((suggestion) => suggestion.verification_status !== 'Blocked')
    .sort(
      (left, right) =>
        order.indexOf(left.verification_status) - order.indexOf(right.verification_status),
    )
    .map((suggestion): Step => ({ kind: 'suggestion', suggestion }));
  return advice.length ? [...advice, { kind: 'summary' }] : [];
}

// The CV improvements tour: a call to action on the CV page while the
// newest harness run has CV advice the user has not decided, and a
// step-by-step window with a progress indicator. Only finishing walks the
// CV revision (closing just closes); the CV steps return while any
// improvement waits for apply or skip.
// The window is a modal: rendered outside the page (a portal), focus stays
// inside and the page behind is inert while it is open.
export function SuggestionsTour({ accessToken, locale }: { accessToken: string; locale: Locale }) {
  const t = labels(locale).tour;
  const [data, setData] = useState<TourData | null>(null);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [index, setIndex] = useState(0);
  const [choices, setChoices] = useState<TourChoices>({});
  // Opened from "review your chosen improvements": the CV steps only.
  const [reviewing, setReviewing] = useState(false);
  const startRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;

  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current) {
      return;
    }
    loaded.current = true;
    const token = tokenRef.current;
    void Promise.all([fetchHarnessOutputs(token), fetchSuggestionsSummary(token)])
      .then(([outputs, summary]) => {
        const cvRevision = summary.cv.revision_id;
        // The CV steps are offered while any improvement waits for a
        // decision (apply or skip); a closed tour decided nothing.
        const stored = readTourChoices(cvRevision);
        const undecided = tourSteps(outputs.cvSuggestions).some(
          (step) => step.kind === 'suggestion' && !stored[step.suggestion.suggestion_id],
        );
        setChoices(stored);
        setData({
          cvSuggestions: outputs.cvSuggestions,
          pendingCv: undecided,
          cvRevision,
        });
      })
      // The tour is an invitation: if it cannot load, the page stays as is.
      .catch(() => setData({ cvSuggestions: null, pendingCv: false, cvRevision: null }));
  }, []);

  // Closing only closes: nothing is decided, the invitation stays.
  const close = useCallback(() => {
    setOpen(false);
    setReviewing(false);
    startRef.current?.focus();
  }, []);

  // Finishing walks the revision: the invitation goes and the menu marker
  // stops counting it.
  const finish = useCallback(() => {
    setOpen(false);
    setReviewing(false);
    setDismissed(true);
    setData((current) => (current ? { ...current, pendingCv: false } : current));
    if (data?.cvRevision) {
      markCvRevisionSeen(data.cvRevision);
      // The menu marker stops counting the walked revision.
      announceSuggestionsChanged();
    }
    startRef.current?.focus();
  }, [data]);

  const steps = data && (data.pendingCv || reviewing) ? tourSteps(data.cvSuggestions) : [];
  // The decided improvements can always be revisited from the CV page.
  const advice = tourSteps(data?.cvSuggestions ?? null).filter(
    (item) => item.kind === 'suggestion',
  );
  const decided = advice.filter(
    (item) => item.kind === 'suggestion' && choices[item.suggestion.suggestion_id],
  ).length;
  const appliedCount = advice.filter(
    (item) => item.kind === 'suggestion' && choices[item.suggestion.suggestion_id] === 'apply',
  ).length;

  // Records the choice for a suggestion (kept for the next CV version) and
  // moves on.
  const choose = (suggestionId: string, choice: TourChoice) => {
    const next = { ...choices, [suggestionId]: choice };
    setChoices(next);
    saveTourChoices(data?.cvRevision ?? null, next);
    setIndex((current) => Math.min(current, steps.length - 1) + 1);
  };
  const applied = (data?.cvSuggestions ?? []).filter(
    (suggestion) => choices[suggestion.suggestion_id] === 'apply',
  );
  // The modal is showing only while it has a step; if none is left it
  // closes and releases the page.
  const showing = open && steps.length > 0;
  useEffect(() => {
    if (open && !steps.length) {
      setOpen(false);
    }
  }, [open, steps.length]);

  // Focus moves to each step's heading and stays inside the window.
  useEffect(() => {
    if (!showing) {
      return;
    }
    headingRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) {
        return;
      }
      const focusable = [
        ...dialogRef.current.querySelectorAll<HTMLElement>('button, [tabindex="-1"]'),
      ].filter(
        (element) => !element.hasAttribute('disabled') && !element.classList.contains('invisible'),
      );
      const buttons = focusable.filter((element) => element.tagName === 'BUTTON');
      if (!buttons.length) {
        return;
      }
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialogRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialogRef.current.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showing, index, close]);

  // The page behind the modal is inert while it is showing.
  useEffect(() => {
    if (!showing) {
      return;
    }
    const overlay = overlayRef.current;
    const background = [...document.body.children].filter(
      (element) => element !== overlay && !element.contains(overlay),
    );
    background.forEach((element) => element.setAttribute('inert', ''));
    return () => background.forEach((element) => element.removeAttribute('inert'));
  }, [showing]);

  const inviting = !dismissed && Boolean(data?.pendingCv);
  const reviewable = !inviting && decided > 0;
  if (!open && !inviting && !reviewable) {
    return null;
  }

  const total = Math.max(steps.length, 1);
  const position = Math.min(index, total - 1);
  const step = steps[position] ?? steps[0];
  const last = position === total - 1;
  const progress = tr(t.progress, { step: String(position + 1), total: String(total) });

  return (
    <>
      {reviewable ? (
        <p className="m-0 flex flex-wrap items-center gap-8 text-[14px] text-warm-gray">
          {appliedCount ? tr(t.summaryCount, { count: String(appliedCount) }) : null}
          <button
            ref={startRef}
            type="button"
            className={ghostButton}
            onClick={() => {
              setReviewing(true);
              setIndex(0);
              setOpen(true);
            }}
          >
            {t.review}
          </button>
        </p>
      ) : null}
      {inviting ? (
        <section
          aria-label={t.bannerTitle}
          className="grid animate-content-resolve gap-12 rounded-2xl border border-sky-wash bg-sky-wash-soft p-24 motion-reduce:animate-none sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
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
                setReviewing(false);
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
      ) : null}

      {open && steps.length
        ? createPortal(
            <div
              ref={overlayRef}
              className="fixed inset-0 z-50 grid animate-overlay-in place-items-center bg-[rgba(28,25,23,0.45)] p-16 motion-reduce:animate-none"
            >
              <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label={t.dialogAria}
                className="grid max-h-[calc(100dvh-32px)] w-full max-w-[560px] animate-dialog-in grid-rows-[auto_minmax(0,1fr)_auto] gap-16 rounded-2xl bg-pure-white p-24 shadow-xl motion-reduce:animate-none"
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
                    aria-valuenow={position + 1}
                    className="h-[6px] overflow-hidden rounded-full bg-sky-wash-soft"
                  >
                    <div
                      className="h-full rounded-full bg-cyan-text-strong transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
                      style={{ width: `${((position + 1) / total) * 100}%` }}
                    />
                  </div>
                </div>

                <div
                  key={position}
                  className="grid min-h-0 animate-step-in content-start gap-12 overflow-y-auto motion-reduce:animate-none"
                >
                  {step.kind === 'suggestion' ? (
                    <>
                      <h3
                        ref={headingRef}
                        tabIndex={-1}
                        className="m-0 font-roobert text-(length:--text-subheading) font-medium text-ink-black outline-none"
                      >
                        {tr(t.sectionTitle, {
                          section: sectionName(locale, step.suggestion.section),
                        })}
                      </h3>
                      <span
                        className={cx(
                          'justify-self-start rounded-full px-8 py-4 text-[12px] font-medium',
                          statusTone[step.suggestion.verification_status],
                        )}
                      >
                        {statusLabel(locale, step.suggestion.verification_status)}
                      </span>
                      <div className="grid gap-4 rounded-lg bg-sky-wash-soft p-12">
                        <span className="text-(length:--text-label) font-semibold tracking-[0.08em] text-cyan-text-strong uppercase">
                          {t.suggestion}
                        </span>
                        <p
                          lang={modelLang(step.suggestion.language)}
                          className="m-0 text-[15px] leading-[1.6] text-ink-black"
                        >
                          {step.suggestion.suggested_text}
                        </p>
                      </div>
                      <div className="grid gap-4">
                        <h4 className="m-0 text-[13px] font-semibold text-ink-black">{t.why}</h4>
                        <p
                          lang={modelLang(step.suggestion.language)}
                          className="m-0 text-[14px] leading-[1.6] text-warm-gray"
                        >
                          {plainRationale(step.suggestion.rationale)}
                        </p>
                      </div>
                      {modelLang(step.suggestion.language) &&
                      modelLang(step.suggestion.language) !== locale ? (
                        <p className="m-0 text-[12px] leading-[1.5] text-warm-gray">
                          {t.languageNote}
                        </p>
                      ) : null}
                      <p className="m-0 rounded-lg bg-teal-wash px-12 py-8 text-[13px] leading-[1.6] text-teal-text">
                        {t.recruiters}
                      </p>
                      {choices[step.suggestion.suggestion_id] ? (
                        <p className="m-0 text-[12px] font-medium text-cyan-text-strong">
                          {choices[step.suggestion.suggestion_id] === 'apply'
                            ? t.applied
                            : t.skipped}
                        </p>
                      ) : null}
                    </>
                  ) : step.kind === 'summary' ? (
                    <>
                      <h3
                        ref={headingRef}
                        tabIndex={-1}
                        className="m-0 font-roobert text-(length:--text-subheading) font-medium text-ink-black outline-none"
                      >
                        {t.summaryTitle}
                      </h3>
                      {applied.length ? (
                        <>
                          <p className="m-0 text-[13px] font-medium text-teal-text">
                            {tr(t.summaryCount, { count: String(applied.length) })}
                          </p>
                          <ol className="m-0 grid list-none gap-8 p-0">
                            {applied.map((suggestion) => (
                              <li
                                key={suggestion.suggestion_id}
                                className="grid gap-2 rounded-lg border border-stone-border p-12"
                              >
                                <span className="text-(length:--text-label) font-semibold tracking-[0.08em] text-warm-gray uppercase">
                                  {sectionName(locale, suggestion.section)}
                                </span>
                                <span
                                  lang={modelLang(suggestion.language)}
                                  className="text-[14px] leading-[1.5] text-ink-black"
                                >
                                  {suggestion.suggested_text}
                                </span>
                              </li>
                            ))}
                          </ol>
                        </>
                      ) : (
                        <p className="m-0 text-[14px] leading-[1.6] text-warm-gray">
                          {t.summaryNone}
                        </p>
                      )}
                      <p className="m-0 rounded-lg bg-sky-wash-soft px-12 py-8 text-[13px] leading-[1.6] text-cyan-text-strong">
                        {t.atsNote}
                      </p>
                      <div className="grid justify-items-start gap-4">
                        <span className="flex flex-wrap items-center gap-8">
                          <button
                            type="button"
                            disabled
                            aria-describedby="tour-generate-soon"
                            className={cx(primaryButton, 'cursor-not-allowed opacity-60')}
                          >
                            {t.generate}
                          </button>
                          <span className="rounded-full bg-sky-wash-soft px-8 py-4 text-[12px] font-medium text-cyan-text-strong">
                            {t.generateBadge}
                          </span>
                        </span>
                        <p
                          id="tour-generate-soon"
                          className="m-0 text-[12px] leading-[1.5] text-warm-gray"
                        >
                          {t.generateSoon}
                        </p>
                      </div>
                    </>
                  ) : null}
                </div>

                <div className="flex flex-wrap justify-between gap-8">
                  <button
                    type="button"
                    className={cx(ghostButton, position === 0 && 'invisible')}
                    onClick={() => setIndex(Math.max(position - 1, 0))}
                  >
                    {t.back}
                  </button>
                  {step.kind === 'suggestion' ? (
                    <span className="flex flex-wrap gap-8">
                      <button
                        type="button"
                        className={ghostButton}
                        aria-pressed={choices[step.suggestion.suggestion_id] === 'skip'}
                        onClick={() => choose(step.suggestion.suggestion_id, 'skip')}
                      >
                        {t.skip}
                      </button>
                      <button
                        type="button"
                        className={primaryButton}
                        aria-pressed={choices[step.suggestion.suggestion_id] === 'apply'}
                        onClick={() => choose(step.suggestion.suggestion_id, 'apply')}
                      >
                        {t.apply}
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className={primaryButton}
                      onClick={() => (last ? finish() : setIndex(position + 1))}
                    >
                      {last ? t.finish : t.next}
                    </button>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
