'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { ProblemError } from '@/lib/api/client';
import { getVersionDetail, saveCvText } from '@/lib/api/cv';
import { type CvSaveResponse, type VersionDetail } from '@/lib/schemas/cv';
import { labels, tr, type Locale } from '@/lib/i18n';

import { formatWhen } from './cv-timeline';
import { CheckIcon } from './icons';
import { Skeleton } from './skeleton';
import { Eyebrow, dismissButton, ghostButton, inlineAlert, primaryButton } from '@/components/ui';

type DetailState =
  | { status: 'loading' }
  | { status: 'ready'; detail: VersionDetail }
  | { status: 'error'; message: string };

// The version detail: a reading panel over the dashboard. The restore is a
// contract save (the archived content becomes the current cv and the current
// version archives itself), so the current updated_at travels optimistically
// and a concurrent write answers 412 instead of overwriting.
export function CvVersionDetail({
  id,
  accessToken,
  currentUpdatedAt,
  onClose,
  onRestored,
  locale = 'en',
}: {
  id: string;
  accessToken: string;
  currentUpdatedAt: string | undefined;
  onClose: () => void;
  onRestored: (saved: CvSaveResponse) => void;
  locale?: Locale;
}) {
  const labelsT = labels(locale);
  const [detail, setDetail] = useState<DetailState>({ status: 'loading' });
  const [saving, setSaving] = useState(false);
  const [restoredSaved, setRestoredSaved] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  // The detail's read/save failures speak the tree through the dictionary:
  // the api problem details ride the detail suffix composition (the
  // contract's english voice), every cap and fallback owns a label.
  const problemNote = useCallback(
    (error: unknown, fallback: string): string => {
      if (error instanceof ProblemError) {
        if (error.problem.status === 429) {
          return labelsT.workspace.cvRateCapped;
        }
        if (error.problem.status === 401) {
          return labelsT.workspace.serviceDeclined;
        }
        const detail =
          error.problem.detail ?? error.problem.title ?? labelsT.versionDetail.viewFallback;
        return `${detail}${labelsT.workspace.detailSuffix}`;
      }
      if (error instanceof DOMException && error.name === 'AbortError') {
        return labelsT.workspace.cvTimeout;
      }
      return fallback;
    },
    [labelsT],
  );

  const loadDetail = useCallback(async () => {
    setDetail({ status: 'loading' });
    setNote(null);
    try {
      const data = await getVersionDetail(accessToken, id);
      setDetail({ status: 'ready', detail: data });
    } catch (error) {
      setDetail({
        status: 'error',
        message: problemNote(error, labelsT.versionDetail.loadFallback),
      });
    }
  }, [accessToken, id, problemNote, labelsT.versionDetail]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    // Escape closes, the background stops scrolling under the reading
    // panel, and the close button takes the initial focus.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const restore = useCallback(
    async (ready: VersionDetail) => {
      if (saving || restoredSaved) {
        return;
      }
      setSaving(true);
      setNote(null);
      try {
        const saved = await saveCvText(accessToken, ready.content, currentUpdatedAt);
        setRestoredSaved(true);
        setSaving(false);
        onRestored(saved);
      } catch (error) {
        setSaving(false);
        if (error instanceof ProblemError && error.problem.status === 412) {
          setNote(labelsT.versionDetail.conflictNote);
          return;
        }
        setNote(problemNote(error, labelsT.versionDetail.restoreFallback));
      }
    },
    [
      accessToken,
      currentUpdatedAt,
      onRestored,
      restoredSaved,
      saving,
      problemNote,
      labelsT.versionDetail,
    ],
  );

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-[rgb(15_23_42/0.45)] p-16 backdrop-blur-[2px]"
      aria-hidden="false"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cv-version-title"
        className="flex max-h-[80vh] w-[min(720px,100%)] flex-col gap-16 rounded-lg border border-stone-border bg-pure-white p-24 shadow-xl"
      >
        <div className="flex items-start justify-between gap-8">
          <div>
            <Eyebrow>{labelsT.versionDetail.eyebrow}</Eyebrow>
            <h2
              id="cv-version-title"
              className="m-0 font-roobert text-heading-sm font-regular text-ink-black"
            >
              {detail.status === 'ready'
                ? tr(labelsT.versionDetail.viewHeading, {
                    date: formatWhen(detail.detail.archived_at, locale),
                  })
                : labelsT.versionDetail.viewFallback}
            </h2>
            {detail.status === 'ready' ? (
              <Eyebrow>
                {tr(labelsT.versionDetail.origin, { origin: detail.detail.origin })}
              </Eyebrow>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            className={dismissButton}
            aria-label={labelsT.versionDetail.close}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {detail.status === 'loading' ? (
          <div className={versionContent} aria-label={labelsT.versionDetail.loadingAria}>
            <div className="grid gap-12">
              <Skeleton width={140} height={12} />
              <Skeleton width="100%" height={12} />
              <Skeleton width="100%" height={12} />
              <Skeleton width="72%" height={12} />
              <Skeleton width="100%" height={12} />
            </div>
          </div>
        ) : detail.status === 'error' ? (
          <div className={versionContent}>
            <div role="alert" className={inlineAlert}>
              <p>{detail.message}</p>
              <button type="button" className={ghostButton} onClick={() => void loadDetail()}>
                {labelsT.cvCard.retry}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className={versionContent} tabIndex={0}>
              {detail.detail.content}
            </div>
            <div className="flex flex-col gap-8">
              {restoredSaved ? (
                <span
                  role="status"
                  className="flex items-center gap-4 text-(length:--text-body-md) text-ink-black"
                >
                  <CheckIcon /> <span>{labelsT.versionDetail.restored}</span>
                </span>
              ) : null}
              {note ? (
                <span role="alert" className={inlineAlert}>
                  {note}
                </span>
              ) : null}
              <div className="flex flex-wrap gap-8">
                <button
                  type="button"
                  className={primaryButton}
                  disabled={saving || restoredSaved}
                  onClick={() => detail.status === 'ready' && void restore(detail.detail)}
                >
                  {saving
                    ? labelsT.versionDetail.restoring
                    : restoredSaved
                      ? labelsT.versionDetail.restored
                      : labelsT.versionDetail.restore}
                </button>
                <CloseButton onClose={onClose} label={labelsT.versionDetail.close} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// .cv-version-content: the archived text on the canvas, scrolling inside
// the dialog.
const versionContent =
  'min-h-0 flex-1 overflow-y-auto rounded-lg border border-stone-border bg-stone-canvas p-16 text-(length:--text-body-md) leading-[1.7] [overflow-wrap:anywhere] whitespace-pre-wrap text-ink-black';

// The close affordance stays a plain ghost button labeled for screen
// readers; it rides the actions row together with the restore action.
function CloseButton({ onClose, label }: { onClose: () => void; label: string }) {
  return (
    <button type="button" className={ghostButton} onClick={onClose}>
      {label}
    </button>
  );
}
