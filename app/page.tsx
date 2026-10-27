'use client';

import Link from 'next/link';
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
          <Link className="site-brand" href="/">
            Professional Profile
          </Link>
          <nav className="site-nav" aria-label="Main">
            {isSignedIn ? (
              <Link className="button button-primary" href="/app/">
                Open profile
              </Link>
            ) : (
              <>
                <Link className="button button-ghost" href="/login/">
                  Sign in
                </Link>
                <Link className="button button-primary" href="/register/">
                  Create account
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="landing-hero reveal" ref={heroRef} aria-labelledby="landing-title">
          <div className="landing-copy">
            <p className="eyebrow">Private professional profile workspace</p>
            <h1 id="landing-title">Your career deserves a distinguished entrance.</h1>
            <p>A calm, private workspace for your professional profile and CV.</p>
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
                Your professional profile and CV live together in one private place.
              </p>
            </article>
            <article className="feature-card">
              <ShieldIcon />
              <h2>Sessions that guard themselves</h2>
              <p className="auth-subtitle">
                Sessions renew silently and never leave your current device.
              </p>
            </article>
            <article className="feature-card">
              <SignalIcon />
              <h2>Feedback that speaks plainly</h2>
              <p className="auth-subtitle">
                Every message tells you what happened and what to do next.
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

        <section className="final-action reveal" ref={finalRef} aria-labelledby="closing-title">
          <div className="final-action-panel">
            <h2 id="closing-title">Put your profile in motion.</h2>
            <p>
              {isSignedIn
                ? 'Return to the app and continue where your work left off.'
                : 'Open your account in minutes, in a workspace that stays private.'}
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
