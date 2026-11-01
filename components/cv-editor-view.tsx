'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ProblemError } from '@/lib/api/client';
import { fetchCvText, saveCvText } from '@/lib/api/cv';
import { maxCvContentBytes, type CvMeta } from '@/lib/schemas/cv';
import { type Locale, labels, tr } from '@/lib/i18n';
import { useRequireAuth } from '@/lib/auth/useRequireAuth';
import { AccountMenu } from '@/components/account-menu';
import { AppShell } from '@/components/app-shell';
import { CvHistoryPanel } from '@/components/cv-history-panel';
import {
  AuthForm,
  Eyebrow,
  SaveToast,
  WorkspaceBar,
  WorkspaceTitle,
  cx,
  contentResolve,
  ghostButton,
  inlineAlert,
  inlineNote,
  primaryButton,
} from '@/components/ui';
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
  // Bumped when a save archives the previous version: the history beside
  // the editor reads the versions again.
  const [historyKey, setHistoryKey] = useState(0);

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

  // Loads once per visit: the session renews the access token in the
  // background, and reloading on it would replace the draft being typed.
  const loaded = useRef(false);
  useEffect(() => {
    if (isHydrated && isAuthorized && accessToken && !loaded.current) {
      loaded.current = true;
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
      if (savedMeta.previous_version_archived) {
        setHistoryKey((key) => key + 1);
      }
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
      <AppShell locale={locale} back busy>
        <div className={cx(contentResolve, 'grid gap-32')}>
          <WorkspaceBar
            identity={
              <>
                <Eyebrow>{t.workspace.eyebrow}</Eyebrow>
                <WorkspaceTitle>{t.cvEditor.title}</WorkspaceTitle>
              </>
            }
          >
            {null}
          </WorkspaceBar>
          <section className={editorCard} aria-label={t.cvEditor.loadingAria}>
            <div className="grid gap-12">
              <Skeleton width={140} height={16} />
              <Skeleton width="100%" height={340} />
            </div>
          </section>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell locale={locale} back>
      <div className={cx(contentResolve, 'grid gap-32')}>
        <WorkspaceBar
          identity={
            <>
              <Eyebrow>{t.workspace.eyebrow}</Eyebrow>
              <WorkspaceTitle>{t.cvEditor.title}</WorkspaceTitle>
            </>
          }
        >
          <AccountMenu locale={locale} />
        </WorkspaceBar>

        <div className={cvGrid}>
          {load.status === 'error' ? (
            <section className={editorCard}>
              <div role="alert" className={inlineAlert}>
                <p>{load.message}</p>
                <button
                  type="button"
                  className={ghostButton}
                  onClick={() => accessToken && loadCv(accessToken)}
                >
                  {t.cvCard.retry}
                </button>
              </div>
            </section>
          ) : (
            <section className={editorCard} aria-label={t.cvEditor.title}>
              {load.status === 'ready' ? (
                <AuthForm
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveCv();
                  }}
                >
                  <Eyebrow>
                    {meta
                      ? tr(t.cvEditor.currentVersionSaved, { date: meta.updated_at })
                      : t.cvEditor.firstVersion}
                  </Eyebrow>
                  <div>
                    <textarea
                      className="block min-h-[340px] w-full max-w-full resize-y text-(length:--text-body-md) leading-[1.6] whitespace-pre-wrap aria-invalid:border-alert focus-visible:border-cyan-text! focus-visible:shadow-[0_0_0_3px_var(--color-sky-wash)] focus-visible:outline-none max-md:min-h-[260px]"
                      value={content}
                      onChange={(event) => setContent(event.target.value)}
                      rows={18}
                      aria-label={t.cvEditor.textareaAria}
                      aria-describedby="cv-byte-counter"
                      aria-invalid={overLimit}
                      placeholder={t.cvEditor.placeholder}
                    />
                    <p>
                      <span
                        id="cv-byte-counter"
                        className={cx(
                          'text-(length:--text-body-md) tabular-nums',
                          overLimit ? 'font-medium text-alert' : 'text-ink-black',
                        )}
                      >
                        {tr(t.cvEditor.byteCounter, {
                          bytes: String(bytes),
                          max: String(maxCvContentBytes),
                        })}
                      </span>
                      {note ? (
                        <span role="status" className={inlineNote}>
                          {note}
                        </span>
                      ) : null}
                      {stale ? (
                        <span role="alert" className={inlineAlert}>
                          {t.cvEditor.stale}
                          <button
                            type="button"
                            className={ghostButton}
                            onClick={() => accessToken && loadCv(accessToken)}
                          >
                            {t.cvEditor.reloadAction}
                          </button>
                        </span>
                      ) : null}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-8 max-sm:flex-col max-sm:items-stretch">
                    <button
                      type="submit"
                      className={cx(primaryButton, 'max-sm:w-full')}
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
                    <Link className={cx(ghostButton, 'max-sm:w-full')} href={`${base}/app/`}>
                      <HomeIcon /> {t.cvEditor.back}
                    </Link>
                  </div>
                </AuthForm>
              ) : null}
            </section>
          )}
          {accessToken ? (
            <CvHistoryPanel
              accessToken={accessToken}
              locale={locale}
              currentUpdatedAt={meta?.updated_at}
              refreshKey={historyKey}
              onRestored={() => {
                setHistoryKey((key) => key + 1);
                if (accessToken) {
                  void loadCv(accessToken);
                }
              }}
            />
          ) : null}
        </div>
      </div>

      {showToast ? (
        <SaveToast
          icon={CheckIcon}
          dismissLabel={t.versionDetail.dismiss}
          onDismiss={() => setShowToast(false)}
        >
          {t.versionDetail.restoredNote}
        </SaveToast>
      ) : null}
    </AppShell>
  );
}

// .auth-card.cv-editor-card: the editor sheet, centered at 880px.
const editorCard =
  'mx-auto grid w-full max-w-[880px] gap-16 rounded-lg border border-stone-border bg-pure-white p-32 shadow-subtle max-sm:p-16';

// Reads the problem's detail or title; a missing one degrades to undefined
// for the caller's fallback composition.
function readFallback(error: unknown): string | undefined {
  return error instanceof ProblemError ? (error.problem.detail ?? error.problem.title) : undefined;
}

// The editor beside its version history; stacked under 860px.
const cvGrid =
  'grid grid-cols-[minmax(0,1.6fr)_minmax(260px,0.9fr)] items-start gap-16 max-md:grid-cols-1';
