'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { ComponentType, ReactNode } from 'react';
import { useEffect, useRef } from 'react';

import { type IconProps, ShieldIcon, SignalIcon, UserIcon } from '@/components/icons';
import { LanguageSelect } from '@/components/language-select';
import { cx, primaryButton } from '@/components/ui';
import { useSession } from '@/lib/auth/useSession';
import { type Locale, labels } from '@/lib/i18n';

// The landing's own recipes (the old .landing-copy p, .nav-link and
// .feature-section rules, with the same values).
const copyParagraph = 'mx-0 mt-16 mb-0 text-(length:--text-body-lg) leading-[1.64] text-warm-gray';
// Text-only entry links: the pill pair read as merged in the header.
const navLink =
  'p-8 text-[14px] text-ink-black no-underline hover:text-ink-black hover:underline hover:underline-offset-4';
const featureSection = 'reveal w-full bg-sky-wash-soft px-24 py-48';

function FeatureCard({
  icon: CardIcon,
  title,
  children,
}: {
  icon: ComponentType<IconProps>;
  title: string;
  children: ReactNode;
}) {
  return (
    <article className="grid gap-8 rounded-lg border border-stone-border bg-pure-white p-24 text-ink-black">
      <CardIcon className="mb-4 text-cyan-text" />
      <h2 className="m-0 font-roobert text-(length:--text-subheading) leading-[1.2] font-regular">
        {title}
      </h2>
      <p className="m-0 text-(length:--text-body-lg) leading-[1.64] text-warm-gray">{children}</p>
    </article>
  );
}

// Reveals a section when it scrolls into view. The hidden state only applies
// while `js` is set on <html> (app/template.tsx) plus the IntersectionObserver
// fires, so content stays readable without JavaScript and for reduced-motion
// users. Missing-observer environments degrade to the visible state.
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    if (typeof IntersectionObserver === 'undefined') {
      node.classList.add('is-visible');
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return ref;
}

