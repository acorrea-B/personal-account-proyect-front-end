'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type SyntheticEvent, useEffect, useRef, useState } from 'react';

import { login, ProblemError } from '@/lib/api/client';
import { loginRequestSchema } from '@/lib/schemas/auth';
import { saveSession } from '@/lib/auth/session';
import { ShieldIcon, SignalIcon, UserIcon } from '../components/icons';
import { useSession } from '@/lib/auth/useSession';

interface FieldErrors {
  email?: string;
  password?: string;
}

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
  const router = useRouter();
  const { session, isHydrated } = useSession();
  const isSignedIn = isHydrated && Boolean(session);

  const heroRef = useReveal<HTMLElement>();
  const featuresRef = useReveal<HTMLElement>();
  const trustRef = useReveal<HTMLElement>();
  const finalRef = useReveal<HTMLElement>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const parsed = loginRequestSchema.safeParse({ email, password });
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === 'email' || field === 'password') {
          errors[field] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const tokenPair = await login(parsed.data);
      saveSession(tokenPair);
      router.push('/app/');
    } catch (error) {
      if (error instanceof ProblemError) {
        if (error.problem.status === 401) {
          setFormError('Alert: the email or password did not match. Please try again.');
        } else if (error.problem.status === 403) {
          setFormError('Your email is not verified yet. Verify it before signing in.');
        } else if (error.problem.status === 429) {
          const seconds = error.problem.retry_after_seconds;
          setFormError(
            seconds
              ? 'Too many attempts; try again in ' + String(seconds) + ' seconds.'
              : 'Too many attempts; please try again later.',
          );
        } else if (error.problem.fields) {
          setFieldErrors(error.problem.fields);
        } else {
          setFormError('Sign-in could not be completed. Please try again.');
        }
      } else if (error instanceof DOMException && error.name === 'AbortError') {
        setFormError('Request timed out. Please try again.');
      } else {
        setFormError('Unexpected error. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="landing-page">
      <header className="site-header">
        <div className="site-header-inner">
          <Link className="site-brand" href="/">
            Professional Profile
          </Link>
          <nav className="site-nav" aria-label="Main">
            {isSignedIn ? (
              <Link className="link" href="/app/">
                Open profile
              </Link>
            ) : (
              <Link className="link" href="/login/">
                Sign in
              </Link>
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

          <aside className="landing-panel" aria-label={isSignedIn ? 'Your session' : 'Sign in'}>
            <div className="auth-card">
              {isSignedIn ? (
                <>
                  <h2 className="auth-heading">Pick up your work instantly</h2>
                  <p className="auth-subtitle">
                    Your session is active. Return to your workspace or change accounts.
                  </p>
                  <div className="landing-actions">
                    <Link className="button button-primary" href="/app/">
                      Open profile
                    </Link>
                    <Link className="button button-ghost" href="/logout/">
                      Sign out
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="auth-heading">Sign in to your workspace</h2>
                  <p className="auth-subtitle">
                    Use your verified credentials and continue from where you left off.
                  </p>

                  {formError ? (
                    <div role="alert" className="form-error">
                      <p>{formError}</p>
                      {formError.includes('not verified') ? (
                        <p>
                          <Link className="link" href="/register/confirm/">
                            Resend verification email
                          </Link>
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <form method="post" onSubmit={handleSubmit} noValidate>
                    <label className="field" htmlFor="landing-email">
                      Email
                      <input
                        id="landing-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        aria-invalid={Boolean(fieldErrors.email)}
                        aria-describedby={fieldErrors.email ? 'landing-email-error' : undefined}
                      />
                    </label>
                    {fieldErrors.email ? (
                      <p id="landing-email-error" role="alert" className="field-error">
                        {fieldErrors.email}
                      </p>
                    ) : null}

                    <label className="field" htmlFor="landing-password">
                      Password
                      <input
                        id="landing-password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        aria-invalid={Boolean(fieldErrors.password)}
                        aria-describedby={
                          fieldErrors.password ? 'landing-password-error' : undefined
                        }
                      />
                    </label>
                    {fieldErrors.password ? (
                      <p id="landing-password-error" role="alert" className="field-error">
                        {fieldErrors.password}
                      </p>
                    ) : null}

                    <button type="submit" className="button button-primary" disabled={isSubmitting}>
                      {isSubmitting ? 'Signing in...' : 'Sign in'}
                    </button>
                  </form>

                  <div className="landing-actions">
                    <Link className="button button-ghost" href="/register/">
                      Create an account
                    </Link>
                  </div>
                </>
              )}
            </div>
          </aside>
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
