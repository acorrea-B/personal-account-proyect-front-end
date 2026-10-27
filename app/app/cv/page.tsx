'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { ProblemError } from '@/lib/api/client';
import { cvLoadMessage, fetchCvText, saveCvText } from '@/lib/api/cv';
import { maxCvContentBytes, type CvMeta } from '@/lib/schemas/cv';
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

export default function CvEditorPage() {
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

  const loadCv = useCallback(async (token: string) => {
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
      setLoad({
        status: 'error',
        message:
          error instanceof ProblemError
            ? cvLoadMessage(error.problem.status, error.problem.detail ?? error.problem.title)
            : 'The cv failed to load. Please try again shortly.',
      });
    }
  }, []);

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
      setNote(
        savedMeta.previous_version_archived
          ? 'The previous version moved to the version history.'
          : null,
      );
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
          `The cv text is at most ${error.problem.max_bytes ?? maxCvContentBytes} bytes — trim it and save again.`,
        );
        setSave({ status: 'idle' });
        return;
      }
      if (error instanceof ProblemError) {
        setNote(cvLoadMessage(error.problem.status, error.problem.detail ?? error.problem.title));
      } else if (error instanceof DOMException && error.name === 'AbortError') {
        setNote('Request timed out. Please try again.');
      } else {
        setNote('The save could not be completed. Please try again.');
      }
      setSave({ status: 'idle' });
    }
  }, [accessToken, content, meta?.updated_at, save.status]);

  if (!isHydrated || !isAuthorized || load.status === 'loading') {
    return (
      <main className="workspace-page" aria-busy="true">
        <div className="content-resolve">
          <header className="workspace-bar">
            <div className="workspace-identity">
              <p className="eyebrow">Your workspace</p>
              <h1 className="workspace-title">CV editor</h1>
            </div>
          </header>
          <section className="auth-card cv-editor-card" aria-label="Loading your cv">
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
            <p className="eyebrow">Your workspace</p>
            <h1 className="workspace-title">CV editor</h1>
          </div>
          <AccountMenu />
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
                Try again
              </button>
            </div>
          </section>
        ) : (
          <section className="auth-card cv-editor-card" aria-label="CV editor">
            {load.status === 'ready' ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveCv();
                }}
              >
                <p className="eyebrow">
                  {meta ? `Current version saved ${meta.updated_at}` : 'Your first version'}
                </p>
                <div className="cv-editor-block">
                  <textarea
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    rows={18}
                    aria-label="CV text"
                    aria-describedby="cv-byte-counter"
                    aria-invalid={overLimit}
                    placeholder="Write your cv here — plain text, exactly as you want it."
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
                        Someone saved a newer version while you were editing. Your text stays in the
                        editor — reload the latest after copying what you need.
                        <button
                          type="button"
                          className="button button-ghost"
                          onClick={() => accessToken && loadCv(accessToken)}
                        >
                          Reload the latest version
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
                      ? 'Saving…'
                      : save.status === 'saved'
                        ? 'Saved'
                        : 'Save cv'}
                  </button>
                  {/* The persistent way back: never tied to the toast's
                      five seconds, so the exit does not vanish with it. */}
                  <Link className="button button-ghost" href="/app/">
                    <HomeIcon /> Back to workspace
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
          <p>Cv saved — the previous version moved to the history when there was one.</p>
          <button
            type="button"
            className="save-toast-dismiss"
            aria-label="Dismiss the saved confirmation"
            onClick={() => setShowToast(false)}
          >
            ✕
          </button>
        </div>
      ) : null}
    </main>
  );
}
