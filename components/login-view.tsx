'use client';

import type { SyntheticEvent } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { ProblemError, login } from '@/lib/api/client';
import { loginRequestSchema } from '@/lib/schemas/auth';
import { savePendingVerificationEmail, saveSession } from '@/lib/auth/session';
import { type Locale, labels, tr } from '@/lib/i18n';
import {
  AuthCard,
  AuthForm,
  AuthFormNote,
  AuthHeading,
  AuthPage,
  AuthSubtitle,
  Field,
  FieldError,
  FormMessage,
  primaryButton,
  TextLink,
} from '@/components/ui';

interface FieldErrors {
  email?: string;
  password?: string;
}

// The shared sign-in view: one implementation serves both locale trees and
// every string reads the json dictionaries; the tree owns the locale, so a
// route renders <LoginView locale="en" /> at /login and locale="es" at
// /es/login (the mirrored copies are retired). The api answers in the
// contract's english problem voice while the chrome speaks the tree locale,
// and each page keeps a one-glance link to the other language's tree.
export function LoginView({ locale }: { locale: Locale }) {
  const t = labels(locale);
  // The tree prefix: empty for the default english tree, /es for the
  // spanish subtree; every route of the view hangs from it.
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

    const parsed = loginRequestSchema.safeParse({ email, password });
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === 'email' || field === 'password') {
          // The schema names the failing field; the copy is the tree's.
          errors[field] =
            field === 'email' ? t.validation.emailInvalid : t.validation.passwordRequired;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const tokenPair = await login(parsed.data);
      saveSession(tokenPair);
      router.push(`${base}/app/`);
    } catch (error) {
      if (error instanceof ProblemError) {
        if (error.problem.status === 401) {
          setFormError(t.login.invalid);
        } else if (error.problem.status === 403) {
          // The api reports an unverified email: hand the account to the
          // verification view directly instead of leaving the user to find it.
          savePendingVerificationEmail(email);
          router.push(`${base}/register/confirm/`);
          return;
        } else if (error.problem.status === 429) {
          const seconds = error.problem.retry_after_seconds;
          setFormError(
            seconds
              ? tr(t.login.rateCappedWithSeconds, { seconds: String(seconds) })
              : t.login.rateCapped,
          );
        } else if (error.problem.fields) {
          setFieldErrors(error.problem.fields);
        } else {
          setFormError(t.login.generic);
        }
      } else if (error instanceof DOMException && error.name === 'AbortError') {
        setFormError(t.login.timeout);
      } else {
        setFormError(t.login.unexpected);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthPage>
      <AuthCard>
        <AuthHeading>{t.login.heading}</AuthHeading>
        <AuthSubtitle>{t.login.subtitle}</AuthSubtitle>

        {formError ? <FormMessage tone="alert">{formError}</FormMessage> : null}

        <AuthForm method="post" onSubmit={handleSubmit} noValidate>
          <Field
            label={t.login.email}
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
          />
          {fieldErrors.email ? <FieldError id="email-error">{fieldErrors.email}</FieldError> : null}

          <Field
            label={t.login.password}
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? 'password-error' : undefined}
          />
          {fieldErrors.password ? (
            <FieldError id="password-error">{fieldErrors.password}</FieldError>
          ) : null}

          <button type="submit" className={primaryButton} disabled={isSubmitting}>
            {isSubmitting ? t.login.submitting : t.login.submit}
          </button>
        </AuthForm>

        <p>
          <TextLink href={`${base}/register/`}>{t.login.registerEntry}</TextLink>
        </p>
        <AuthFormNote>
          <TextLink href={locale === 'es' ? '/' : '/es/'} hrefLang={locale === 'es' ? 'en' : 'es'}>
            {t.login.otherLanguage}
          </TextLink>
        </AuthFormNote>
      </AuthCard>
    </AuthPage>
  );
}
