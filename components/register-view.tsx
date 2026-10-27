'use client';

import type { SyntheticEvent } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { ProblemError, register } from '@/lib/api/client';
import { MailIcon, ProfileIcon, ShieldIcon, UserIcon } from '@/components/icons';
import { registerRequestSchema } from '@/lib/schemas/auth';
import { type Locale, labels, tr } from '@/lib/i18n';

interface FieldErrors {
  email?: string;
  password?: string;
}

// The shared registration view: one implementation serves both locale trees
// with every string from the json dictionaries and the routes prefixed by
// the tree's locale (empty for the english tree, /es for the spanish one).
// The successful register hands the account to the tree's confirm view; the
// api answers in the contract's english problem voice.
export function RegisterView({ locale }: { locale: Locale }) {
  const t = labels(locale);
  const base = locale === 'es' ? '/es' : '';
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
      router.push(`${base}/register/confirm/`);
    } catch (error) {
      if (error instanceof ProblemError) {
        if (error.problem.status === 409) {
          setFormError(t.register.conflict);
        } else if (error.problem.status === 429) {
          const seconds = error.problem.retry_after_seconds;
          setFormError(
            seconds
              ? tr(t.register.rateCappedWithSeconds, { seconds: String(seconds) })
              : t.register.rateCapped,
          );
        } else if (error.problem.fields) {
          setFieldErrors(error.problem.fields);
        } else {
          setFormError(t.register.generic);
        }
      } else if (error instanceof DOMException && error.name === 'AbortError') {
        setFormError(t.register.timeout);
      } else {
        setFormError(t.register.unexpected);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-shell auth-card">
        <p className="auth-kicker">
          <ShieldIcon className="auth-kicker-icon" /> {t.register.kicker}
        </p>
        <h1 className="auth-heading">{t.register.heading}</h1>
        <p className="auth-subtitle">{t.register.subtitle}</p>
        <ol className="auth-steps">
          <li className="auth-step is-active">
            <UserIcon className="auth-step-icon" /> {t.register.stepAccount}
          </li>
          <li className="auth-step">
            <MailIcon className="auth-step-icon" /> {t.register.stepVerify}
          </li>
          <li className="auth-step">
            <ProfileIcon className="auth-step-icon" /> {t.register.stepProfile}
          </li>
        </ol>

        {formError ? (
          <div role="alert" className="form-error">
            <p>{formError}</p>
          </div>
        ) : null}

        <form method="post" onSubmit={handleSubmit} noValidate>
          <label className="field" htmlFor="email">
            {t.register.email}
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

          <label className="field" htmlFor="password">
            {t.register.password}
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
            <p id="password-error" role="alert" className="field-error">
              {fieldErrors.password}
            </p>
          ) : null}

          <button type="submit" className="button button-primary" disabled={isSubmitting}>
            {isSubmitting ? t.register.submitting : t.register.submit}
          </button>
        </form>
        <p className="auth-form-note">
          {t.register.loginQuestion}{' '}
          <a className="link" href={`${base}/login/`}>
            {t.register.loginEntry}
          </a>
        </p>
        <p className="auth-form-note">
          <a
            className="link"
            href={locale === 'es' ? '/' : '/es/'}
            hrefLang={locale === 'es' ? 'en' : 'es'}
          >
            {t.register.otherLanguage}
          </a>
        </p>
      </section>
    </main>
  );
}
