'use client';

import type { SyntheticEvent } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { ProblemError, register } from '@/lib/api/client';
import { MailIcon, ProfileIcon, ShieldIcon, UserIcon } from '@/components/icons';
import { registerRequestSchema } from '@/lib/schemas/auth';
import { type Locale, labels, tr } from '@/lib/i18n';
import {
  AuthCard,
  AuthForm,
  AuthFormNote,
  AuthHeading,
  AuthKicker,
  AuthPage,
  AuthSteps,
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
    <AuthPage>
      <AuthCard>
        <AuthKicker icon={ShieldIcon}>{t.register.kicker}</AuthKicker>
        <AuthHeading>{t.register.heading}</AuthHeading>
        <AuthSubtitle>{t.register.subtitle}</AuthSubtitle>
        <AuthSteps
          steps={[
            { icon: UserIcon, label: t.register.stepAccount, active: true },
            { icon: MailIcon, label: t.register.stepVerify },
            { icon: ProfileIcon, label: t.register.stepProfile },
          ]}
        />

        {formError ? <FormMessage tone="alert">{formError}</FormMessage> : null}

        <AuthForm method="post" onSubmit={handleSubmit} noValidate>
          <Field
            label={t.register.email}
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
            label={t.register.password}
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? 'password-error' : undefined}
          />
          {fieldErrors.password ? (
            <FieldError id="password-error">{fieldErrors.password}</FieldError>
          ) : null}

          <button type="submit" className={primaryButton} disabled={isSubmitting}>
            {isSubmitting ? t.register.submitting : t.register.submit}
          </button>
        </AuthForm>
        <AuthFormNote>
          {t.register.loginQuestion}{' '}
          <TextLink href={`${base}/login/`}>{t.register.loginEntry}</TextLink>
        </AuthFormNote>
        <AuthFormNote>
          <TextLink href={locale === 'es' ? '/' : '/es/'} hrefLang={locale === 'es' ? 'en' : 'es'}>
            {t.register.otherLanguage}
          </TextLink>
        </AuthFormNote>
      </AuthCard>
    </AuthPage>
  );
}
