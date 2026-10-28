'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { ProblemError } from '@/lib/api/client';
import { fetchCvText, saveCvText } from '@/lib/api/cv';
import { maxCvContentBytes, type CvMeta } from '@/lib/schemas/cv';
import { type Locale, labels, tr } from '@/lib/i18n';
import { useRequireAuth } from '@/lib/auth/useRequireAuth';
import { AccountMenu } from '@/components/account-menu';
import { CheckIcon, HomeIcon } from '@/components/icons';
import { Skeleton } from '@/components/skeleton';

type CvEditorLoad =
  { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string };

type SaveState = { status: 'idle' | 'saving' | 'saved'; note?: string };

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

// The shared cv editor: one implementation serves both locale trees with
// every string from the json dictionaries and the routes hanging from the
// tree's base prefix. The save branch keeps the contract answers: 412
// names the conflict and keeps the draft (no silent replacement), 413
// names the byte ceiling with the real ceiling, and 429 names the save
// cap (the en mirror routed saves into the read table - both trees now
// speak the save cap). The read-path problem details keep the api's
// english voice composed with the tree's detail suffix.
export function CvEditorView({ locale }: { locale: Locale }) {
  const t = labels(locale);
  const base = locale === 'es' ? '/es' : '';
  const { isHydrated, isAuthorized, session } = useRequireAuth();
  const accessToken = session?.accessToken ?? null;

  const [load, setLoad] = useState<CvEditorLoad>({ status: 'loading' });
  const [content, setContent] = useState('');
  const [meta, setMeta] = useState<CvMeta | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [save, setSave] = useState<SaveState>({ status: 'idle' });
  // The save toast mirrors the profile card: pinned to the bottom of the
  // viewport for five seconds, hand-dismissable meanwhile.
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (!showToast) {
      return;
    }
    const timer = window.setTimeout(() => setShowToast(false), 5000);
    return () => window.clearTimeout(timer);
  }, [showToast]);

  useEffect(() => {
    if (save.status !== 'saved') {
      return;
    }
    const timer = window.setTimeout(() => setSave({ status: 'idle' }), 3500);
    return () => window.clearTimeout(timer);
  }, [save.status]);

  const loadCv = useCallback(
    async (token: string) => {
      setLoad({ status: 'loading' });
      try {
        const cv = await fetchCvText(token);
        setContent(cv.content);
        setMeta({ id: cv.id, updated_at: cv.updated_at });
        setNote(null);
        setStale(false);
        setLoad({ status: 'ready' });
      } catch (error) {
        if (error instanceof ProblemError && error.problem.status === 404) {
          // The contract's "no cv yet": the editor opens empty with no
          // optimistic header on the first save.
          setContent('');
          setMeta(null);
          setLoad({ status: 'ready' });
          return;
        }
        if (error instanceof ProblemError && error.problem.status === 429) {
          setLoad({ status: 'error', message: t.cvEditor.loadRateCapped });
          return;
        }
        if (error instanceof ProblemError && error.problem.status === 401) {
          setLoad({ status: 'error', message: t.workspace.serviceDeclined });
          return;
        }
        setLoad({
          status: 'error',
          message:
            error instanceof ProblemError
              ? readFallback(error) + t.workspace.detailSuffix
              : error instanceof DOMException && error.name === 'AbortError'
                ? t.workspace.cvTimeout
                : t.cvEditor.loadFallback,
        });
      }
    },
    [t],
  );

  useEffect(() => {
    if (isHydrated && isAuthorized && accessToken) {
      loadCv(accessToken);
    }
  }, [isHydrated, isAuthorized, accessToken, loadCv]);

  const bytes = utf8ByteLength(content);
  const overLimit = bytes > maxCvContentBytes;

  const saveCv = useCallback(async () => {
    if (!accessToken || save.status === 'saving') {
      return;
    }
    setSave({ status: 'saving', note: undefined });
    try {
      const savedMeta = await saveCvText(accessToken, content, meta?.updated_at);
      setMeta(savedMeta.cv);
      setNote(savedMeta.previous_version_archived ? t.cvEditor.savedNote : null);
      setStale(false);
      setShowToast(true);
      setSave({ status: 'saved' });
      return;
    } catch (error) {
      setShowToast(false);
      if (error instanceof ProblemError && error.problem.status === 412) {
        // The optimistic lock: the user's draft stays untouched (no silent
        // replacement of their typing); they reload the latest by hand.
        setStale(true);
        setSave({ status: 'idle' });
        return;
      }
      if (error instanceof ProblemError && error.problem.status === 413) {
        setNote(
          tr(t.cvEditor.limitNote, {
            bytes: String(error.problem.max_bytes ?? maxCvContentBytes),
          }),
        );
        setSave({ status: 'idle' });
        return;
      }
      if (error instanceof ProblemError && error.problem.status === 429) {
        setNote(t.cvEditor.saveRateCapped);
      } else if (error instanceof ProblemError) {
        setNote(error.problem.detail ?? error.problem.title ?? t.cvEditor.saveFallback);
      } else if (error instanceof DOMException && error.name === 'AbortError') {
        setNote(t.workspace.cvTimeout);
      } else {
        setNote(t.cvEditor.saveFallback);
      }
      setSave({ status: 'idle' });
    }
  }, [accessToken, content, meta?.updated_at, save.status, t]);

  if (!isHydrated || !isAuthorized || load.status === 'loading') {
    return (
      <main className="workspace-page" aria-busy="true">
        <div className="content-resolve">
          <header className="workspace-bar">
            <div className="workspace-identity">
              <p className="eyebrow">{t.workspace.eyebrow}</p>
              <h1 className="workspace-title">{t.cvEditor.title}</h1>
            </div>
          </header>
          <section className="auth-card cv-editor-card" aria-label={t.cvEditor.loadingAria}>
            <div className="skeleton-screen">
              <Skeleton width={140} height={16} />
              <Skeleton width="100%" height={340} />
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="workspace-page">
      <div className="content-resolve">
        <header className="workspace-bar">
          <div className="workspace-identity">
            <p className="eyebrow">{t.workspace.eyebrow}</p>
            <h1 className="workspace-title">{t.cvEditor.title}</h1>
          </div>
          <AccountMenu locale={locale} />
        </header>

        {load.status === 'error' ? (
          <section className="auth-card cv-editor-card">
            <div role="alert" className="form-error">
              <p>{load.message}</p>
              <button
                type="button"
                className="button button-ghost"
                onClick={() => accessToken && loadCv(accessToken)}
              >
                {t.cvCard.retry}
              </button>
            </div>
          </section>
        ) : (
          <section className="auth-card cv-editor-card" aria-label={t.cvEditor.title}>
            {load.status === 'ready' ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveCv();
                }}
              >
                <p className="eyebrow">
                  {meta
                    ? tr(t.cvEditor.currentVersionSaved, { date: meta.updated_at })
                    : t.cvEditor.firstVersion}
                </p>
                <div className="cv-editor-block">
                  <textarea
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    rows={18}
                    aria-label={t.cvEditor.textareaAria}
                    aria-describedby="cv-byte-counter"
                    aria-invalid={overLimit}
                    placeholder={t.cvEditor.placeholder}
                  />
                  <p className="cv-editor-meta">
                    <span
                      id="cv-byte-counter"
                      className={
                        overLimit ? 'cv-editor-counter cv-editor-counter-over' : 'cv-editor-counter'
                      }
                    >
                      {bytes} / {maxCvContentBytes} bytes
                    </span>
                    {note ? (
                      <span role="status" className="form-note">
                        {note}
                      </span>
                    ) : null}
                    {stale ? (
                      <span role="alert" className="form-error">
                        {t.cvEditor.stale}
                        <button
                          type="button"
                          className="button button-ghost"
                          onClick={() => accessToken && loadCv(accessToken)}
                        >
                          {t.cvEditor.reloadAction}
                        </button>
                      </span>
                    ) : null}
                  </p>
                </div>

                <div className="landing-actions">
                  <button
                    type="submit"
                    className="button button-primary"
                    disabled={save.status === 'saving' || overLimit}
                  >
                    {save.status === 'saving'
                      ? t.cvEditor.saving
                      : save.status === 'saved'
                        ? t.cvEditor.saved
                        : t.cvEditor.save}
                  </button>
                  {/* The persistent way back: never tied to the toast's
                      five seconds, so the exit does not vanish with it. */}
                  <Link className="button button-ghost" href={`${base}/app/`}>
                    <HomeIcon /> {t.cvEditor.back}
                  </Link>
                </div>
              </form>
            ) : null}
          </section>
        )}
      </div>

      {showToast ? (
        <div role="status" className="save-toast">
          <CheckIcon />
          <p>{t.versionDetail.restoredNote}</p>
          <button
            type="button"
            className="save-toast-dismiss"
            aria-label={t.versionDetail.dismiss}
            onClick={() => setShowToast(false)}
          >
            ✕
          </button>
        </div>
      ) : null}
    </main>
  );
}

// Reads the problem's detail or title; a missing one degrades to undefined
// for the caller's fallback composition.
function readFallback(error: unknown): string | undefined {
  return error instanceof ProblemError ? (error.problem.detail ?? error.problem.title) : undefined;
}
