# Design brief — personal-account-proyect-front-end

**Created**: 2026-10-25
**Status**: proposed — pending approval to scaffold and implement
**Selected visual reference**: Seline Analytics
https://styles.refero.design/style/7967c6d9-e50c-42b5-b4d1-74003ba41781

## 1. Goal and audience

- Private web application for the owner of a professional profile and CV.
- Flows: register, email verification, login, refresh, profile read/update, CV read/save/history read.
- Primary audience: the account holder, accessing the app from desktop and mobile.
- The product is not a marketing site, public portfolio, or analytics dashboard; visual density must stay calm and form-first.

## 2. Visual reference and adaptation

- Master reference: Seline Analytics (Refero).
- Adaptation rule: borrow its warm stone canvas, restrained single cyan accent, Roobert/Inter typographic restraint, pill controls, flat white cards, thin stone borders, light single shadows, and editorial spacing.
- Explicitly exclude the mascot sticker; it does not fit a private profile/CV editor.
- Embedded product UI is the primary content, as in Seline's dashboard preview.

## 3. Design concept

Calm editorial utility: warm paper surfaces, near-black type, a single chromatic accent for conversion and active states, generous vertical rhythm, and flat surfaces defined by hairline borders rather than heavy elevation.

## 4. Semantic color system

| Token                  | Value     | Role                             |
| ---------------------- | --------- | -------------------------------- |
| `--color-stone-canvas` | `#fafaf9` | Page background                  |
| `--color-pure-white`   | `#ffffff` | Cards, inputs, elevated surfaces |
| `--color-stone-border` | `#e8e6e5` | Hairline borders                 |
| `--color-stone-muted`  | `#d6d3d1` | Secondary borders/dividers       |
| `--color-ash-gray`     | `#a8a29e` | Muted helper text                |
| `--color-warm-gray`    | `#78716c` | Secondary body/nav text          |
| `--color-ink-black`    | `#0c0a09` | Primary headings/text            |
| `--color-soot`         | `#1c1917` | Inverted surfaces                |
| `--color-cyan-signal`  | `#3ba6f1` | Primary CTA, active links/focus  |
| `--color-cyan-edge`    | `#3398e1` | Emphasis/highlight treatment     |
| `--color-sky-wash`     | `#c1e1f7` | Highlight background             |

- Do not introduce green/red/purple accents for chrome.
- Use cyan only for conversion, active, and focus states.

## 5. Typography

- Display font: Roobert at weight 400 for display/headings (anti-convention restraint).
- UI/body font: Inter at weights 400/500/600.
- Display: 52px, line-height 1.12, letter-spacing -1.092px.
- Heading small: 32px, line-height 1.25, letter-spacing -0.8px.
- Subheading: 20px, line-height 1.2.
- Body: 16px, line-height 1.69, letter-spacing 0.048px.
- Caption: 10px, line-height 2.3.
- No hand-rolled intermediate sizes; use the scale only.

## 6. Spacing, shape and elevation

- Base unit: 4px.
- Key spacing: 8, 12, 16, 24, 32, 40, 48, 64, 80, 96, 160.
- Page max width: 1200px.
- Section gap: 96px.
- Card padding: 24px.
- Element gap: 8px.
- Card radius: 10px.
- Feature card radius: 16px.
- Input radius: 6px.
- Icon radius: 4px.
- Tag/button radius: 9999px.
- Shapes stay flat: no decorative gradients, no glass, no heavy shadows.
- Permitted shadows:
  - subtle, small, md, xl (and only when the component has a documented reason).

## 7. Core components

- `AppShell` with header, language toggle, user identity, logout.
- `Card`: white surface, 10px radius, 1px stone border, optional subtle shadow.
- `PillButton`: filled cyan primary, ghost/text secondary, icon-only where appropriate.
- `FormField`: Inter 14px, 6px radius, 1px border, focus ring cyan.
- `ProblemAlert`: maps backend RFC 7807 slugs to localized copy and severity.
- `StateBlock`: loading skeletons, empty history, conflict reloaded state.
- `LocaleSwitcher`: minimal text control, not a flag-heavy widget.

