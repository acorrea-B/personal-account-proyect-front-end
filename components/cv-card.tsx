import Link from 'next/link';

import { Skeleton } from '@/components/skeleton';
import { ProfileIcon } from '@/components/icons';
import { type Cv } from '@/lib/schemas/cv';
import { formatWhen } from './cv-timeline';
import { labels, tr, type Locale } from '@/lib/i18n';
import { RailItem, RailTitle, cx, ghostButton, linkClass, railText } from '@/components/ui';

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
// will power a proper full page. Both editor actions hang from the tree's
// base prefix: they were pinned to /app/cv and the es tree's taps landed
// on the english editor - the language switched under the user's finger.
const previewLimit = 280;

function cvPreview(content: string): string {
  const trimmed = content.trim();
  return trimmed.length > previewLimit ? `${trimmed.slice(0, previewLimit).trimEnd()}…` : trimmed;
}

// .cv-card-actions: the hairline row under the card copy.
const cardActions = 'mt-8 w-full border-t border-stone-border pt-12';

export function CvCard({ state, locale = 'en' }: { state: CvCardState; locale?: Locale }) {
  const labelsT = labels(locale);
  const editorHref = `${locale === 'es' ? '/es' : ''}/app/cv/`;
  return (
    <RailItem icon={ProfileIcon}>
      <RailTitle>{labelsT.cvCard.title}</RailTitle>
      {state.kind === 'loading' ? (
        <span className={railText}>
          <Skeleton width={150} height={12} />
        </span>
      ) : state.kind === 'ready' ? (
        <>
          <span className={cx(railText, 'block [overflow-wrap:anywhere] whitespace-pre-line')}>
            {cvPreview(state.cv.content)}
          </span>
          <span className={railText}>
            {tr(labelsT.cvCard.lastSaved, { date: formatWhen(state.cv.updated_at) })}
          </span>
          <div className={cardActions}>
            <Link className={linkClass} href={editorHref}>
              {labelsT.cvCard.edit}
            </Link>
          </div>
        </>
      ) : state.kind === 'empty' ? (
        <>
          <span className={railText}>{labelsT.cvCard.empty}</span>
          <div className={cardActions}>
            <Link className={linkClass} href={editorHref}>
              {labelsT.cvCard.write}
            </Link>
          </div>
        </>
      ) : (
        <>
          <span role="alert" className={railText}>
            {state.message}
          </span>
          {state.onRetry ? (
            <button type="button" className={ghostButton} onClick={state.onRetry}>
              {labelsT.cvCard.retry}
            </button>
          ) : null}
        </>
      )}
    </RailItem>
  );
}
