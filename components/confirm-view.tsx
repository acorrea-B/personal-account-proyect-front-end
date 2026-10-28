'use client';

import type { SyntheticEvent } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { ProblemError, resendVerification } from '@/lib/api/client';
import { resendVerificationRequestSchema } from '@/lib/schemas/auth';
import { readPendingVerificationEmail } from '@/lib/auth/session';
import { type Locale, labels, tr } from '@/lib/i18n';

const THREE_MINUTES_MS = 3 * 60 * 1000;
const RESEND_AVAILABLE_AT_KEY = 'verificationResendAvailableAt';

interface FieldErrors {
  email?: string;
}

// The shared email-confirm view: one implementation serves both locale
// trees with every string from the json dictionaries; the two intro
// paragraphs (login handoff vs fresh registration) split around the
// pending email because the dictionary carries plain text, not markup.
// The resend keeps its three-minute cooldown via sessionStorage.
export function ConfirmView({ locale }: { locale: Locale }) {
  const t = labels(locale);
  const base = locale === 'es' ? '/es' : '';
  const router = useRouter();
  // The login view hands over the account behind a 403 email-not-verified;
  // this page prefills it and explains the next step (static export: the
  // handoff travels through sessionStorage).
  const [pendingEmail] = useState(() => readPendingVerificationEmail());
  const [email, setEmail] = useState(() => readPendingVerificationEmail());
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
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
        if (previous === null) {
          return previous;
        }
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
    if ((secondsLeft ?? 0) > 0 || isSubmitting) {
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
          setFormError(t.confirm.rateCapped);
          window.setTimeout(() => router.push(`${base}/register/`), 1200);
        } else if (error.problem.fields) {
          setFieldErrors(error.problem.fields);
        } else {
          setFormError(t.confirm.generic);
        }
      } else if (error instanceof DOMException && error.name === 'AbortError') {
        setFormError(t.confirm.timeout);
      } else {
        setFormError(t.confirm.unexpected);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const currentSeconds = secondsLeft ?? 0;
  const minutes = Math.floor(currentSeconds / 60);
  const seconds = currentSeconds % 60;
  const countdownLabel = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <main className="auth-page">
      <section className="auth-shell auth-card">
        <h1 className="auth-heading">{t.confirm.heading}</h1>
        {pendingEmail ? (
          <>
            <p>
              {t.confirm.pendingPrefix} <strong>{pendingEmail}</strong> {t.confirm.pendingSuffix}
            </p>
            <p className="auth-subtitle">{t.confirm.pendingNote}</p>
          </>
        ) : (
          <>
            <p>{t.confirm.freshCopy}</p>
            <p className="auth-subtitle">{t.confirm.freshNote}</p>
          </>
        )}

        <form method="post" onSubmit={handleSubmit} noValidate>
          <label className="field" htmlFor="email">
            {t.confirm.email}
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
            <p id="email-error" role="alert" className="field-error">
              {fieldErrors.email}
            </p>
          ) : null}

          {formError ? (
            <div role="alert" className="form-error">
              <p>{formError}</p>
            </div>
          ) : null}

          {successMessage ? (
            <div role="status" className="form-error">
              <p>{successMessage}</p>
            </div>
          ) : null}

          <button
            type="submit"
            className="button button-primary"
            disabled={isSubmitting || (secondsLeft ?? 0) > 0}
          >
            {(secondsLeft ?? 0) > 0
              ? tr(t.confirm.resendIn, { label: countdownLabel })
              : isSubmitting
                ? t.confirm.sending
                : t.confirm.resend}
          </button>
        </form>
      </section>
    </main>
  );
}
