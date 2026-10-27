'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef } from 'react';

import { ShieldIcon, SignalIcon, UserIcon } from '../components/icons';
import { useSession } from '@/lib/auth/useSession';

// Reveals a section when it scrolls into view. The hidden state only applies
// while `js` is set on <html> (app/template.tsx) plus the IntersectionObserver
// fires, so content stays readable without JavaScript and for reduced-motion
// users.
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

export default function LandingPage() {
  const { session, isHydrated } = useSession();
  const isSignedIn = isHydrated && Boolean(session);

  const heroRef = useReveal<HTMLElement>();
  const featuresRef = useReveal<HTMLElement>();
  const trustRef = useReveal<HTMLElement>();
  const finalRef = useReveal<HTMLElement>();

  return (
    <div className="landing-page">
      <header className="site-header">
        <div className="site-header-inner">
          <Link className="site-brand" href="/" aria-label="Professional Profile home">
            <span className="site-brand-mark" aria-hidden="true">
              <SignalIcon />
            </span>
            <span className="site-brand-word">Professional Profile</span>
          </Link>
          <nav className="site-nav" aria-label="Main">
            {isSignedIn ? (
              <Link className="nav-link" href="/app/">
                Open profile
              </Link>
            ) : (
              <>
                <Link className="nav-link nav-link--quiet" href="/login/">
                  Sign in
                </Link>
                <Link className="nav-link" href="/register/">
                  Create account
                </Link>
              </>
            )}
            <span className="nav-link nav-link--quiet" aria-current="true">
              EN
            </span>
            <Link className="nav-link nav-link--quiet" href="/es/" lang="es" hrefLang="es">
              ES
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="landing-hero reveal" ref={heroRef} aria-labelledby="landing-title">
          <div className="landing-copy">
            <p className="eyebrow">Private professional profile workspace</p>
            <h1 id="landing-title">
              A professional profile and CV that carry your career forward.
            </h1>
            <p>
              Professional Profile is a quiet, private workspace where your professional profile and
              your CV live together, versioned and recoverable. You sign in, keep every field
              current, and grow your CV at your own pace — nothing leaves your account and nothing
              gets lost.
            </p>
            <p>
              Every save quietly archives the previous version of your CV. When a change goes
              sideways, the version history hands the earlier text back in one step — the safety net
              that lets you write boldly.
            </p>
          </div>

          <div className="hero-figure">
            <Image
              className="hero-image"
              src="https://images.pexels.com/photos/3931641/pexels-photo-3931641.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&dpr=1"
              alt="A focused team gathered around a table, reviewing documents together"
              width={1200}
              height={800}
              priority
            />
          </div>
        </section>

        <section
          className="feature-section reveal"
          ref={featuresRef}
          aria-label="What the workspace gives you"
        >
          <div className="feature-grid">
            <article className="feature-card">
              <UserIcon />
              <h2>One calm workspace</h2>
              <p className="auth-subtitle">
                Your profile fields, your CV and its version history share one private place — no
                exports, no copies, no scattered documents. Open the workspace and everything you
                have written is exactly where the account left it.
              </p>
            </article>
            <article className="feature-card">
              <ShieldIcon />
              <h2>Sessions that guard themselves</h2>
              <p className="auth-subtitle">
                Sessions renew silently while you are active and stay bound to your device. Sign out
                whenever you want and the access ends everywhere the token did — your workspace
                waits, your data does not walk.
              </p>
            </article>
            <article className="feature-card">
              <SignalIcon />
              <h2>Feedback that speaks plainly</h2>
              <p className="auth-subtitle">
                Every save, lock or limit answers in plain words — what happened, why it happened,
                and the exact next step, so no screen ever leaves you guessing.
              </p>
            </article>
          </div>
        </section>

        <section className="trust-strip reveal" ref={trustRef} aria-label="Assurances">
          <ul>
            <li>
              <strong>Private by default</strong>
              <span>Your workspace opens only for you; public routes stay public.</span>
            </li>
            <li>
              <strong>Verified access</strong>
              <span>Every account is confirmed by email before it can sign in.</span>
            </li>
            <li>
              <strong>Calm by design</strong>
              <span>Clear guidance and patient feedback, without visual noise.</span>
            </li>
          </ul>
        </section>

        <section className="feature-section reveal" aria-label="How the workspace grows with you">
          <div className="landing-copy">
            <h2>Grown for the long career, not the first job.</h2>
            <p>
              A professional profile starts as one page and grows with you: the headline that opens
              doors, the bio that reads like you sound, and the CV that keeps its whole history. On
              a bad day you restore yesterday’s text and keep writing today’s — the account
              remembers, so you can focus on the career.
            </p>
            <p>
              Until you decide a profile is ready to be seen, everything stays between you and your
              account. The workspace is private by construction: verified accounts, calm screens,
              and your professional story exactly as you left it.
            </p>
          </div>
        </section>

        <section className="final-action reveal" ref={finalRef} aria-labelledby="closing-title">
          <div className="final-action-panel">
            <h2 id="closing-title">Put your profile in motion.</h2>
            <p>
              {isSignedIn
                ? 'Return to the app and continue where your work left off.'
                : 'Create an account in minutes and give your professional profile and CV the private, versioned workspace the career deserves.'}
            </p>
            <div className="landing-actions">
              {isSignedIn ? (
                <Link className="button button-primary" href="/app/">
                  Open profile
                </Link>
              ) : (
                <Link className="button button-primary" href="/register/">
                  Create an account
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <p>&copy; 2026 Professional Profile.</p>
      </footer>
    </div>
  );
}
