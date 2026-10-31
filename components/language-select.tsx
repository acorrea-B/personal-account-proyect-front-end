'use client';

import { type Locale } from '@/lib/i18n';

// The native select's look (the old .language-select rule): no chrome, the
// strong cyan voice, a 44px row, the full width of the stacked header on a
// phone. The account menu's variant sits at the row's end at 40px.
export const languageSelectClass =
  'inline-flex min-h-[44px] w-auto items-center border-none bg-transparent p-0 [font-family:inherit] text-[16px] [line-height:inherit] text-cyan-text-strong hover:bg-sky-wash-soft max-sm:w-full';
export const menuLanguageSelectClass =
  'ml-auto inline-flex min-h-[40px] w-auto items-center border-none bg-transparent p-0 [font-family:inherit] text-[15px] [line-height:inherit] text-cyan-text-strong hover:bg-sky-wash-soft max-sm:w-full max-sm:text-[16px]';

// Toggles a path between the locale subtrees: an es-prefixed path strips
// to its english equivalent, anything else prefixes /es. Pure on purpose -
// the dropdown navigation and the tests share it.
export function swapLocalePath(path: string): string {
  const bare = path.replace(/^\/es(?=\/|$)/, '') || '/';
  return path.startsWith('/es/') || path === '/es' ? bare : bare === '/' ? '/es/' : `/es${bare}`;
}

// The language picker: a native select whose change loads the other tree
// with a FULL document navigation. The cross-tree switch never rides
// client-side route data: a stale shell (a rebuilt export, an older
// service worker) would 404 on RSC payloads and chunk names that no
// longer exist, while a fresh document always carries matching assets and
// the browser's own language attribute. The static export keeps one html
// per locale and the native control stays a first-class tap target on
// every device (the OS picker on mobile, 44px row, full width in the
// stacked header).
export function LanguageSelect({ current, path }: { current: Locale; path: string }) {
  return (
    <select
      className={languageSelectClass}
      aria-label="Site language"
      value={current}
      onChange={(event) => {
        const next = event.target.value as Locale;
        if (next !== current) {
          window.location.assign(swapLocalePath(path));
        }
      }}
    >
      <option value="en">English</option>
      <option value="es">Español</option>
    </select>
  );
}
