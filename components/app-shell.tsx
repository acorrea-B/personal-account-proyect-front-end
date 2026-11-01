'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType, ReactNode } from 'react';

import {
  ChevronLeftIcon,
  DocumentIcon,
  HomeIcon,
  JournalIcon,
  ProfileIcon,
  TrendIcon,
  type IconProps,
} from '@/components/icons';
import { cx, linkClass } from '@/components/ui';
import { type Locale, labels, tr } from '@/lib/i18n';
import { usePendingSuggestions } from '@/lib/suggestions-signal';

type Section = 'home' | 'profile' | 'cv' | 'journal' | 'evolution';

// The workspace sections in menu order, each with its path under the
// locale tree's /app root.
const sections: { key: Section; path: string; icon: ComponentType<IconProps> }[] = [
  { key: 'home', path: '/app/', icon: HomeIcon },
  { key: 'profile', path: '/app/profile/', icon: ProfileIcon },
  { key: 'cv', path: '/app/cv/', icon: DocumentIcon },
  { key: 'journal', path: '/app/journal/', icon: JournalIcon },
  { key: 'evolution', path: '/app/evolution/', icon: TrendIcon },
];

// The section a pathname belongs to: the locale prefix and the trailing
// slash never change the answer; a path outside /app names none.
export function activeSection(pathname: string | null): Section | null {
  if (!pathname) {
    return null;
  }
  const path = `${pathname.replace(/^\/es(?=\/|$)/, '').replace(/\/+$/, '')}/`;
  const match = sections
    .filter((section) => path === section.path || path.startsWith(section.path))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return match?.key ?? null;
}

// The workspace menu: every signed-in page carries it, so any flow is one
// step from the others. A column beside the content on wide screens; on a
// phone it sits above the content as a row of wrapping buttons. The profile
// item carries a marker while suggestions wait there (a call to action,
// with its count in text for assistive tech).
export function AppNav({ locale }: { locale: Locale }) {
  const t = labels(locale).nav;
  const base = locale === 'es' ? '/es' : '';
  const active = activeSection(usePathname());
  const pending = usePendingSuggestions();
  // Each section marks what waits in it: skills in the profile, CV
  // improvements on the CV page.
  const marked = (key: Section) =>
    key === 'profile' ? pending.skills : key === 'cv' ? pending.cv : 0;
  return (
    <nav aria-label={t.label} className="min-w-0">
      <ul className="m-0 grid list-none gap-4 p-0 max-md:flex max-md:flex-wrap">
        {sections.map(({ key, path, icon: ItemIcon }) => {
          const current = key === active;
          return (
            <li key={key} className="max-md:flex-[1_1_140px]">
              <Link
                href={`${base}${path}`}
                aria-current={current ? 'page' : undefined}
                className={cx(
                  'flex min-h-[44px] items-center gap-12 rounded-lg px-12 text-[14px] no-underline transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-signal',
                  current
                    ? 'bg-sky-wash-soft font-semibold text-cyan-text-strong'
                    : 'font-medium text-soot hover:bg-stone-canvas',
                )}
              >
                <ItemIcon className="size-[18px] flex-none" />
                {t[key]}
                {marked(key) > 0 ? (
                  <>
                    <span aria-hidden="true" className="relative ml-auto flex size-[10px]">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-cyan-signal opacity-60 motion-reduce:animate-none" />
                      <span className="relative inline-flex size-[10px] rounded-full bg-cyan-signal" />
                    </span>
                    <span className="sr-only">
                      {tr(t.pendingAria, { count: String(marked(key)) })}
                    </span>
                  </>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// The way back to the home summary, above the content of an inner page.
export function BackLink({ locale }: { locale: Locale }) {
  const base = locale === 'es' ? '/es' : '';
  return (
    <Link
      href={`${base}/app/`}
      className={cx(linkClass, 'inline-flex min-h-[44px] items-center gap-4 justify-self-start')}
    >
      <ChevronLeftIcon className="size-[16px]" />
      {labels(locale).nav.back}
    </Link>
  );
}

// The signed-in page frame: the menu beside the page's main content. Inner
// pages pass `back` to lead with the way home; `busy` marks the content
// while it loads, as the workspace page did.
export function AppShell({
  locale,
  back,
  busy,
  children,
}: {
  locale: Locale;
  back?: boolean;
  busy?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto grid min-h-screen w-full max-w-page grid-cols-[200px_minmax(0,1fr)] content-start items-start gap-32 p-24 max-md:grid-cols-1 max-md:gap-24">
      <AppNav locale={locale} />
      <main className="grid min-w-0 content-start gap-32" aria-busy={busy ? 'true' : undefined}>
        {back ? <BackLink locale={locale} /> : null}
        {children}
      </main>
    </div>
  );
}
