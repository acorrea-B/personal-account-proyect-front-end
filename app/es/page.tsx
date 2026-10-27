'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef } from 'react';

import { ShieldIcon, SignalIcon, UserIcon } from '../../components/icons';
import { useSession } from '@/lib/auth/useSession';

// Reveals a section when it scrolls into view. The hidden state only applies
// while `js` is set on <html> (app/template.tsx) plus the IntersectionObserver
// fires, so content stays readable without JavaScript and for reduced-motion
// users. (Mirror of the english landing for the es/ subtree.)
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    if (typeof IntersectionObserver === 'undefined') {
      node.classList.add('is-visible');
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        }
      },
      { threshold: 0.12 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return ref;
}

const finalRef = { current: null } as { current: HTMLElement | null };

export default function LandingEsPage() {
  const { session } = useSession();
  const isSignedIn = Boolean(session?.accessToken);

  const heroRef = useReveal<HTMLElement>();
  const featuresRef = useReveal<HTMLElement>();

  useEffect(() => {
    // The root layout owns the html tag and stays en for the english tree;
    // the es subtree patches the document language on the client until the
    // [locale] restructure lands.
    document.documentElement.lang = 'es';
  }, []);

  const finalRefElement = useRef<HTMLElement | null>(finalRef.current);

  return (
    <div className="site-page">
      <header className="site-header">
        <div className="site-header-inner">
          <Link className="site-brand" href="/es/">
            <span className="site-brand-mark" aria-hidden="true">
              <SignalIcon />
            </span>
            <span className="site-brand-word">Professional Profile</span>
          </Link>
          <nav className="site-nav" aria-label="Principal">
            {isSignedIn ? (
              <Link className="nav-link" href="/es/app/">
                Abrir perfil
              </Link>
            ) : (
              <>
                <Link className="nav-link nav-link--quiet" href="/es/login/">
                  Iniciar sesión
                </Link>
                <Link className="nav-link" href="/es/register/">
                  Crear cuenta
                </Link>
              </>
            )}
            <Link className="nav-link nav-link--quiet" href="/" lang="en" hrefLang="en">
              EN
            </Link>
            <span className="nav-link nav-link--quiet" aria-current="true">
              ES
            </span>
          </nav>
        </div>
      </header>

      <main>
        <section className="landing-hero reveal" ref={heroRef} aria-labelledby="landing-title">
          <div className="landing-copy">
            <p className="eyebrow">Espacio privado para tu perfil profesional</p>
            <h1 id="landing-title">
              Un perfil profesional y un CV que llevan tu carrera adelante.
            </h1>
            <p>
              Professional Profile es un espacio tranquilo y privado donde tu perfil profesional y
              tu CV viven juntos, versionados y recuperables. Inicias sesión, mantienes cada campo
              al día y haces crecer tu CV a tu propio ritmo — nada sale de tu cuenta y nada se
              pierde.
            </p>
            <p>
              Cada guardado archiva en silencio la versión anterior de tu CV. Cuando un cambio sale
              mal, el historial de versiones te devuelve el texto anterior en un paso — la red de
              seguridad que te deja escribir con confianza.
            </p>
          </div>

          <div className="hero-figure">
            <Image
              className="hero-image"
              src="https://images.pexels.com/photos/3931641/pexels-photo-3931641.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&dpr=1"
              alt="Un equipo concentrado alrededor de una mesa, revisando documentos juntos"
              width={1200}
              height={800}
              priority
            />
          </div>
        </section>

        <section
          className="feature-section reveal"
          ref={featuresRef}
          aria-label="Lo que el espacio de trabajo te da"
        >
          <div className="feature-grid">
            <article className="feature-card">
              <UserIcon />
              <h2>Un espacio tranquilo</h2>
              <p className="auth-subtitle">
                Tus campos de perfil, tu CV y su historial de versiones comparten un lugar privado —
                sin exportaciones, sin copias regadas. Abres el espacio y todo lo que escribiste
                está exactamente donde lo dejaste.
              </p>
            </article>
            <article className="feature-card">
              <ShieldIcon />
              <h2>Sesiones que se cuidan solas</h2>
              <p className="auth-subtitle">
                Las sesiones se renuevan en silencio mientras estás activo y quedan amarradas a tu
                dispositivo. Cierras sesión cuando quieras y el acceso termina donde llegó el token
                — tu espacio espera, tus datos no se van.
              </p>
            </article>
            <article className="feature-card">
              <SignalIcon />
              <h2>Retrospectiva que habla claro</h2>
              <p className="auth-subtitle">
                Cada guardado, bloqueo o límite responde en palabras claras — qué pasó, por qué pasó
                y el siguiente paso exacto, para que ninguna pantalla te deje adivinando.
              </p>
            </article>
          </div>
        </section>

        <section className="trust-strip reveal" aria-label="Lo que el espacio te garantiza">
          <ul>
            <li>
              <strong>Tus datos son tuyos</strong>
              <span>Todo lo que escribes queda en tu cuenta, privado por construcción.</span>
            </li>
            <li>
              <strong>Acceso verificado</strong>
              <span>Cada cuenta se confirma por correo antes de poder iniciar sesión.</span>
            </li>
            <li>
              <strong>Calma por diseño</strong>
              <span>Guía clara y retroalimentación paciente, sin ruido visual.</span>
            </li>
          </ul>
        </section>

        <section className="feature-section reveal" aria-label="Cómo el espacio crece contigo">
          <div className="landing-copy">
            <h2>Hecho para la carrera larga, no para el primer empleo.</h2>
            <p>
              Un perfil profesional empieza como una página y crece contigo: el titular que abre
              puertas, la bio que suena como tú suenas y el CV que guarda toda su historia. En un
              mal día recuperas el texto de ayer y sigues escribiendo el de hoy — la cuenta
              recuerda, para que te concentres en la carrera.
            </p>
            <p>
              Hasta que decidas que un perfil está listo para verse, todo queda entre tu cuenta y
              tú. El espacio es privado por construcción: cuentas verificadas, pantallas tranquilas
              y tu historia profesional exactamente como la dejaste.
            </p>
          </div>
        </section>

        <section
          className="final-action reveal"
          ref={finalRefElement}
          aria-labelledby="closing-title-es"
        >
          <div className="final-action-panel">
            <h2 id="closing-title-es">Pon tu perfil en marcha.</h2>
            <p>
              {isSignedIn
                ? 'Vuelve a la app y continúa donde dejaste tu trabajo.'
                : 'Abre tu cuenta en minutos y dale a tu perfil profesional y a tu CV el espacio privado y versionado que merece tu carrera.'}
            </p>
            <div className="landing-actions">
              {isSignedIn ? (
                <Link className="button button-primary" href="/es/app/">
                  Abrir perfil
                </Link>
              ) : (
                <Link className="button button-primary" href="/es/register/">
                  Crear cuenta
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <p>&copy; 2026 Professional Profile.</p>
      </footer>
    </div>
  );
}
