'use client';

import { type Locale } from '@/lib/i18n';

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
      className="language-select"
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
