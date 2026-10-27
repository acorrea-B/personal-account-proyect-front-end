# Story: SEO hardening for the public export

## Evidence

The operator ran seobility on the deployed bucket (findings pasted) and the
direct curl confirmed the HTTP layer: `content-type: text/html` without
charset, no content-encoding, no cache-control on any object; the checker
URL rode the raw S3 API endpoint (root 403 XML) instead of the website host.
The baseline is captured in `docs/task-metrics.md` for the post-DNS delta.

## v0.4.4 scope

1. **tf charset (this window):** `text/*` mime entries carry
   `; charset=utf-8` - fixed by the tag deploy itself (a content_type
   attribute update on the objects).
2. Landing copy: 250+ real words in paragraphs aligned with the h1 (fixes
   the wordcount, the missing-paragraph and the h1-match findings).
3. Favicon set: favicon.ico + icon.svg + apple-touch + manifest.
4. Per-segment metadata through server layouts (title template, og, twitter,
   canonicals), robots.ts + sitemap.ts, JSON-LD on the landing; /app/**
   gets noindex.

## Provider limit recorded

`scaleway_object` does not support a `cache_control` argument (verified in
the provider docs at the pinned `~> 2.86.0`) and its `metadata` map rides
as x-amz-meta-* user metadata, not as the Cache-Control header. Cache
policies therefore join gzip, the www/apex 301s and the https redirect in
the custom-domain + CDN decision (v2 queue), evaluated with the captured
baseline.

### Window 2 (2026-10-27): the landing copy (the checker's 3-in-1 fix)

The landing carried ~70 words and an h1 whose words never reappeared in
the content — three seobility findings in one screen. The copy rewrite
puts ~369 visible words in real paragraphs: an h1 anchored on the product
keywords ("A professional profile and CV that carry your career
forward."), a hero that names what the account holds (profile fields, the
versioned CV, the safety net), longer feature-card paragraphs in the same
calm voice, a growth section with two full paragraphs and a closing that
echoes the keywords. No stuffing — every sentence is a product sentence,
per the refero voice.
++ b/docs/stories/seo.md

### Mobile pass (2026-10-27, iPhone 16 Pro review)

The operator's device review: tiny text, small buttons, hard taps at
402px. The audit found the root cause plus a latent one: `--text-body-sm`
was consumed five times but never defined (an invalid font-size that fell
back to inherited small sizes), and the button scale sat under the 44x44
touch bar. The pass defines the token, steps the whole ladder down in a
single 640px media block (`:root` token re-declaration — every consumer
follows), and raises controls to touch targets: buttons 44px min with
15px text, menu items 44px, inputs 44px with 16px (no iOS focus zoom), and
the trailing actions stack full-width on phones. The viewport meta was
already correct.

### Panel copy + mobile scale round 2 (2026-10-27, operator)

The dashboard stopped speaking api ("Profile · live from the api" is
just "Profile"; the updated note reads "Updated Oct 27, 9:03 AM" with a
human stamp), the Update profile link stacks below the panel head at
full card width with a 44px tap row on phones, and the mobile scale
stepped up a rung (body 17, small 16, caption 13, buttons 16) — the
literal-px rules that the token re-declaration could not reach were
overridden in the same 640px block. The update-card header keeps "Your
workspace" (it already was plain).

### Windows 3b-3c status (2026-10-27): the crawler contract files

`lib/seo.ts` pins the canonical host (the static export bucket — one
constant moves when a custom domain lands), the root layout carries
metadataBase, the title template with the product keywords default, og
and twitter cards, and the export generates the crawler contract:
`manifest.webmanifest` pinned `force-static` (the static-export quirk —
the first build died on /manifest.webmanifest without it), robots.txt
with the /app/** + handoff disallows and sitemap.xml with the three
public urls. Noindex via per-segment layouts rides the next window.
++ b/docs/stories/seo.md

### i18n window 1 (2026-10-27, operator order): the es subtree starts

Operator order: the language switch belongs in the product. The strategy
for a static export (the operator's audience is Colombia): locale route
subtrees, not a client-side switch (the exported html would stay english
and the spanish content would never reach crawlers; hreflang needs
separate urls). The first window lands `app/es/page.tsx` — the full
landing translated (es-CO, the refero calm voice, all sections mirrored)
with the EN|ES switch in both navigations (`hrefLang` links between the
trees). Each following window translates a subtree and the dictionary
centralizes the copy so the trees stay thin. Known limitation recorded:
the root layout owns the html tag and stays en - the es pages patch
`document lang` on the client until the [locale] restructure. hreflang
pairs + the /es/ sitemap entries ride the metadata window.

### i18n window 2 (2026-10-27): the language picker becomes a control

The en/es text links became a native select (components/language-select.tsx)
that navigates between the locale subtrees — the OS picker on mobile, a
44px row, full-width inside the stacked 640px header, 16px text (no iOS
zoom rules needed on selects). The path mapping lives in
`swapLocalePath` (pure, tested: the landing root, the es prefix strip on
inner routes and the never-stack guard) and is built to map the
/es/app/** trees when their windows land. hreflang pairs stay in the
metadata window.

### i18n window 3b (2026-10-27): the /es/app dashboard tree

The dashboard es tree exists now (app/es/app/page.tsx): the identity bar
(Tu espacio / Hola, {nombre} / Sesión iniciada como), the profile panel
with the dictionary field labels and the human updated note, the rail
with the cv card + the timeline + the skill-suggestions card all reading
the dictionary via the locale prop, and the AccountMenu in spanish with
the Language select (the previous turn's addition) navigating the
mirrored paths. The update link targets /es/app/profile/ (its window
lands next; interim prod is safe because deploys ride batches, not
windows). The clamped bio speaks Mostrar más/Mostrar menos. The menu's
language select lost its bordered look: it rides the menu row style now
(transparent, sky hover).
