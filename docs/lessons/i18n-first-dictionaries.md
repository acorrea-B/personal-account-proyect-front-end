# i18n since the first commit — the dictionaries-first rule

- Date: 2026-10-27
- Status: standing project rule (promoted to the operator's knowledge base and both skills)

## The rule

Every user-facing string exists inside the locale dictionaries from the very
first commit of a project:

1. **Dictionaries as data**: `lib/i18n/en.json` + `es.json` (or the project's
   equivalent), one key per label, no copy hardcoded in components or pages.
2. **Schema validation on import**: both files parse through one shared zod
   schema; a missing or drifted key fails the build, not the page.
3. **En/es key parity in CI**: a test walks each locale's key tree and fails
   when the sets diverge.
4. **One shared view per page + per-locale routes**: the route trees own the
   locale (URLs are the only dispatch a static export has) and each route is
   a one-line wrapper; `<html lang>` is correct per tree from the start.
5. **Locale-aware routes**, not just labels: every internal link, form
   handoff and redirect hangs from the tree's base prefix.

## The evidence (why it is not omissible)

- This repository (personal-account-proyect-front-end, batch v0.4.4): the i18n
  feature arrived after the whole product was built. The migration to
  dictionaries-first cost **20 commits** (~15 windows): 12 pages retired from
  a ~1.5k-line mirrored-page pattern into shared views fed by the
  dictionaries, plus the drift the mirrors bred — the es dashboard had lost
  the version-detail dialog, the en save path spoke the read rate cap, the es
  landing carried a dead unstyled class, and `/es/app/profile/` shipped as
  404 while the menus already linked it.
- Two lessons from the same batch: (a) mirrored page code breeds silent drift
  per tree — the dictionary does not; (b) the routes are part of the
  translation as much as the labels — a localized label pointing at an
  unlocalized route changes the language under the user's finger.
- A residual risk survives with the stubs: a missed es route stub 404s
  silently. The cure is a route-parity test in CI (tests/route-parity.test.ts
  here) that fails when the en/es route sets drift apart in either direction.

## How to apply on a new project (day one)

- Set up the dictionaries, the schema, the parity tests and the locale route
  layout in the first tasks of the plan, before the first feature page.
- New features add: one dictionary section, one shared view, per-locale route
  stubs — inside the six-file budget windows, with the parity and dict tests
  riding.
- The `html lang` handling and the per-tree route prefixes belong in the same
  first window; retrofitting both is the expensive part this rule exists to
  prevent.
