import Link from 'next/link';

import { Skeleton } from '@/components/skeleton';
import { ProfileIcon } from '@/components/icons';
import { type Cv } from '@/lib/schemas/cv';
import { formatWhen } from './cv-timeline';
import { labels, tr, type Locale } from '@/lib/i18n';

export type CvCardState =
  | { kind: 'loading' }
  | { kind: 'ready'; cv: Cv }
  | { kind: 'empty' }
  | { kind: 'error'; message: string; onRetry?: () => void };

// The cv card of the dashboard rail: the real cv (window 2 of the cv
// stack) replacing the "Coming up" planned card. A cv can reach 51200
// bytes, so the rail carries a hard truncation instead of an unfolding
// clamp (a document reader does not belong in a rail) - the full text is
// one click away in the editor, and a future structured (html) api answer
// will power a proper full page.
const previewLimit = 280;

function cvPreview(content: string): string {
  const trimmed = content.trim();
  return trimmed.length > previewLimit ? `${trimmed.slice(0, previewLimit).trimEnd()}…` : trimmed;
}

export function CvCard({ state, locale = 'en' }: { state: CvCardState; locale?: Locale }) {
  const labelsT = labels(locale);
  return (
    <li className="upcoming-item">
      <ProfileIcon />
      <div className="upcoming-copy">
        <strong>{labelsT.cvCard.title}</strong>
        {state.kind === 'loading' ? (
          <span>
            <Skeleton width={150} height={12} />
          </span>
        ) : state.kind === 'ready' ? (
          <>
            <span className="cv-preview">{cvPreview(state.cv.content)}</span>
            <span>{tr(labelsT.cvCard.lastSaved, { date: formatWhen(state.cv.updated_at) })}</span>
            <div className="cv-card-actions">
              <Link className="link" href="/app/cv/">
                {labelsT.cvCard.edit}
              </Link>
            </div>
          </>
        ) : state.kind === 'empty' ? (
          <>
            <span>{labelsT.cvCard.empty}</span>
            <div className="cv-card-actions">
              <Link className="link" href="/app/cv/">
                {labelsT.cvCard.write}
              </Link>
            </div>
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
