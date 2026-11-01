'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { CvHistoryCard, type CvHistoryState } from '@/components/cv-timeline';
import { CvVersionDetail } from '@/components/cv-version-detail';
import { workspacePanel } from '@/components/ui';
import { ProblemError } from '@/lib/api/client';
import { getVersions } from '@/lib/api/cv';
import { type Locale, labels } from '@/lib/i18n';

// The cv page's version history: the archived versions beside the editor,
// each opening the detail dialog with its restore. It loads on mount and
// again whenever `refreshKey` changes (a save archived the previous
// version); a renewed access token alone never reloads it.
export function CvHistoryPanel({
  accessToken,
  locale,
  currentUpdatedAt,
  refreshKey,
  onRestored,
}: {
  accessToken: string;
  locale: Locale;
  currentUpdatedAt: string | undefined;
  refreshKey: number;
  onRestored: () => void;
}) {
  const t = labels(locale);
  const [history, setHistory] = useState<CvHistoryState>({ kind: 'loading' });
  const [detailId, setDetailId] = useState<string | null>(null);
  // Every load and retry reads the current token: a retry pressed after a
  // background renewal never resends the token of the failed request.
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;

  // Only the newest load may write the card: an older answer (a load
  // started before a save) never replaces the refreshed list.
  const request = useRef(0);

  const loadHistory = useCallback(async () => {
    const id = ++request.current;
    setHistory({ kind: 'loading' });
    try {
      const versions = await getVersions(tokenRef.current);
      if (id === request.current) {
        setHistory({ kind: 'ready', versions });
      }
    } catch (error) {
      if (id !== request.current) {
        return;
      }
      // The history failure stays inside its own card with a retry and
      // never touches the session.
      const message =
        error instanceof ProblemError
          ? error.problem.status === 401
            ? t.workspace.serviceDeclined
            : error.problem.status === 429
              ? t.workspace.cvRateCapped
              : `${error.problem.detail ?? error.problem.title ?? ''}${t.workspace.detailSuffix}`
          : t.workspace.historyFallback;
      setHistory({ kind: 'error', message, onRetry: () => void loadHistory() });
    }
  }, [t]);

  useEffect(() => {
    void loadHistory();
  }, [refreshKey, loadHistory]);

  return (
    <aside className={workspacePanel} aria-label={t.history.title}>
      <ul className="m-0 grid list-none p-0">
        <CvHistoryCard state={history} locale={locale} onSelect={setDetailId} />
      </ul>
      {detailId ? (
        <CvVersionDetail
          id={detailId}
          accessToken={accessToken}
          locale={locale}
          currentUpdatedAt={currentUpdatedAt}
          onClose={() => setDetailId(null)}
          onRestored={() => {
            setDetailId(null);
            onRestored();
          }}
        />
      ) : null}
    </aside>
  );
}
