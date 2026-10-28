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
