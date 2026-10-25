'use client';

import type { SyntheticEvent } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { ProblemError, resendVerification } from '@/lib/api/client';
import { resendVerificationRequestSchema } from '@/lib/schemas/auth';

const THREE_MINUTES_MS = 3 * 60 * 1000;
const RESEND_AVAILABLE_AT_KEY = 'verificationResendAvailableAt';

interface FieldErrors {
  email?: string;
}

export default function RegisterConfirmPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    function getSecondsUntil(endAt: number) {
      return Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    }

    const storedEndAt = window.sessionStorage.getItem(RESEND_AVAILABLE_AT_KEY);
    const initialEndAt = storedEndAt ? Number(storedEndAt) : 0;
    if (initialEndAt > Date.now()) {
      setSecondsLeft(getSecondsUntil(initialEndAt));
    } else {
      const availableAt = Date.now() + THREE_MINUTES_MS;
      window.sessionStorage.setItem(RESEND_AVAILABLE_AT_KEY, String(availableAt));
      setSecondsLeft(getSecondsUntil(availableAt));
    }

    const timer = window.setInterval(() => {
      setSecondsLeft((previous) => {
        if (previous <= 1) {
          window.sessionStorage.removeItem(RESEND_AVAILABLE_AT_KEY);
          window.clearInterval(timer);
          return 0;
        }
        return previous - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (secondsLeft > 0 || isSubmitting) {
      return;
    }

    setFormError(null);
    setFieldErrors({});
    setSuccessMessage(null);

    const parsed = resendVerificationRequestSchema.safeParse({ email });
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === 'email') {
          errors.email = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await resendVerification(parsed.data);
      setSuccessMessage(response.message);
      const availableAt = Date.now() + THREE_MINUTES_MS;
      window.sessionStorage.setItem(RESEND_AVAILABLE_AT_KEY, String(availableAt));
      setSecondsLeft(Math.ceil(THREE_MINUTES_MS / 1000));
    } catch (error) {
      if (error instanceof ProblemError) {
        if (error.problem.status === 429) {
          setFormError('Too many requests. Redirecting to registration.');
          window.setTimeout(() => router.push('/register/'), 1200);
        } else if (error.problem.fields) {
          setFieldErrors(error.problem.fields);
        } else {
          setFormError('Resend could not be completed. Please try again.');
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

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const countdownLabel = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <main>
      <section>
        <h1>Confirm your email</h1>
        <p>
          We created your account. Check your inbox and follow the verification link to continue
          with registration.
        </p>
        <p>After verifying your email, return here and sign in.</p>

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

          {formError ? (
            <div role="alert">
              <p>{formError}</p>
            </div>
          ) : null}

          {successMessage ? (
            <div role="status">
              <p>{successMessage}</p>
            </div>
          ) : null}

          <button type="submit" disabled={isSubmitting || secondsLeft > 0}>
            {secondsLeft > 0
              ? `Resend in ${countdownLabel}`
              : isSubmitting
                ? 'Sending...'
                : 'Resend verification email'}
          </button>
        </form>
      </section>
    </main>
  );
}
