'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef } from 'react';

import { ShieldIcon, SignalIcon, UserIcon } from '@/components/icons';
import { LanguageSelect } from '@/components/language-select';
import { useSession } from '@/lib/auth/useSession';
import { type Locale, labels } from '@/lib/i18n';

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
    <div className="landing-page">
      <header className="site-header">
        <div className="site-header-inner">
          <Link className="site-brand" href={`${base}/`} aria-label={t.landing.brandAria}>
            <span className="site-brand-mark" aria-hidden="true">
              <SignalIcon />
            </span>
            <span className="site-brand-word">Professional Profile</span>
          </Link>
          <nav className="site-nav" aria-label={t.landing.navAria}>
            {isSignedIn ? (
              <Link className="nav-link" href={`${base}/app/`}>
                {t.landing.openProfile}
              </Link>
            ) : (
              <>
                <Link className="nav-link nav-link--quiet" href={`${base}/login/`}>
                  {t.landing.navSignIn}
                </Link>
                <Link className="nav-link" href={`${base}/register/`}>
                  {t.landing.navCreateAccount}
                </Link>
              </>
            )}
            <LanguageSelect current={locale} path={`${base}/`} />
          </nav>
        </div>
      </header>

      <main>
        <section className="landing-hero reveal" ref={heroRef} aria-labelledby="landing-title">
          <div className="landing-copy">
            <p className="eyebrow">{t.landing.heroEyebrow}</p>
            <h1 id="landing-title">{t.landing.heroTitle}</h1>
            <p>{t.landing.heroP1}</p>
            <p>{t.landing.heroP2}</p>
          </div>

          <div className="hero-figure">
            <Image
              className="hero-image"
              src="https://images.pexels.com/photos/3931641/pexels-photo-3931641.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&dpr=1"
              alt={t.landing.heroAlt}
              width={1200}
              height={800}
              priority
            />
          </div>
        </section>

        <section
          className="feature-section reveal"
          ref={featuresRef}
          aria-label={t.landing.featuresAria}
        >
          <div className="feature-grid">
            <article className="feature-card">
              <UserIcon />
              <h2>{t.landing.feature1Title}</h2>
              <p className="auth-subtitle">{t.landing.feature1Copy}</p>
            </article>
            <article className="feature-card">
              <ShieldIcon />
              <h2>{t.landing.feature2Title}</h2>
              <p className="auth-subtitle">{t.landing.feature2Copy}</p>
            </article>
            <article className="feature-card">
              <SignalIcon />
              <h2>{t.landing.feature3Title}</h2>
              <p className="auth-subtitle">{t.landing.feature3Copy}</p>
            </article>
          </div>
        </section>

        <section className="trust-strip reveal" ref={trustRef} aria-label={t.landing.trustAria}>
          <ul>
            <li>
              <strong>{t.landing.trust1Title}</strong>
              <span>{t.landing.trust1Copy}</span>
            </li>
            <li>
              <strong>{t.landing.trust2Title}</strong>
              <span>{t.landing.trust2Copy}</span>
            </li>
            <li>
              <strong>{t.landing.trust3Title}</strong>
              <span>{t.landing.trust3Copy}</span>
            </li>
          </ul>
        </section>

        <section className="feature-section reveal" aria-label={t.landing.growthAria}>
          <div className="landing-copy">
            <h2>{t.landing.growthTitle}</h2>
            <p>{t.landing.growthP1}</p>
            <p>{t.landing.growthP2}</p>
          </div>
        </section>

        <section className="final-action reveal" ref={finalRef} aria-labelledby="closing-title">
          <div className="final-action-panel">
            <h2 id="closing-title">{t.landing.closingTitle}</h2>
            <p>{isSignedIn ? t.landing.closingSignInCopy : t.landing.closingGuestCopy}</p>
            <div className="landing-actions">
              {isSignedIn ? (
                <Link className="button button-primary" href={`${base}/app/`}>
                  {t.landing.openProfile}
                </Link>
              ) : (
                <Link className="button button-primary" href={`${base}/register/`}>
                  {t.landing.closingGuestCta}
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <p>{t.landing.footer}</p>
      </footer>
    </div>
  );
}
