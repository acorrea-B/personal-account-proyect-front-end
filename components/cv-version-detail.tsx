'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { ProblemError } from '@/lib/api/client';
import { cvLoadMessage, getVersionDetail, saveCvText } from '@/lib/api/cv';
import { type CvSaveResponse, type VersionDetail } from '@/lib/schemas/cv';

import { formatWhen } from './cv-timeline';
import { CheckIcon } from './icons';
import { Skeleton } from './skeleton';

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
}: {
  id: string;
  accessToken: string;
  currentUpdatedAt: string | undefined;
  onClose: () => void;
  onRestored: (saved: CvSaveResponse) => void;
}) {
  const [detail, setDetail] = useState<DetailState>({ status: 'loading' });
  const [saving, setSaving] = useState(false);
  const [restoredSaved, setRestoredSaved] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const loadDetail = useCallback(async () => {
    setDetail({ status: 'loading' });
    setNote(null);
    try {
      const data = await getVersionDetail(accessToken, id);
      setDetail({ status: 'ready', detail: data });
    } catch (error) {
      setDetail({
        status: 'error',
        message:
          error instanceof ProblemError
            ? cvLoadMessage(error.problem.status, error.problem.detail ?? error.problem.title)
            : 'The version failed to load. Please try again shortly.',
      });
    }
  }, [accessToken, id]);

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
          setNote(
            'The current cv changed while restoring — close the panel, reload the dashboard and try again.',
          );
          return;
        }
        if (error instanceof ProblemError) {
          setNote(cvLoadMessage(error.problem.status, error.problem.detail ?? error.problem.title));
        } else if (error instanceof DOMException && error.name === 'AbortError') {
          setNote('Request timed out. Please try again.');
        } else {
          setNote('The restore could not be completed. Please try again.');
        }
      }
    },
    [accessToken, currentUpdatedAt, onRestored, restoredSaved, saving],
  );

  return (
    <div
      className="cv-version-backdrop"
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
        className="cv-version-panel"
      >
        <div className="cv-version-head">
          <div>
            <p className="eyebrow">Version history · archived</p>
            <h2 id="cv-version-title" className="cv-version-heading">
              {detail.status === 'ready'
                ? `Version from ${formatWhen(detail.detail.archived_at)}`
                : 'Version'}
            </h2>
            {detail.status === 'ready' ? (
              <p className="eyebrow">origin {detail.detail.origin}</p>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="save-toast-dismiss"
            aria-label="Close the version detail"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {detail.status === 'loading' ? (
          <div className="cv-version-content" aria-label="Loading the version">
            <div className="skeleton-screen">
              <Skeleton width={140} height={12} />
              <Skeleton width="100%" height={12} />
              <Skeleton width="100%" height={12} />
              <Skeleton width="72%" height={12} />
              <Skeleton width="100%" height={12} />
            </div>
          </div>
        ) : detail.status === 'error' ? (
          <div className="cv-version-content">
            <div role="alert" className="form-error">
              <p>{detail.message}</p>
              <button
                type="button"
                className="button button-ghost"
                onClick={() => void loadDetail()}
              >
                Try again
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="cv-version-content" tabIndex={0}>
              {detail.detail.content}
            </div>
            <div className="cv-version-actions">
              {restoredSaved ? (
                <span role="status" className="cv-restored-note">
                  <CheckIcon /> <span>Version restored — it is now the current cv.</span>
                </span>
              ) : null}
              {note ? (
                <span role="alert" className="form-error">
                  {note}
                </span>
              ) : null}
              <div className="cv-version-row">
                <button
                  type="button"
                  className="button button-primary"
                  disabled={saving || restoredSaved}
                  onClick={() => detail.status === 'ready' && void restore(detail.detail)}
                >
                  {saving ? 'Restoring…' : restoredSaved ? 'Restored' : 'Restore this version'}
                </button>
                <CloseButton onClose={onClose} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// The close affordance stays a plain ghost button labeled for screen
// readers; it rides the actions row together with the restore action.
function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" className="button button-ghost" onClick={onClose}>
      Close
    </button>
  );
}
