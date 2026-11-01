# Visual polish iteration specification

> **Actualización de dirección — 2026-11-01:** aplicar
> [design-professional-ui](../../.agents/skills/design-professional-ui/SKILL.md)
> para decidir composición, anatomía de cards, superficies y color semántico.
> Las restricciones absolutas de un solo acento y texto blanco sobre cian de
> esta retrospectiva quedan sustituidas por la dirección vigente de
> [design-brief.md](../design-brief.md). Conservar las demás lecciones como
> contexto y verificar el código actual antes de aplicarlas.

This note records the cost of the extended landing/auth visual iteration and converts it into a fixed specification set. Future UI work must define these points before implementation.

## Spec, point by point

1. **Canvas and surfaces**
   - Page background: `--color-stone-canvas` only (`#fafaf9`); never white, dark, gradient, photograph or glass.
   - Card surface: `--color-pure-white` (`#ffffff`), `--radius-lg` (10px), `--shadow-subtle` (or no shadow for static cards).
   - Inverted sections: `--color-soot` (`#1c1917`) sparingly, as a token, never as page background.
   - No `backdrop-filter` or frosted layers.

2. **Structure and spacing**
   - Centered `max-width: 1200px`, horizontal padding 24px, section gap 96px.
   - Card padding: 24px desktop, 16px mobile.
   - Element gap: 8px.
   - No heavy nested wrappers or decorative outer containers.

3. **Typography**
   - Display and headings in Roobert weight 400 at 18px / 20px / 32px / 52px with negative tracking.
   - Body/nav/UI in Inter 14px weight 400, line height 1.64.
   - Exactly one cyan highlight span per headline (text `--color-cyan-edge`, background `--color-sky-wash`, padding ~2px 8px, radius 4px).

4. **Color and chrome**
   - Only one chromatic accent: cyan (`#3ba6f1`, edge `#3398e1`).
   - No red, green, purple, or extra accents, including error diagnosis chrome.
   - Error states use compliant components (alert text, soot panels, heading prefix), not hue overload.

5. **Buttons and controls**
   - Button shape: pill (`9999px`) radius.
   - Primary CTA is cyan filled with white text, cyan border, 8px 16px padding, and only once per viewport.
   - Ghost CTA: transparent, stone hairline, ink-black text.
   - Nav links: no fill, warm-gray text, ink-black on hover.

6. **Inputs and forms**
   - White fill, `6px` radius, `1px #d6d3d1` border, placeholder `--color-warm-gray`.
   - Focus: `2px --color-cyan-signal` ring and no ad hoc underline animation.
   - Labels sit above inputs and errors associate programmatically.

7. **Imagery and media**
   - Product UI screenshots are grayscale(1) contrast(0.94) with `--shadow-md` or `--shadow-xl` (only for one preview card).
   - No lifestyle/team/environment photography; no mascot imagery.
   - Icons are 1px-stroke outline only, colors from approved palette.

8. **Elevation**
   - Content card: `--shadow-subtle`.
   - Floating preview: `--shadow-xl`, once per page.
   - Do not stack multiple shadows on the same element.

9. **Motion**
   - Long page transitions and background pan must be removed before final.
   - Use a single brief opacity transition (`300–400ms`) for protected areas only.
   - Respect `prefers-reduced-motion`: no animated transitions and all content visible.

10. **Text behavior in auth**

- Errors use a neutral/full-power warning box: soot background, white bold text, `Alert:` or equivalent prefix. No crimson/red.
- Underline inputs are forbidden for review flows; keep full framed inputs with the focus ring.

11. **Auth and registration layout**

- `/register/`: canvas background, white `560px` card max, 32px padding on desktop.
- Show a short 3-step stepper with icons (Account, Verify, Profile), no long explanatory copy.
- Active step: cyan fill, white text and glyph.

12. **Governance before merge**

- Produce HTML/visual proof or screenshot for any change requesting animation, image, or new token.
- URL verification comes after `npm run lint`, `tsc`, tests, and export build.
- Keep changes stacked in small PRs and record task metrics after each.

## Lessons learned

- The landing and auth pages required many visual iterations because the brief did not fix motion, media, input, and surface behavior as a single spec.
- Refero's extended view mode, not compact, should be used for deciding composition details (https://styles.refero.design).
- Lock surface tokens and error presentation as checkpoint criteria before coding; they were the highest source of visual drift.
