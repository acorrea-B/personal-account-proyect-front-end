'use client';

import Link from 'next/link';
import { ArrowRightIcon, LockIcon, ShieldIcon, UserIcon } from '../components/icons';
import { useSession } from '@/lib/auth/useSession';

export default function LandingPage() {
  const { session, isHydrated } = useSession();
  const isSignedIn = isHydrated && Boolean(session);

  return (
    <main className="landing-page landing-page--background">
      <div className="landing-hero">
        <section className="landing-copy">
          <p className="auth-subtitle">Private profile workspace</p>
          <h1>Welcome to your professional home.</h1>
          <p>
            Keep your professional identity focused and secure: register once, verify your email,
            and return to the same calm workspace with active sessions, clear feedback, and a quiet
            stone-and-cyan visual language that never gets in the way of your story.
          </p>
        </section>

        <aside className="landing-panel landing-panel--float">
          <div className="auth-card">
            <h2 className="auth-heading">
              {isSignedIn ? 'Continue where you left off' : 'Enter your workspace'}
            </h2>
            <p className="auth-subtitle">
              {isSignedIn
                ? 'Your session is active. Open the app or sign out to switch accounts.'
                : 'Sign in with your verified account or create a new one in a few guided steps.'}
            </p>
            <div className="landing-actions">
              {isSignedIn ? (
                <Link className="button button-primary" href="/app/">
                  Open profile
                  <ArrowRightIcon className="cta-arrow" />
                </Link>
              ) : (
                <>
                  <Link className="button button-primary" href="/login/">
                    Sign in
                    <ArrowRightIcon className="cta-arrow" />
                  </Link>
                  <Link className="button button-ghost" href="/register/">
                    Create an account
                    <ArrowRightIcon className="cta-arrow" />
                  </Link>
                </>
              )}
            </div>
          </div>
        </aside>
      </div>

      <section className="feature-grid">
        <article className="feature-card">
          <UserIcon />
          <h2>Account that stays clean</h2>
          <p className="auth-subtitle">
            Validation, email verification, rate-limit guidance, and a 3-minute resend cooldown keep
            account setup predictable.
          </p>
        </article>
        <article className="feature-card">
          <ShieldIcon />
          <h2>Security without clutter</h2>
          <p className="auth-subtitle">
            Tokens stay in sessionStorage, renewal happens automatically, and logout clears your
            local session immediately.
          </p>
        </article>
        <article className="feature-card">
          <LockIcon />
          <h2>Private by default</h2>
          <p className="auth-subtitle">
            Public pages stay open, while profile and CV areas remain available only after the
            client confirms your session.
          </p>
        </article>
      </section>
    </main>
  );
}
