'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { ProblemError } from '@/lib/api/client';
import { cvLoadMessage, fetchCvText, getVersions } from '@/lib/api/cv';
import { fetchProfile, isProfileIncomplete } from '@/lib/api/profile';
import { loadSession, refreshSession } from '@/lib/auth/session';
import type { Profile } from '@/lib/schemas/profile';
import { labels, tr } from '@/lib/i18n';
import { useRequireAuth } from '@/lib/auth/useRequireAuth';
import { AccountMenu } from '@/components/account-menu';
import { ClampedText } from '@/components/clamped-text';
import { CvCard, type CvCardState } from '@/components/cv-card';
import { CvHistoryCard, type CvHistoryState } from '@/components/cv-timeline';
import { Skeleton } from '@/components/skeleton';
import { SignalIcon } from '@/components/icons';

type WorkspaceLoad =
  | { status: 'loading' }
  | { status: 'ready'; profile: Profile }
  | { status: 'error'; error: string };

const labelsT = labels('es');

// The dashboard of the es tree: the same structure as the english
// workspace, with the page strings in spanish and the shared components
// reading their labels through the dictionary via the locale prop.
export default function AppEsPage() {
  const { isHydrated, isAuthorized, session } = useRequireAuth();
  const accessToken = session?.accessToken ?? null;
  const router = useRouter();

  const [load, setLoad] = useState<WorkspaceLoad>({ status: 'loading' });
  const [cvCard, setCvCard] = useState<CvCardState>({ kind: 'loading' });
  const [history, setHistory] = useState<CvHistoryState>({ kind: 'loading' });

  const loadProfile = useCallback(
    async (token: string, viaRenewal = false) => {
      setLoad({ status: 'loading' });
      try {
        const profile = await fetchProfile(token);
        if (isProfileIncomplete(profile)) {
          router.replace('/es/app/profile/');
          setLoad({ status: 'loading' });
          return;
        }
        setLoad({ status: 'ready', profile });
      } catch (error) {
        if (error instanceof ProblemError && error.problem.status === 401 && !viaRenewal) {
          const kept = loadSession();
          if (kept?.refreshToken) {
            try {
              const next = await refreshSession();
              if (next) {
                return loadProfile(next.accessToken, true);
              }
            } catch {
              // fall through: keep the session, report the failure below
            }
          }
          setLoad({
            status: 'error',
            error:
              'El servicio no aceptó la credencial por el momento. Tu sesión se conserva; reintenta en un momento.',
          });
          return;
        }
        if (error instanceof ProblemError) {
          setLoad({
            status: 'error',
            error: `${error.problem.detail ?? labelsT.versionDetail.viewFallback} — reintenta en un momento.`,
          });
          return;
        }
        if (error instanceof DOMException && error.name === 'AbortError') {
          setLoad({
            status: 'error',
            error: 'La petición agotó el tiempo de espera. Inténtalo de nuevo.',
          });
          return;
        }
        setLoad({
          status: 'error',
          error: 'La respuesta del perfil no se entendió. Reintenta o repórtalo.',
        });
      }
    },
    [router],
  );

  const loadCv = useCallback(async (token: string) => {
    try {
      const cv = await fetchCvText(token);
      setCvCard({ kind: 'ready', cv });
    } catch (error) {
      if (error instanceof ProblemError && error.problem.status === 404) {
        setCvCard({ kind: 'empty' });
        return;
      }
      setCvCard({
        kind: 'error',
        message:
          error instanceof ProblemError
            ? cvLoadMessage(error.problem.status, error.problem.detail ?? error.problem.title)
            : 'El CV no cargó. Inténtalo de nuevo.',
      });
    }
  }, []);

  const loadHistory = useCallback(async (token: string) => {
    setHistory({ kind: 'loading' });
    try {
      const versions = await getVersions(token);
      setHistory({ kind: 'ready', versions });
    } catch (error) {
      setHistory({
        kind: 'error',
        message: cvLoadMessage(error instanceof ProblemError ? error.problem.status : undefined),
        onRetry: () => loadHistory(token),
      });
    }
  }, []);

  useEffect(() => {
    if (isHydrated && isAuthorized && accessToken) {
      loadProfile(accessToken);
      // El cv y el historial corren en paralelo con el perfil: el panel
      // nunca espera a las tarjetas del rail, cada una con su reintento.
      loadCv(accessToken);
      loadHistory(accessToken);
    }
  }, [isHydrated, isAuthorized, accessToken, loadProfile, loadCv, loadHistory]);

  if (!isHydrated || !isAuthorized || load.status === 'loading') {
    return (
      <main className="workspace-page" aria-busy="true">
        <WorkspaceSkeleton />
      </main>
    );
  }

  const profile = load.status === 'ready' ? load.profile : null;
  const firstName = profile ? profile.full_name.trim().split(/\s+/)[0] : '';

  return (
    <main className="workspace-page">
      <div className="content-resolve">
        <header className="workspace-bar">
          <div className="workspace-identity">
            <p className="eyebrow">Tu espacio</p>
            <h1 className="workspace-title">
              {firstName ? `Hola, ${firstName}.` : 'Tu espacio de trabajo'}
            </h1>
            <p className="auth-subtitle">Sesión iniciada como {session?.user.email}</p>
          </div>
          <AccountMenu locale="es" />
        </header>

        {load.status === 'error' ? (
          <section className="profile-panel">
            <div role="alert" className="form-error">
              <p>{load.error}</p>
              <button
                type="button"
                className="button button-ghost"
                onClick={() => accessToken && loadProfile(accessToken)}
              >
                {labelsT.cvCard.retry}
              </button>
            </div>
          </section>
        ) : null}

        {load.status === 'ready' && profile ? (
          <div className="dashboard-grid">
            <section className="profile-panel" aria-label="Tu perfil">
              <div className="panel-head">
                <p className="eyebrow">{labelsT.panel.eyebrow}</p>
                <Link className="link" href="/es/app/profile/">
                  {labelsT.panel.updateLink}
                </Link>
              </div>

              <dl className="profile-grid">
                <div>
                  <dt>{labelsT.panel.fullName}</dt>
                  <dd className="profile-headline">{profile.full_name}</dd>
                </div>
                {profile.headline ? (
                  <div>
                    <dt>{labelsT.panel.headline}</dt>
                    <dd>{profile.headline}</dd>
                  </div>
                ) : null}
                {profile.location ? (
                  <div>
                    <dt>{labelsT.panel.location}</dt>
                    <dd>{profile.location}</dd>
                  </div>
                ) : null}
              </dl>

              {profile.bio ? (
                <div>
                  <p className="eyebrow">{labelsT.panel.bio}</p>
                  <ClampedText text={profile.bio} className="clamped-text" locale="es" />
                </div>
              ) : null}

              {profile.skills ? (
                <div>
                  <p className="eyebrow">{labelsT.panel.skills}</p>
                  <ul className="skill-chips" aria-label={labelsT.panel.skills}>
                    {profile.skills.map((skill) => (
                      <li key={skill.toLowerCase()}>{skill}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {profile.links ? (
                <div>
                  <p className="eyebrow">{labelsT.panel.links}</p>
                  <ul className="profile-links" aria-label={labelsT.panel.links}>
                    {profile.links.map((link) => (
                      <li key={link.url}>
                        <a
                          className="link"
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {link.type}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <p className="auth-form-note">
                {tr(labelsT.panel.updatedNote, { date: profile.updated_at })}
              </p>
            </section>

            <aside className="upcoming-panel" aria-label="Lo que viene a tu espacio">
              <p className="eyebrow">{labelsT.panel.comingUp}</p>
              <ul className="upcoming-list">
                <CvCard state={cvCard} locale="es" />
                <CvHistoryCard state={history} locale="es" />
                <li className="upcoming-item">
                  <SignalIcon />
                  <div className="upcoming-copy">
                    <strong>Sugerencias de habilidades</strong>
                    <span>Inferidas de lo que la api ya sabe de ti.</span>
                    <span className="status-chip">Después de beta 1</span>
                  </div>
                </li>
              </ul>
            </aside>
          </div>
        ) : null}
      </div>
    </main>
  );
}

// The skeleton mirrors the english dashboard's skeleton shape.
function WorkspaceSkeleton() {
  return (
    <>
      <div className="skeleton-bar">
        <div className="skeleton-screen">
          <Skeleton width={110} height={11} />
          <Skeleton width={280} height={28} />
          <Skeleton width={210} height={14} />
        </div>
        <div className="workspace-actions">
          <Skeleton width={40} height={40} />
          <Skeleton width={92} height={36} />
        </div>
      </div>
      <div className="dashboard-grid">
        <div className="profile-panel">
          <div className="skeleton-screen">
            <Skeleton width={150} height={12} />
            <Skeleton width="100%" height={16} />
            <Skeleton width="70%" height={16} />
            <Skeleton width="55%" height={16} />
            <Skeleton width="85%" height={16} />
          </div>
        </div>
        <div className="upcoming-panel">
          <div className="skeleton-screen">
            <Skeleton width={90} height={12} />
            <Skeleton width="100%" height={44} />
            <Skeleton width="100%" height={44} />
            <Skeleton width="100%" height={44} />
          </div>
        </div>
      </div>
    </>
  );
}
