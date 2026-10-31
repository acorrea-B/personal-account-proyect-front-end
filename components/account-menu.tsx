'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { menuLanguageSelectClass, swapLocalePath } from '@/components/language-select';
import { cx, ghostButton } from '@/components/ui';
import { labels, type Locale } from '@/lib/i18n';

// A menu row (the old .account-menu-item): a link or a button with the
// same 44px face.
const menuItem =
  'flex min-h-[44px] w-full cursor-pointer items-center rounded-md border-none bg-transparent px-[14px] py-12 text-left [font-family:inherit] text-[15px] [line-height:inherit] text-ink-black no-underline hover:bg-sky-wash-soft max-sm:text-[16px]';

// The Account menu: the dashboard actions (Update profile, Sign out) in
// one dropdown, closed by an outside click or Escape. Shared by the
// workspace dashboard and the update-profile flow, which is part of the
// dashboard's flow — never part of the onboarding card.
//
// It carries the language control: a native select that navigates to the
// other locale subtree's equivalent of the current path. Static export
// keeps one html per locale, so the control is plain navigation. The
// update-profile link is locale-aware too: the es tree mirrors it under
// /es/app/profile/.
export function AccountMenu({ locale = 'en' }: { locale?: Locale }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  // The pathname rides null on the server render; the swap degrades to the
  // landing root and the client render re-anchors it.
  const pathname = usePathname();
  const labelsT = labels(locale);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    function onDocumentMouseDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocumentMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocumentMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const swap = () => {
    setMenuOpen(false);
    router.push(swapLocalePath(pathname ?? '/'));
  };

  return (
    <div className="relative max-sm:w-full" ref={menuRef}>
      <button
        type="button"
        className={cx(ghostButton, 'max-sm:w-full')}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        {labelsT.account}
      </button>
      {menuOpen ? (
        <ul
          className="absolute top-[calc(100%+var(--spacing-8))] right-0 z-20 m-0 min-w-[200px] list-none rounded-lg border border-stone-border bg-pure-white p-4 shadow-sm max-sm:static max-sm:mt-8 max-sm:w-full max-sm:min-w-0 max-sm:shadow-none"
          role="menu"
          aria-label={labelsT.account}
        >
          <li role="none">
            <Link
              role="menuitem"
              className={menuItem}
              href={locale === 'es' ? '/es/app/profile/' : '/app/profile/'}
            >
              {labelsT.updateProfile}
            </Link>
          </li>
          <li role="none">
            <button
              role="menuitem"
              type="button"
              className={menuItem}
              onClick={() => {
                setMenuOpen(false);
                // Navigate, do NOT mutate the session in place: the mounted
                // page keeps its in-memory session and would look signed in
                // after a storage-only clear. The /logout/ route owns the
                // revoke + clear + redirect flow.
                router.replace('/logout/');
              }}
            >
              {labelsT.signOut}
            </button>
          </li>
          <li role="none">
            <label className="flex min-h-[44px] w-full items-center gap-8 px-[14px] py-12 text-[15px] text-ink-black hover:bg-sky-wash-soft max-sm:text-[16px]">
              <span className="shrink-0">{labelsT.language}</span>
              <select
                className={menuLanguageSelectClass}
                aria-label={labelsT.language}
                value={locale}
                onChange={swap}
              >
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
            </label>
          </li>
        </ul>
      ) : null}
    </div>
  );
}