## 8. Application routes

- `/login/`
- `/app/`
- `/app/profile/`
- `/app/cv/`
- `/app/cv/versions?id=<uuid>`
- Language selection is component state persisted in `localStorage`, not route-based.
- Private routes are client-guarded; no server-side route protection exists in static export.

## 9. Internationalization requirement

- The UI must support at least English and Spanish.
- Use a client-side i18n model compatible with static export:
  - no middleware
  - no server-only language routing
  - dictionaries loaded as static assets
  - locale persisted as a user preference
- English first, Spanish second or based on `navigator.language`.
- Backend error slugs are stable; localized copy lives in the dictionaries.
- Layouts must tolerate Spanish copy expansion, wrap gracefully, and avoid fixed widths.
- Typography should support Spanish accents and punctuation.

## 10. Security and privacy contact points

- No secrets in client HTML.
- `localStorage` is limited to non-sensitive preferences, such as locale selection.
- Access token in memory.
- Refresh token in `sessionStorage` until a safer static-compatible strategy is agreed.
- Validate all API responses with Zod before rendering.
- Show RFC 7807 errors without internal diagnostics.

## 11. Responsive behavior

- Mobile-first.
- Nav collapses to text labels, no hamburger with icons unless necessary.
- Cards stack to one column.
- CV textarea uses the full available width.
- Forms become single column on narrow viewports.
- At least 44px target size for touch interactions.

## 12. Accessibility baseline (WCAG 2.2 AA)

- One `h1` per page.
- Visible focus ring.
- Keyboard-only navigation for tabs, forms, dialogs.
- Labels and error messages programmatically associated.
- Contrast checked against stone palette and cyan.
- `prefers-reduced-motion` disables animated transitions.

## 13. Performance

- Static export.
- `images.unoptimized` where remote images are used, or no remote image dependency.
- No heavyweight animation library.
- Tree-shake i18n dictionaries.
- Keep bundle per feature route reasonable.

## 14. Static hosting notes

- `output: 'export'`.
- `trailingSlash: true`.
- Dynamic version pages use query parameters.
- Deploy `out/` to Scaleway Object Storage website endpoint.
- Add bucket origin to backend `ALLOWED_ORIGINS`.
- Cache `out/_next/static/*` immutably and HTML with short TTL.

## 15. Proposed file batches

Batch A — scaffolding:

- `package.json`
- `next.config.ts`
- `tsconfig.json`
- `eslint.config.mjs`
- `postcss.config.mjs`
- `vitest.config.ts`

Batch B — design and i18n:

- `app/globals.css`
- `design/tokens.ts`
- `i18n/en.ts`
- `i18n/es.ts`
- `lib/i18n.ts`
- `components/LocaleSwitcher.tsx`

Batch C — auth:

- `lib/api/client.ts`
- `lib/auth/session.ts`
- `lib/schemas/auth.ts`
- `app/login/page.tsx`
- `features/auth/hooks.ts`
- `features/auth/forms.tsx`

Batch D — profile:

- `lib/schemas/profile.ts`
- `features/profile/api.ts`
- `features/profile/form.tsx`
- `app/app/profile/page.tsx`
- `features/profile/concurrency.ts`
- `components/ProblemAlert.tsx`

Batch E — CV:

- `lib/schemas/cv.ts`
- `features/cv/api.ts`
- `features/cv/editor.tsx`
- `features/cv/versions.tsx`
- `app/app/cv/page.tsx`
- `app/app/cv/versions/page.tsx`

## 16. Acceptance criteria

- The visual direction is identifiable as Seline Analytics with documented adaptations.
- The UI supports English and Spanish switching.
- Export and deploy work to Scaleway static website storage.
- Lint, typecheck, tests, and build pass before deployment.
- No secrets or internal IDs appear in client HTML.
- Error and concurrency states are handled safely.
