# Tailwind migration

**Decision (operator, 2026-10-31):** the UI moves from the hand-written
`app/globals.css` (~1700 lines) to Tailwind v4 with **visual parity** before the
new contract flows (OpenAPI 0.1.7 / BC-012) are built, so those flows are built
once, in the final styling. The visual direction does not change: Refero /
Seline (`design/references/selected-style.md`, `docs/design-brief.md`).

## How the migration keeps parity

- **No preflight.** Only Tailwind's `theme` and `utilities` layers are imported;
  the project's own base rules stay. Preflight would reset margins, headings,
  lists and buttons across every page at once.
- **The theme is the Refero export.** `@theme static` is the Tailwind v4 block
  published on the selected style page
  (https://styles.refero.design/style/7967c6d9-e50c-42b5-b4d1-74003ba41781),
  copied as is, plus the steps of its **extended Design Tokens**
  (`design/references/selected-style.tokens.json`, extracted from the data the
  page renders its extended view from). Always read the extended tokens, never
  the compact view. Extensions beyond the export (AA-safe text colors, teal,
  alert, breakpoints) are marked in the CSS with their reason. Tailwind's
  default palette, type scale, spacing, radii, shadows and breakpoints are
  cleared: a utility can only name a design token.
- **Names:** `font-roobert` (display, Inter Tight loaded as the substitute) and
  `font-inter`; `text-caption` 10px, `text-label` 12px, `text-meta` 13px,
  `text-body` 14px, `text-body-md` 15px, `text-body-lg` 16px, `text-title-sm`
  18px, `text-subheading`, `text-heading-sm`, `text-display`, each with its own
  line height and tracking; named radii (`rounded-buttons`, `rounded-cards`,
  `rounded-inputs`, ...); `max-w-page` is 1200px.
- **Spacing:** named steps from the export, so `p-16` is 16px and `gap-24` is
  24px. The base unit is cleared, so `p-5` does not exist: off-scale values are
  written as arbitrary values and justified.
- **Breakpoints:** `max-sm:` equals the old `max-width: 640px` and `max-md:` the
  old `max-width: 860px` (`--breakpoint-sm: 641px`, `--breakpoint-md: 861px`).
- **Cascade:** the hand-written rules are unlayered and still win over the
  utilities layer. Each window converts a group of components to utilities and
  deletes their old rules in the same commit, so no element is styled twice.

## Verification per window

1. Build the static export before and after the window and compare the compiled
   CSS: rules outside the converted components must not change (the Tailwind
   build minifies with Lightning CSS, which reorders properties and shortens
   values — compare normalized declarations, not bytes).
2. Every utility the build generates must be used by a converted component;
   Tailwind also generates utilities for words it finds in the source (`static`,
   `visible`, …) — check that no element carries such a class unintentionally.
3. Screenshots of the converted pages at 375 / 768 / 1280 px against the
   previous version, in `en` and `es`.
4. Gates: lint, typecheck, format, tests, static build.

Window 1 evidence: the compiled CSS outside Tailwind's layers keeps every rule
of the baseline (only minification differences); the 34 utilities Tailwind
generated from source words match no `className` in `app/`, `components/` or
`lib/`. Screenshots were not taken in window 1 because it changes no rule.

## Windows (≤6 files each, stacked)

| Window | Scope                                                                                                                              | Files                                                                                                      |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1      | Foundation: Tailwind v4 + PostCSS, tokens in `@theme static`, this plan                                                            | `package.json`, `package-lock.json`, `postcss.config.mjs`, `app/globals.css`, `docs/tailwind-migration.md` |
| 2      | Auth pages: login, register, confirm, logout                                                                                       | 4 views + `app/globals.css`                                                                                |
| 3      | Landing: hero, feature cards, scroll reveal, brand mark                                                                            | `landing-view.tsx`, `icons.tsx` + `app/globals.css`                                                        |
| 4      | Dashboard shell: identity bar, account menu, language picker                                                                       | `dashboard-view.tsx`, `account-menu.tsx`, `language-select.tsx` + `app/globals.css`                        |
| 5      | Profile setup: fields, counters, autocomplete, toast, link rows, skeletons                                                         | `profile-view.tsx`, `clamped-text.tsx`, `skeleton.tsx` + `app/globals.css`                                 |
| 6      | CV: card, editor, timeline, version detail                                                                                         | 4 CV components + `app/globals.css`                                                                        |
| 7      | Cleanup: keyframes as theme animations, mobile token scale, remaining base rules; `globals.css` keeps only imports, theme and base | `app/globals.css` (+ any straggler)                                                                        |

Then the BC-012 flows start (skill suggestions + summary, decisions, catalog with
consent, `PUT /v1/profile` syncing skill rows).
