'use client';

import type { SyntheticEvent } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { ProblemError, register } from '@/lib/api/client';
import { registerRequestSchema } from '@/lib/schemas/auth';

interface FieldErrors {
  email?: string;
  password?: string;
}

export default function RegisterPage() {
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

    const parsed = registerRequestSchema.safeParse({ email, password });
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
      await register(parsed.data);
      router.push('/register/confirm/');
    } catch (error) {
      if (error instanceof ProblemError) {
        if (error.problem.status === 409) {
          setFormError('An account with this email already exists.');
        } else if (error.problem.fields) {
          setFieldErrors(error.problem.fields);
        } else {
          setFormError('Registration could not be completed. Please try again.');
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
        <h1>Create account</h1>
        <p>Register and verify your email to continue.</p>

        {formError ? (
          <div role="alert">
            <p>{formError}</p>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} noValidate>
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
              autoComplete="new-password"
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
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>
      </section>
    </main>
  );
}
