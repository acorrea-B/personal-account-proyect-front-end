'use client';

import Link from 'next/link';
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
            One calibrated surface for your account, email verification, and secure access. The
            interface stays quiet while the work, not the chrome, takes the room.
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
                </Link>
              ) : (
                <>
                  <Link className="button button-primary" href="/login/">
                    Sign in
                  </Link>
                  <Link className="button button-ghost" href="/register/">
                    Create an account
                  </Link>
                </>
              )}
            </div>
          </div>
        </aside>
      </div>

      <section className="workspace-proof">
        <article>
          <p className="eyebrow">Account clarity</p>
          <h2>Setup that stays readable.</h2>
          <p>
            Registration, verification, resend cooldown, rate-limit guidance and timeout feedback
            make account entry predictable on desktop and mobile.
          </p>
        </article>
        <aside className="proof-metrics">
          <dl>
            <div>
              <dt>Session</dt>
              <dd>Automatic renewal</dd>
            </div>
            <div>
              <dt>Security</dt>
              <dd>sessionStorage only</dd>
            </div>
            <div>
              <dt>Feedback</dt>
              <dd>RFC 7807 errors</dd>
            </div>
          </dl>
        </aside>
      </section>

      <section className="access-rails">
        <article>
          <h2>Private by default</h2>
          <p>
            Public routes stay open. Protected areas appear only after hydration confirms a stored,
            renewable session.
          </p>
        </article>
        <article className="rail-note">
          <h3>Reduced motion supported</h3>
          <p>
            Long fades and image pacing are disabled when the user prefers reduced movement, while
            content stays fully visible.
          </p>
        </article>
      </section>

      <section className="final-action">
        <h2>Start with a calm account.</h2>
        <p>
          {isSignedIn
            ? 'Return to the app and keep your profile in motion.'
            : 'Create an account, verify your email, and reach your private workspace.'}
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
      </section>
    </main>
  );
}
