import { ClampedText } from '@/components/clamped-text';
import { Skeleton } from '@/components/skeleton';
import { ProfileIcon } from '@/components/icons';
import { type Cv } from '@/lib/schemas/cv';

export type CvCardState =
  | { kind: 'loading' }
  | { kind: 'ready'; cv: Cv }
  | { kind: 'empty' }
  | { kind: 'error'; message: string; onRetry?: () => void };

// The cv card of the dashboard rail: the real cv (window 2 of the cv
// stack, read only) replacing the "Coming up" planned card. The editor
// entry point and the version history ride their own windows and turn
// this card into their hub.
export function CvCard({ state }: { state: CvCardState }) {
  return (
    <li className="upcoming-item">
      <ProfileIcon />
      <div className="upcoming-copy">
        <strong>CV</strong>
        {state.kind === 'loading' ? (
          <span>
            <Skeleton width={150} height={12} />
          </span>
        ) : state.kind === 'ready' ? (
          <>
            <ClampedText text={state.cv.content} lines={3} className="clamped-text" />
            <span>Last saved {state.cv.updated_at}</span>
            <span className="status-chip">Live</span>
          </>
        ) : state.kind === 'empty' ? (
          <>
            <span>No cv yet — write yours in the editor.</span>
            <span className="status-chip">Empty</span>
          </>
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
