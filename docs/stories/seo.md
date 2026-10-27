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
