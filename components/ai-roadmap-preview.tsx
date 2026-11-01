'use client';

import { ghostButton } from '@/components/ui';
import { type Locale, labels } from '@/lib/i18n';

// The AI roadmap path of the evolution page, as a preview: beta 1.1 builds
// the roadmap from the harness suggestions; until then the steps are fixed
// examples, labelled as such, so nothing reads as advice from the profile.
export function AiRoadmapPreview({ locale, onBack }: { locale: Locale; onBack: () => void }) {
  const t = labels(locale).evolution;
  const steps = [
    { title: t.roadmapStep1Title, copy: t.roadmapStep1Copy, when: t.roadmapStep1When },
    { title: t.roadmapStep2Title, copy: t.roadmapStep2Copy, when: t.roadmapStep2When },
    { title: t.roadmapStep3Title, copy: t.roadmapStep3Copy, when: t.roadmapStep3When },
    { title: t.roadmapStep4Title, copy: t.roadmapStep4Copy, when: t.roadmapStep4When },
  ];
  return (
    <div className="grid animate-content-resolve gap-16 motion-reduce:animate-none">
      <div className="flex flex-wrap items-center gap-8">
        <h3 className="m-0 font-roobert text-(length:--text-subheading) font-medium text-ink-black">
          {t.roadmapTitle}
        </h3>
        <span className="rounded-full bg-sky-wash-soft px-12 py-4 text-[12px] font-medium text-cyan-text-strong">
          {t.roadmapBadge}
        </span>
      </div>
      <p className="m-0 rounded-lg bg-stone-canvas px-12 py-8 text-[13px] leading-[1.6] text-warm-gray">
        {t.roadmapNote}
      </p>
      <ol className="m-0 grid list-none gap-0 p-0" aria-label={t.roadmapTitle}>
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="relative grid grid-cols-[24px_minmax(0,1fr)] gap-12 pb-16"
          >
            {index < steps.length - 1 ? (
              <span
                aria-hidden="true"
                className="absolute top-[24px] bottom-0 left-[11px] w-[2px] bg-sky-wash-soft"
              />
            ) : null}
            <span
              aria-hidden="true"
              className="relative grid size-[24px] place-items-center rounded-full bg-cyan-text-strong text-[12px] font-semibold text-pure-white"
            >
              {index + 1}
            </span>
            <div className="grid gap-4">
              <div className="flex flex-wrap items-baseline justify-between gap-8">
                <span className="text-[15px] font-medium text-ink-black">{step.title}</span>
                <span className="text-[12px] text-warm-gray">{step.when}</span>
              </div>
              <p className="m-0 text-[14px] leading-[1.6] text-warm-gray">{step.copy}</p>
            </div>
          </li>
        ))}
      </ol>
      <div>
        <button type="button" className={ghostButton} onClick={onBack}>
          {t.roadmapBack}
        </button>
      </div>
    </div>
  );
}
