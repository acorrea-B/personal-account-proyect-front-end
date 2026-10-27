import { Skeleton } from '@/components/skeleton';
import { ShieldIcon } from '@/components/icons';
import { type VersionSummary } from '@/lib/schemas/cv';

export type CvHistoryState =
  | { kind: 'loading' }
  | { kind: 'ready'; versions: VersionSummary[] }
  | { kind: 'error'; message: string; onRetry?: () => void };

// The archived_at rides as a short en-US stamp (locale pinned, minutes
// visible so two saves on the same day read apart).
export function formatWhen(archivedAt: string): string {
  const date = new Date(archivedAt);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

// The version history card of the dashboard rail (window 5): a timeline
// with the archived versions newest first. With an onSelect handler the
// entries turn interactive and open the detail dialog (window 6); without
// one they stay honest plain rows.
export function CvHistoryCard({
  state,
  onSelect,
}: {
  state: CvHistoryState;
  onSelect?: (id: string) => void;
}) {
  return (
    <li className="upcoming-item">
      <ShieldIcon />
      <div className="upcoming-copy">
        <strong>Version history</strong>
        {state.kind === 'loading' ? (
          <span>
            <Skeleton width={160} height={12} />
          </span>
        ) : state.kind === 'ready' ? (
          state.versions.length === 0 ? (
            <span>No archived versions yet — save the cv to start the history.</span>
          ) : (
            <ol className="cv-timeline" aria-label="Archived versions, newest first">
              {state.versions.map((version) => (
                <li key={version.id} className="cv-timeline-entry">
                  <span className="cv-timeline-dot" aria-hidden="true" />
                  <time className="cv-timeline-date" dateTime={version.archived_at}>
                    {formatWhen(version.archived_at)}
                  </time>
                  {/* The view action is icon-only (the eye always means view
                      detail), separated from the timeline text row so the
                      spine stays clean. */}
                  <button
                    type="button"
                    className="cv-timeline-view"
                    aria-label={`View the version archived ${formatWhen(version.archived_at)}`}
                    disabled={!onSelect}
                    onClick={() => onSelect?.(version.id)}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M2.06 13.35a1 1 0 0 1 0-1.7 15.05 15.05 0 0 1 19.88 0 1 1 0 0 1 0 1.7 15.05 15.05 0 0 1-19.88 0Z" />
                      <circle cx="12" cy="12.5" r="3" />
                    </svg>
                  </button>
                </li>
              ))}
            </ol>
          )
        ) : (
          <>
            <span role="alert">{state.message}</span>
            {state.onRetry ? (
              <button type="button" className="button button-ghost" onClick={state.onRetry}>
                Try again
              </button>
            ) : null}
          </>
        )}
      </div>
    </li>
  );
}
