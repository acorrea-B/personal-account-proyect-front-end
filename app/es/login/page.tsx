'use client';

import type { SyntheticEvent } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ProblemError, login } from '@/lib/api/client';
import { loginRequestSchema } from '@/lib/schemas/auth';
import { savePendingVerificationEmail, saveSession } from '@/lib/auth/session';

interface FieldErrors {
  email?: string;
  password?: string;
}

// The es subtree's sign-in page: the mirror of the english login with the
// es copy. The api problem details keep the contract's english voice (the
// backend's error language); the chrome is the tree's locale.
export default function LoginEsPage() {
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
      router.push('/es/app/');
    } catch (error) {
      if (error instanceof ProblemError) {
        if (error.problem.status === 401) {
          setFormError('El correo o la contraseña no son válidos.');
        } else if (error.problem.status === 403) {
          // El correo sin verificar: la cuenta se entrega a la vista de
          // verificación directamente (es mirror del handoff).
          savePendingVerificationEmail(email);
          router.push('/es/register/confirm/');
          return;
        } else if (error.problem.status === 429) {
          const seconds = error.problem.retry_after_seconds;
          setFormError(
            seconds
              ? 'Demasiados intentos; reintenta en ' + String(seconds) + ' segundos.'
              : 'Demasiados intentos; por favor reintenta más tarde.',
          );
        } else if (error.problem.fields) {
          setFieldErrors(error.problem.fields);
        } else {
          setFormError('No se pudo iniciar sesión. Por favor inténtalo de nuevo.');
        }
      } else if (error instanceof DOMException && error.name === 'AbortError') {
        setFormError('La petición agotó el tiempo de espera. Por favor inténtalo de nuevo.');
      } else {
        setFormError('Error inesperado. Por favor inténtalo de nuevo.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-shell auth-card">
        <h1 className="auth-heading">Iniciar sesión</h1>
        <p className="auth-subtitle">Usa las credenciales de tu cuenta verificada.</p>

        {formError ? (
          <div role="alert" className="form-error">
            <p>{formError}</p>
          </div>
        ) : null}

        <form method="post" onSubmit={handleSubmit} noValidate>
          <label className="field" htmlFor="email">
            Correo electrónico
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
            Contraseña
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
            <p id="password-error" role="alert" className="field-error">
              {fieldErrors.password}
            </p>
          ) : null}

          <button type="submit" className="button button-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Iniciando sesión…' : 'Iniciar sesión'}
          </button>
        </form>

        <p>
          <a className="link" href="/es/register/">
            Mejor crea una cuenta
          </a>
        </p>
        <p className="auth-form-note">
          <Link className="link" href="/" hrefLang="en">
            English
          </Link>
        </p>
      </section>
    </main>
  );
}
