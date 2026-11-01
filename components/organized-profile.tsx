'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Skeleton } from '@/components/skeleton';
import { workspacePanel } from '@/components/ui';
import { fetchHarnessOutputs } from '@/lib/api/harness';
import { type Locale, labels } from '@/lib/i18n';
import type { CanonicalProfile } from '@/lib/schemas/harness';

type ViewState = { kind: 'loading' } | { kind: 'ready'; profile: CanonicalProfile | null };

// The reading writes open-ended roles as "present"; the view says it in
// the user's language.
const isPresent = (end: string | null | undefined) =>
  !end || ['present', 'actualidad', 'actual', 'presente'].includes(end.trim().toLowerCase());

// The profile as the harness organized it: what the user typed as one text,
// back as experience (dates, scope, impact, technologies), education and
// skills, each in its place. Read-only; the form beside it stays the way to
// edit. Shows nothing until the harness has read the CV.
export function OrganizedProfile({ accessToken, locale }: { accessToken: string; locale: Locale }) {
  const t = labels(locale).organized;
  const [state, setState] = useState<ViewState>({ kind: 'loading' });
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;

  const load = useCallback(async () => {
    try {
      const outputs = await fetchHarnessOutputs(tokenRef.current);
      setState({ kind: 'ready', profile: outputs.profile ?? null });
    } catch {
      // An organized view that cannot load leaves the profile as it was.
      setState({ kind: 'ready', profile: null });
    }
  }, []);

  const loaded = useRef(false);
  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      void load();
    }
  }, [load]);

  if (state.kind === 'loading') {
    return (
      <section className={workspacePanel} aria-label={t.loadingAria}>
        <Skeleton width="40%" height={18} />
        <Skeleton width="100%" height={14} />
        <Skeleton width="85%" height={14} />
      </section>
    );
  }

  const profile = state.profile;
  if (
    !profile ||
    (!profile.experience_items.length &&
      !profile.education_items.length &&
      !profile.canonical_skills.length)
  ) {
    return null;
  }

  return (
    <section
      aria-label={t.title}
      className="grid animate-content-resolve gap-24 rounded-2xl border border-stone-border bg-pure-white p-24 motion-reduce:animate-none"
    >
      <div className="grid gap-4">
        <h2 className="m-0 font-roobert text-title-sm font-medium text-ink-black">{t.title}</h2>
        <p className="m-0 text-[14px] leading-[1.6] text-warm-gray">{t.intro}</p>
      </div>

      {profile.experience_items.length ? (
        <div className="grid gap-12">
          <h3 className="m-0 text-(length:--text-label) font-semibold tracking-[0.08em] text-cyan-text-strong uppercase">
            {t.experience}
          </h3>
          <ol className="m-0 grid list-none gap-0 p-0">
            {profile.experience_items.map((item, index) => (
              <li
                key={`${item.title}-${item.start ?? index}`}
                className="relative grid grid-cols-[16px_minmax(0,1fr)] gap-12 pb-16 last:pb-0"
              >
                {index < profile.experience_items.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="absolute top-[18px] bottom-0 left-[7px] w-[2px] bg-sky-wash-soft"
                  />
                ) : null}
                <span
                  aria-hidden="true"
                  className="relative mt-[6px] size-[16px] rounded-full border-[3px] border-pure-white bg-cyan-text-strong shadow-[0_0_0_2px_var(--color-sky-wash-soft)]"
                />
                <div className="grid gap-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-8">
                    <span className="text-[15px] font-medium text-ink-black">{item.title}</span>
                    {item.start ? (
                      <span className="text-[12px] text-warm-gray tabular-nums">
                        {item.start} – {isPresent(item.end) ? t.present : item.end}
                      </span>
                    ) : null}
                  </div>
                  {item.scope ? (
                    <p className="m-0 text-[14px] leading-[1.6] text-soot">{item.scope}</p>
                  ) : null}
                  {item.metrics ? (
                    // The figure is the CV's own words, shown as a quote next to
                    // a translated label rather than read as one mixed sentence.
                    <p className="m-0 inline-flex flex-wrap items-baseline gap-x-8 gap-y-2 justify-self-start rounded-lg bg-teal-wash px-8 py-4 text-[13px] text-teal-text">
                      <span className="text-(length:--text-label) font-semibold tracking-[0.08em] uppercase">
                        {t.impact}
                      </span>
                      <q className="[overflow-wrap:anywhere]">{item.metrics}</q>
                    </p>
                  ) : null}
                  {item.technologies.length ? (
                    <ul className="m-0 flex list-none flex-wrap gap-4 p-0">
                      {[...new Set(item.technologies)].map((technology) => (
                        <li
                          key={technology}
                          className="rounded-full bg-stone-canvas px-8 py-[2px] text-[12px] text-warm-gray"
                        >
                          {technology}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <div className="grid gap-24 sm:grid-cols-2">
        {profile.education_items.length ? (
          <div className="grid content-start gap-8">
            <h3 className="m-0 text-(length:--text-label) font-semibold tracking-[0.08em] text-cyan-text-strong uppercase">
              {t.education}
            </h3>
            <ul className="m-0 grid list-none gap-8 p-0">
              {profile.education_items.map((item, index) => (
                <li key={`${item}-${index}`} className="text-[14px] leading-[1.6] text-soot">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {profile.canonical_skills.length ? (
          <div className="grid content-start gap-8">
            <h3 className="m-0 text-(length:--text-label) font-semibold tracking-[0.08em] text-cyan-text-strong uppercase">
              {t.skills}
            </h3>
            <ul className="m-0 flex list-none flex-wrap gap-8 p-0">
              {profile.canonical_skills.map((skill, index) => (
                <li
                  key={`${skill.display_name}-${index}`}
                  className="rounded-full bg-sky-wash-soft px-12 py-4 text-[13px] font-medium text-cyan-text-strong"
                >
                  {skill.display_name}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
