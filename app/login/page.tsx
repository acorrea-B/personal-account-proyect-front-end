'use client';

import type { SyntheticEvent } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { ProblemError, login } from '@/lib/api/client';
import { loginRequestSchema } from '@/lib/schemas/auth';
import { saveSession } from '@/lib/auth/session';

interface FieldErrors {
  email?: string;
  password?: string;
}

export default function LoginPage() {
  const router = useRouter();
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
      router.push('/');
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
    <main>
      <section>
        <h1>Sign in</h1>
        <p>Use your verified account credentials.</p>

        {formError ? (
          <div role="alert">
            <p>{formError}</p>
            {formError.includes('not verified') ? (
              <p>
                <a href="/register/confirm/">Resend verification email</a>
              </p>
            ) : null}
          </div>
        ) : null}

        <form method="post" onSubmit={handleSubmit} noValidate>
          <label htmlFor="email">
            Email
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            />
          </label>
          {fieldErrors.email ? (
            <p id="email-error" role="alert">
              {fieldErrors.email}
            </p>
          ) : null}

          <label htmlFor="password">
            Password
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
            />
          </label>
          {fieldErrors.password ? (
            <p id="password-error" role="alert">
              {fieldErrors.password}
            </p>
          ) : null}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p>
          <a href="/register/">Create an account instead</a>
        </p>
      </section>
    </main>
  );
}
