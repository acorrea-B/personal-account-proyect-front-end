# View-generation memory

Status: active lesson

A styling skill and `docs/design-brief.md` improved consistency, but they were **not sufficient to generate correct-looking UI on the first pass**. The landing page required many visual corrections after the initial implementation.

## What went missing

- A single authoritative wireframe for each screen.
- Explicit ownership rules for surfaces (`landing-copy`, `auth-card`, feature-card, overlay, background).
- Color inheritance rules, especially when `body` or page-level background styles override card text.
- Contrast checks per surface (white background vs dark background).
- Alignment and flow rules for CTA blocks.
- Transition/loading-state rules so navigation and session bootstrap do not look abrupt.
- Image usage rules: full-bleed background vs embedded illustration.
- Icon insertion rules: inline SVG, consistent stroke weight, no external image assets.

## Iteration count for this first view phase

- Total repository commits at retrospective point: 55.
- Styling branch (`feat/auth-styling`) iterative commits: 21.
- Additional manual visual correction rounds: 15+.
- Automated gates repeated during iterations: lint, typecheck, Prettier, 34 tests, static export build.

## Conclusion

Design documentation gives tokens, not composition logic. For future views, create a small visual acceptance checklist before implementation and run a real browser pass. Do not claim completion based only on build/tests.
