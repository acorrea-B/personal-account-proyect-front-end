'use client';

import type { SyntheticEvent } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ProblemError, register } from '@/lib/api/client';
import { MailIcon, ProfileIcon, ShieldIcon, UserIcon } from '../../../components/icons';
import { registerRequestSchema } from '@/lib/schemas/auth';

interface FieldErrors {
  email?: string;
  password?: string;
}

// The es subtree's registration page: the mirror of the english register
// with the es copy and the stepper's first step active.
export default function RegisterEsPage() {
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
      router.push('/es/register/confirm/');
    } catch (error) {
      if (error instanceof ProblemError) {
        if (error.problem.status === 409) {
          setFormError('Ya existe una cuenta con este correo.');
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
          setFormError('No se pudo completar el registro. Por favor inténtalo de nuevo.');
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
        <p className="auth-kicker">
          <ShieldIcon className="auth-kicker-icon" /> Configuración de cuenta verificada
        </p>
        <h1 className="auth-heading">Crea tu cuenta profesional</h1>
        <p className="auth-subtitle">Tres pasos guiados hasta tu espacio de trabajo.</p>
        <ol className="auth-steps">
          <li className="auth-step is-active">
            <UserIcon className="auth-step-icon" /> Cuenta
          </li>
          <li className="auth-step">
            <MailIcon className="auth-step-icon" /> Verificar
          </li>
          <li className="auth-step">
            <ProfileIcon className="auth-step-icon" /> Perfil
          </li>
        </ol>

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
            {isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </form>
        <p className="auth-form-note">
          ¿Ya tienes una cuenta?{' '}
          <Link className="link" href="/es/login/">
            Inicia sesión
          </Link>
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
