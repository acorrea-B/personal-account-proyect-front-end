'use client';

import { useRouter } from 'next/navigation';

import { type Locale } from '@/lib/i18n';

// Toggles a path between the locale subtrees: an es-prefixed path strips
// to its english equivalent, anything else prefixes /es. Pure on purpose -
// the dropdown navigation and the tests share it.
export function swapLocalePath(path: string): string {
  const bare = path.replace(/^\/es(?=\/|$)/, '') || '/';
  return path.startsWith('/es/') || path === '/es' ? bare : bare === '/' ? '/es/' : `/es${bare}`;
}

// The language picker: a native select navigates between the locale
// subtrees. The static export keeps one html per locale and the native
// control stays a first-class tap target on every device (the OS picker
// on mobile, 44px row, full width in the stacked header).
export function LanguageSelect({ current, path }: { current: Locale; path: string }) {
  const router = useRouter();

  return (
    <select
      className="language-select"
      aria-label="Site language"
      value={current}
      onChange={(event) => {
        const next = event.target.value as Locale;
        if (next !== current) {
          router.push(swapLocalePath(path));
        }
      }}
    >
      <option value="en">English</option>
      <option value="es">Español</option>
    </select>
  );
}
