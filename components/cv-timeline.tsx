import { Skeleton } from '@/components/skeleton';
import { ShieldIcon } from '@/components/icons';
import { type VersionSummary } from '@/lib/schemas/cv';
import { labels, tr, type Locale } from '@/lib/i18n';
import { RailItem, RailTitle, ghostButton, railText } from '@/components/ui';

export type CvHistoryState =
  | { kind: 'loading' }
  | { kind: 'ready'; versions: VersionSummary[] }
  | { kind: 'error'; message: string; onRetry?: () => void };

// A timestamp as a short stamp in the tree's language (minutes visible so
// two saves on the same day read apart): "Oct 26, 9:03 AM" on the en tree,
// "26 oct, 9:03 a. m." on the es tree.
const dateLocales: Record<Locale, string> = { en: 'en-US', es: 'es' };

export function formatWhen(archivedAt: string, locale: Locale = 'en'): string {
  const date = new Date(archivedAt);
  return new Intl.DateTimeFormat(dateLocales[locale], {
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
  locale = 'en',
}: {
  state: CvHistoryState;
  onSelect?: (id: string) => void;
  locale?: Locale;
}) {
  const labelsT = labels(locale);
  return (
    <RailItem icon={ShieldIcon}>
      <RailTitle>{labelsT.history.title}</RailTitle>
      {state.kind === 'loading' ? (
        <span className={railText}>
          <Skeleton width={160} height={12} />
        </span>
      ) : state.kind === 'ready' ? (
        state.versions.length === 0 ? (
          <span className={railText}>{labelsT.history.empty}</span>
        ) : (
          <ol
            className="m-0 flex list-none flex-col gap-4 p-0"
            aria-label={labelsT.history.listAria}
          >
            {state.versions.map((version) => (
              <li
                key={version.id}
                className="relative flex items-center gap-8 before:absolute before:top-[-14px] before:bottom-[14px] before:left-[5px] before:border-l before:border-stone-border before:content-[''] first:before:hidden"
              >
                <span
                  className="relative z-1 size-[10px] shrink-0 rounded-full bg-teal-text"
                  aria-hidden="true"
                />
                <time
                  className="text-(length:--text-body-md) text-ink-black tabular-nums"
                  dateTime={version.archived_at}
                >
                  {formatWhen(version.archived_at, locale)}
                </time>
                {/* The view action is icon-only (the eye always means view
                      detail), separated from the timeline text row so the
                      spine stays clean. */}
                <button
                  type="button"
                  className="ml-auto inline-flex size-[28px] shrink-0 cursor-pointer items-center justify-center self-center rounded-full border-none bg-teal-text text-pure-white transition-all duration-160 ease-[ease] hover:bg-teal-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-strong disabled:cursor-default disabled:opacity-40 max-sm:size-[44px] [&_svg]:mt-0 [&_svg]:size-[15px] [&_svg]:text-pure-white max-sm:[&_svg]:size-[17px]"
                  aria-label={tr(labelsT.history.viewLabel, {
                    date: formatWhen(version.archived_at, locale),
                  })}
                  disabled={!onSelect}
                  onClick={() => onSelect?.(version.id)}
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {/* A history glyph: the rewind arc plus the clock hands
                          - each dot is a moment, the action opens it. */}
                    <path d="M3 12a9 9 0 1 0 9-9-9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                    <path d="M12 7v5l4 2" />
                  </svg>
                </button>
              </li>
            ))}
          </ol>
        )
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