// The shared landing: one implementation serves both locale trees, every
// string reads the json dictionaries and the routes hang from the tree's
// base prefix (the marketing copy keeps its authored per-locale voice from
// the dictionaries, not a literal translation). The document language is
// set on every mount so a client-side locale switch never leaves the html
// tag in the previous tree's language; the root layout still exports the
// static 'en' - the [locale] restructure closes that gap.
export function LandingView({ locale }: { locale: Locale }) {
  const t = labels(locale);
  const base = locale === 'es' ? '/es' : '';
  const { session, isHydrated } = useSession();
  const isSignedIn = isHydrated && Boolean(session);

  const heroRef = useReveal<HTMLElement>();
  const featuresRef = useReveal<HTMLElement>();
  const trustRef = useReveal<HTMLElement>();
  const finalRef = useReveal<HTMLElement>();

  useEffect(() => {
    // The root layout owns the html tag and stays static; the landing
    // patches it to the tree's locale until the [locale] restructure.
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-stone-border">
        <div className="mx-auto flex max-w-page items-center justify-between gap-16 px-24 py-16">
          <Link
            className="inline-flex items-center gap-8 rounded-md no-underline"
            href={`${base}/`}
            aria-label={t.landing.brandAria}
          >
            {/* The signal glyph on the signal cyan, with ink contrast (7.44:1). */}
            <span
              className="inline-flex size-[28px] items-center justify-center rounded-md bg-cyan-signal text-ink-black [&_svg]:size-[16px]"
              aria-hidden="true"
            >
              <SignalIcon />
            </span>
            <span className="font-roobert text-[19px] font-medium tracking-[-0.3px] text-ink-black">
              Professional Profile
            </span>
          </Link>
          <nav
            className="flex items-center gap-16 max-sm:w-full max-sm:flex-wrap"
            aria-label={t.landing.navAria}
          >
            {isSignedIn ? (
              <Link className={navLink} href={`${base}/app/`}>
                {t.landing.openProfile}
              </Link>
            ) : (
              <>
                <Link className={cx(navLink, 'text-warm-gray')} href={`${base}/login/`}>
                  {t.landing.navSignIn}
                </Link>
                <Link className={cx(navLink, 'text-ink-black')} href={`${base}/register/`}>
                  {t.landing.navCreateAccount}
                </Link>
              </>
            )}
            <LanguageSelect current={locale} path={`${base}/`} />
          </nav>
        </div>
      </header>

      <main>
        <section
          className="reveal mx-auto grid w-full max-w-page grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)] items-center gap-48 px-24 py-64 max-md:grid-cols-1 max-md:gap-32"
          ref={heroRef}
          aria-labelledby="landing-title"
        >
          <div>
            {/* The hero eyebrow reads at the paragraph size: the old .landing-copy p
                rule outranked .eyebrow here, and the page keeps that look. */}
            <p className={cx(copyParagraph, 'tracking-[0.08em] uppercase')}>
              {t.landing.heroEyebrow}
            </p>
            <h1
              id="landing-title"
              className="m-0 font-roobert text-display font-regular max-md:text-(length:--text-heading-sm) max-md:tracking-[-0.8px]"
            >
              {t.landing.heroTitle}
            </h1>
            <p className={copyParagraph}>{t.landing.heroP1}</p>
            <p className={copyParagraph}>{t.landing.heroP2}</p>
          </div>

          <div>
            <Image
              className="block aspect-[3/2] max-h-[440px] w-full rounded-2xl border border-stone-border object-cover shadow-md"
              src="https://images.pexels.com/photos/3931641/pexels-photo-3931641.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&dpr=1"
              alt={t.landing.heroAlt}
              width={1200}
              height={800}
              priority
            />
          </div>
        </section>

        <section className={featureSection} ref={featuresRef} aria-label={t.landing.featuresAria}>
          <div className="mx-auto grid max-w-page grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-16">
            <FeatureCard icon={UserIcon} title={t.landing.feature1Title}>
              {t.landing.feature1Copy}
            </FeatureCard>
            <FeatureCard icon={ShieldIcon} title={t.landing.feature2Title}>
              {t.landing.feature2Copy}
            </FeatureCard>
            <FeatureCard icon={SignalIcon} title={t.landing.feature3Title}>
              {t.landing.feature3Copy}
            </FeatureCard>
          </div>
        </section>

        <section
          className="reveal mx-auto mt-64 w-full max-w-page px-24"
          ref={trustRef}
          aria-label={t.landing.trustAria}
        >
          <ul className="m-0 grid list-none grid-cols-3 gap-24 rounded-2xl border border-stone-border bg-pure-white p-24 shadow-subtle max-md:grid-cols-1">
            {(
              [
                [t.landing.trust1Title, t.landing.trust1Copy],
                [t.landing.trust2Title, t.landing.trust2Copy],
                [t.landing.trust3Title, t.landing.trust3Copy],
              ] as const
            ).map(([title, copy]) => (
              <li key={title} className="grid gap-4">
                <strong className="font-medium text-ink-black">{title}</strong>
                <span className="text-[14px] leading-[1.6] text-warm-gray">{copy}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={featureSection} aria-label={t.landing.growthAria}>
          <div>
            <h2>{t.landing.growthTitle}</h2>
            <p className={copyParagraph}>{t.landing.growthP1}</p>
            <p className={copyParagraph}>{t.landing.growthP2}</p>
          </div>
        </section>

        <section
          className="reveal mx-auto my-64 w-full max-w-[760px] px-24"
          ref={finalRef}
          aria-labelledby="closing-title"
        >
          <div className="grid justify-items-center gap-16 rounded-2xl bg-soot px-32 py-40">
            <h2
              id="closing-title"
              className="m-0 font-roobert text-(length:--text-subheading) leading-[1.2] font-regular text-pure-white"
            >
              {t.landing.closingTitle}
            </h2>
            <p className="text-[rgba(255,255,255,0.8)]">
              {isSignedIn ? t.landing.closingSignInCopy : t.landing.closingGuestCopy}
            </p>
            <div className="flex w-full flex-wrap justify-center gap-8 max-sm:flex-col max-sm:items-stretch">
              {isSignedIn ? (
                <Link className={cx(primaryButton, 'max-sm:w-full')} href={`${base}/app/`}>
                  {t.landing.openProfile}
                </Link>
              ) : (
                <Link className={cx(primaryButton, 'max-sm:w-full')} href={`${base}/register/`}>
                  {t.landing.closingGuestCta}
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-auto border-t border-stone-border p-24">
        <p className="m-0 text-center text-[12px] text-warm-gray">{t.landing.footer}</p>
      </footer>
    </div>
  );
}
