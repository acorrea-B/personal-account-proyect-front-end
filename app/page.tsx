'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type SyntheticEvent, useState } from 'react';

import { login, ProblemError } from '@/lib/api/client';
import { loginRequestSchema } from '@/lib/schemas/auth';
import { saveSession } from '@/lib/auth/session';
import { ShieldIcon, SignalIcon, UserIcon } from '../components/icons';
import { useSession } from '@/lib/auth/useSession';

interface FieldErrors {
  email?: string;
  password?: string;
}

export default function LandingPage() {
  const router = useRouter();
  const { session, isHydrated } = useSession();
  const isSignedIn = isHydrated && Boolean(session);

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
          setFormError('Email or password is invalid.');
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
    <main className="landing-page landing-page--background">
      <div className="landing-hero">
        <section className="landing-copy">
          <p className="eyebrow">Private professional profile workspace</p>
          <h1>Your career deserves a distinguished entrance.</h1>
          <p>
            Create your account, verify your email, and enter a calm private workspace built for
            profile and CV work, with secure sessions, clear feedback, and no visual noise.
          </p>
        </section>

        <aside className="landing-panel landing-panel--float">
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
                      aria-describedby={fieldErrors.password ? 'landing-password-error' : undefined}
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
              <dt>
                <UserIcon className="metric-icon" /> Session
              </dt>
              <dd>Automatic renewal</dd>
            </div>
            <div>
              <dt>
                <ShieldIcon className="metric-icon" /> Security
              </dt>
              <dd>sessionStorage only</dd>
            </div>
            <div>
              <dt>
                <SignalIcon className="metric-icon" /> Feedback
              </dt>
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
        <h2>Put your profile in motion.</h2>
        <p>
          {isSignedIn
            ? 'Return to the app and continue where your work left off.'
            : 'Open your account in minutes and keep every credential secured.'}
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
